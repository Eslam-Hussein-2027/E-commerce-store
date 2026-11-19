<?php

namespace App\Services;

use App\Enums\MovementType;
use App\Models\Product;
use App\Models\Purchase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(private readonly StockService $stock) {}

    /**
     * Weighted Average Cost:
     *   new_avg = (current_stock × current_avg + qty × unit_cost) / (current_stock + qty)
     */
    public static function weightedAverage(int $currentStock, float $currentAvg, int $qty, float $unitCost): float
    {
        $currentStock = max(0, $currentStock);
        $totalQty = $currentStock + $qty;

        if ($totalQty <= 0) {
            return round($unitCost, 4);
        }

        return round(($currentStock * $currentAvg + $qty * $unitCost) / $totalQty, 4);
    }

    /**
     * @param  array{supplier?:string|null, purchase_date:string, paid_by_user_id?:int|null, note?:string|null,
     *               items: array<int, array{product_id:int, qty:int, unit_cost:float|string}>}  $data
     */
    public function create(array $data): Purchase
    {
        return DB::transaction(function () use ($data) {
            $products = $this->stock->lockProducts(array_column($data['items'], 'product_id'));

            $purchase = Purchase::create([
                'supplier' => $data['supplier'] ?? null,
                'purchase_date' => $data['purchase_date'],
                'paid_by_user_id' => $data['paid_by_user_id'] ?? null,
                'note' => $data['note'] ?? null,
                'total_cost' => 0,
            ]);

            $total = 0.0;

            foreach ($data['items'] as $row) {
                /** @var Product $product */
                $product = $products[(int) $row['product_id']];
                $qty = (int) $row['qty'];
                $unitCost = round((float) $row['unit_cost'], 4);

                // Average must be computed with the stock BEFORE this purchase.
                $product->avg_cost = self::weightedAverage($product->stock, (float) $product->avg_cost, $qty, $unitCost);

                $purchase->items()->create([
                    'product_id' => $product->id,
                    'qty' => $qty,
                    'unit_cost' => $unitCost,
                ]);

                $this->stock->record($product, MovementType::In, $qty, $purchase, "فاتورة شراء #{$purchase->id}");

                $total += $qty * $unitCost;
            }

            $purchase->update(['total_cost' => round($total, 2)]);

            return $purchase->load(['items.product', 'paidBy', 'creator']);
        });
    }

    /**
     * Delete a purchase by reversing its stock and its effect on the average cost.
     * Refused when part of the purchased quantity has already left the stock.
     */
    public function delete(Purchase $purchase): void
    {
        DB::transaction(function () use ($purchase) {
            $purchase = Purchase::query()->whereKey($purchase->id)->lockForUpdate()->firstOrFail();
            $items = $purchase->items()->get();
            $products = $this->stock->lockProducts($items->pluck('product_id'));

            foreach ($items as $item) {
                /** @var Product $product */
                $product = $products[$item->product_id];

                if ($product->stock < $item->qty) {
                    throw ValidationException::withMessages([
                        'purchase' => "لا يمكن حذف الفاتورة: المتوفر من «{$product->name}» ({$product->stock}) أقل من الكمية المشتراة ({$item->qty}). استخدم تسوية المخزون بدلاً من ذلك.",
                    ]);
                }

                $remaining = $product->stock - $item->qty;
                if ($remaining > 0) {
                    $reversed = ($product->stock * (float) $product->avg_cost - $item->qty * (float) $item->unit_cost) / $remaining;
                    // A negative result means the history can't be cleanly reversed; keep the current average.
                    if ($reversed >= 0) {
                        $product->avg_cost = round($reversed, 4);
                    }
                }

                $this->stock->record($product, MovementType::In, -$item->qty, $purchase, "حذف فاتورة شراء #{$purchase->id}");
            }

            $purchase->delete();
        });
    }
}
