<?php

namespace App\Models;

use App\Enums\MovementType;
use App\Models\Concerns\HasCreator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Append-only stock ledger. products.stock == SUM(qty) per product.
 */
#[Fillable([
    'product_id', 'type', 'qty', 'stock_after', 'reference_type', 'reference_id', 'note', 'created_by',
])]
class StockMovement extends Model
{
    use HasCreator;

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'type' => MovementType::class,
            'qty' => 'integer',
            'stock_after' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
