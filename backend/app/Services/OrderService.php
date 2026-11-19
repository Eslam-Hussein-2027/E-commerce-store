<?php

namespace App\Services;

use App\Enums\MovementType;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * Create an order and deduct stock immediately (movement type "out").
     *
     * @param  array{customer_name:string, phone:string, area?:string|null, order_date?:string|null,
     *               delivery_fee?:float|string|null, note?:string|null,
     *               items: array<int, array{product_id:int, qty:int, unit_price:float|string}>}  $data
     */
    public function create(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $items = $this->normalizeItems($data['items']);
            $products = $this->stock->lockProducts(array_column($items, 'product_id'));

            $this->assertAvailable($items, $products);

            $order = Order::create([
                'customer_name' => $data['customer_name'],
                'phone' => $data['phone'],
                'area' => $data['area'] ?? null,
                'status' => OrderStatus::Pending,
                'goods_total' => 0,
                'delivery_fee' => $data['delivery_fee'] ?? 0,
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'note' => $data['note'] ?? null,
            ]);

            $order->goods_total = $this->saveItems($order, $items, $products);
            $order->save();

            foreach ($items as $index => $item) {
                $this->stock->record(
                    $products[$item['product_id']], MovementType::Out, -$item['qty'], $order,
                    "طلب #{$order->id}", "items.{$index}.qty",
                );
            }

            return $this->loadForResponse($order);
        });
    }

    /**
     * Edit an order. Items can only change while the order is still pending;
     * stock is moved by the per-product difference between old and new items.
     */
    public function update(Order $order, array $data): Order
    {
        return DB::transaction(function () use ($order, $data) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->status !== OrderStatus::Pending) {
                throw ValidationException::withMessages([
                    'status' => 'لا يمكن تعديل الطلب إلا وهو في حالة «قيد التجهيز».',
                ]);
            }

            $oldItems = $order->items()->get();
            $newItems = $this->normalizeItems($data['items']);

            $products = $this->stock->lockProducts(
                $oldItems->pluck('product_id')->merge(array_column($newItems, 'product_id'))
            );

            $oldQty = $oldItems->groupBy('product_id')->map(fn ($rows) => (int) $rows->sum('qty'))->all();
            $this->assertAvailable($newItems, $products, $oldQty);

            $newQty = collect($newItems)->groupBy('product_id')->map(fn ($rows) => (int) $rows->sum('qty'))->all();

            foreach ($products as $productId => $product) {
                $delta = ($newQty[$productId] ?? 0) - ($oldQty[$productId] ?? 0);
                if ($delta > 0) {
                    $this->stock->record($product, MovementType::Out, -$delta, $order, "تعديل طلب #{$order->id}");
                } elseif ($delta < 0) {
                    $this->stock->record($product, MovementType::Return, -$delta, $order, "تعديل طلب #{$order->id}");
                }
            }

            $order->items()->delete();

            $order->fill([
                'customer_name' => $data['customer_name'],
                'phone' => $data['phone'],
                'area' => $data['area'] ?? null,
                'delivery_fee' => $data['delivery_fee'] ?? 0,
                'order_date' => $data['order_date'] ?? $order->order_date,
                'note' => $data['note'] ?? null,
            ]);
            $order->goods_total = $this->saveItems($order, $newItems, $products);
            $order->save();

            return $this->loadForResponse($order);
        });
    }

    /**
     * Move an order through its lifecycle.
     * Cancelling/returning restores stock exactly once (guarded by stock_restored + terminal states).
     *
     * @param  array{delivered_by_user_id?:int|null, delivered_at?:string|null, delivery_fee?:float|string|null}  $data
     */
    public function changeStatus(Order $order, OrderStatus $to, array $data = []): Order
    {
        return DB::transaction(function () use ($order, $to, $data) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $from = $order->status;

            if ($from === $to) {
                throw ValidationException::withMessages([
                    'status' => "الطلب بالفعل في حالة «{$to->label()}».",
                ]);
            }

            if (! $from->canTransitionTo($to)) {
                throw ValidationException::withMessages([
                    'status' => "لا يمكن تغيير حالة الطلب من «{$from->label()}» إلى «{$to->label()}».",
                ]);
            }

            if (! empty($data['delivered_by_user_id']) && in_array($to, [OrderStatus::OutForDelivery, OrderStatus::Delivered], true)) {
                $order->delivered_by_user_id = (int) $data['delivered_by_user_id'];
            }

            if ($to === OrderStatus::Delivered) {
                if (empty($order->delivered_by_user_id)) {
                    throw ValidationException::withMessages([
                        'delivered_by_user_id' => 'يجب تحديد من قام بالتوصيل.',
                    ]);
                }
                $order->delivered_at = $data['delivered_at'] ?? now();
                if (isset($data['delivery_fee'])) {
                    $order->delivery_fee = $data['delivery_fee'];
                }
            }

            if ($to->restoresStock() && ! $order->stock_restored) {
                $items = $order->items()->get();
                $products = $this->stock->lockProducts($items->pluck('product_id'));

                foreach ($items as $item) {
                    $this->stock->record(
                        $products[$item->product_id], MovementType::Return, $item->qty, $order,
                        "إرجاع مخزون طلب #{$order->id} ({$to->label()})",
                    );
                }

                $order->stock_restored = true;
            }

            $order->status = $to;
            $order->save();

            return $this->loadForResponse($order);
        });
    }

    /**
     * @return array<int, array{product_id:int, qty:int, unit_price:float}>
     */
    private function normalizeItems(array $items): array
    {
        return array_values(array_map(fn ($row) => [
            'product_id' => (int) $row['product_id'],
            'qty' => (int) $row['qty'],
            'unit_price' => round((float) $row['unit_price'], 2),
        ], $items));
    }

    /**
     * Reject the whole order if any product's requested qty exceeds what is available.
     * $credit = qty already held by this order (when editing), which becomes available again.
     *
     * @param  Collection<int, Product>  $products
     * @param  array<int, int>  $credit
     */
    private function assertAvailable(array $items, Collection $products, array $credit = []): void
    {
        $requested = [];
        $firstIndex = [];

        foreach ($items as $index => $item) {
            $id = $item['product_id'];
            $requested[$id] = ($requested[$id] ?? 0) + $item['qty'];
            $firstIndex[$id] ??= $index;
        }

        $errors = [];
        foreach ($requested as $id => $qty) {
            /** @var Product $product */
            $product = $products[$id];
            $key = "items.{$firstIndex[$id]}.qty";

            if (! $product->is_active && ! isset($credit[$id])) {
                $errors[$key] = "المنتج «{$product->name}» غير نشط ولا يمكن بيعه.";

                continue;
            }

            $available = $product->stock + ($credit[$id] ?? 0);
            if ($qty > $available) {
                $errors[$key] = $this->stock->insufficientStock($product, $qty, $key, $available)->errors()[$key][0];
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Persist items, snapshotting each product's avg_cost into unit_cost.
     *
     * @return float goods_total
     */
    private function saveItems(Order $order, array $items, Collection $products): float
    {
        $total = 0.0;

        foreach ($items as $item) {
            $order->items()->create([
                'product_id' => $item['product_id'],
                'qty' => $item['qty'],
                'unit_price' => $item['unit_price'],
                'unit_cost' => $products[$item['product_id']]->avg_cost,
            ]);
            $total += $item['qty'] * $item['unit_price'];
        }

        return round($total, 2);
    }

    private function loadForResponse(Order $order): Order
    {
        return $order->load(['items.product', 'deliveredBy', 'creator']);
    }
}
