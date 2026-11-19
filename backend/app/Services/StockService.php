<?php

namespace App\Services;

use App\Enums\AdjustmentReason;
use App\Enums\MovementType;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use LogicException;

/**
 * The ONLY place where products.stock changes.
 *
 * Every change writes a stock_movements row and updates the cached
 * products.stock in the same transaction, so stock == SUM(movements.qty).
 */
class StockService
{
    /**
     * Lock the given products FOR UPDATE (ordered by id to avoid deadlocks).
     *
     * @param  iterable<int>  $productIds
     * @return Collection<int, Product> keyed by product id
     */
    public function lockProducts(iterable $productIds): Collection
    {
        $this->assertInTransaction();

        $ids = collect($productIds)->map(fn ($id) => (int) $id)->unique()->sort()->values();

        $products = Product::query()
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        if ($products->count() !== $ids->count()) {
            throw ValidationException::withMessages([
                'items' => 'أحد المنتجات المحددة غير موجود.',
            ]);
        }

        return $products;
    }

    /**
     * Record a signed movement and update the cached stock.
     * The product MUST already be locked via lockProducts().
     */
    public function record(
        Product $product,
        MovementType $type,
        int $qty,
        ?Model $reference = null,
        ?string $note = null,
        string $errorKey = 'qty',
    ): StockMovement {
        $this->assertInTransaction();

        if ($qty === 0) {
            throw new InvalidArgumentException('Stock movement quantity cannot be zero.');
        }

        $newStock = $product->stock + $qty;

        if ($newStock < 0) {
            throw $this->insufficientStock($product, abs($qty), $errorKey);
        }

        $product->stock = $newStock;
        $product->save();

        return StockMovement::create([
            'product_id' => $product->id,
            'type' => $type,
            'qty' => $qty,
            'stock_after' => $newStock,
            'reference_type' => $reference?->getMorphClass(),
            'reference_id' => $reference?->getKey(),
            'note' => $note !== null ? Str::limit($note, 250) : null,
        ]);
    }

    /**
     * Manual correction (damaged / lost / count correction).
     * Snapshots avg_cost so a negative adjustment is valued as a loss at that cost.
     *
     * @param  array{product_id:int, qty:int, reason:string, note?:string|null}  $data
     */
    public function adjust(array $data): StockAdjustment
    {
        return DB::transaction(function () use ($data) {
            $product = $this->lockProducts([$data['product_id']])->first();
            $qty = (int) $data['qty'];

            if ($product->stock + $qty < 0) {
                throw $this->insufficientStock($product, abs($qty));
            }

            $adjustment = StockAdjustment::create([
                'product_id' => $product->id,
                'qty' => $qty,
                'reason' => AdjustmentReason::from($data['reason']),
                'unit_cost' => $product->avg_cost,
                'note' => $data['note'] ?? null,
            ]);

            $this->record(
                $product, MovementType::Adjustment, $qty, $adjustment,
                $adjustment->reason->label().($adjustment->note ? ' — '.$adjustment->note : ''),
            );

            return $adjustment->load(['product', 'creator']);
        });
    }

    public function insufficientStock(Product $product, int $requested, string $errorKey = 'qty', ?int $available = null): ValidationException
    {
        $available ??= $product->stock;

        return ValidationException::withMessages([
            $errorKey => "الكمية المطلوبة من «{$product->name}» ({$requested}) أكبر من المتوفر في المخزون ({$available}).",
        ]);
    }

    /**
     * Products whose cached stock differs from SUM(stock_movements.qty).
     *
     * @return array<int, array{id:int, name:string, cached:int, ledger:int}>
     */
    public function audit(): array
    {
        $ledger = StockMovement::query()
            ->selectRaw('product_id, SUM(qty) as total')
            ->groupBy('product_id')
            ->pluck('total', 'product_id');

        return Product::query()->get(['id', 'name', 'stock'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'cached' => $p->stock,
                'ledger' => (int) ($ledger[$p->id] ?? 0),
            ])
            ->filter(fn ($row) => $row['cached'] !== $row['ledger'])
            ->values()
            ->all();
    }

    private function assertInTransaction(): void
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('Stock changes must run inside DB::transaction().');
        }
    }
}
