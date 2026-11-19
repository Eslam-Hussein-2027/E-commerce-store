<?php

namespace App\Models;

use App\Models\Concerns\HasCreator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * NOTE: `stock` and `avg_cost` are intentionally NOT fillable.
 * They are changed only by StockService / PurchaseService inside transactions.
 */
#[Fillable(['name', 'category_id', 'sell_price', 'reorder_level', 'is_active', 'created_by'])]
class Product extends Model
{
    use HasCreator, HasFactory;

    protected function casts(): array
    {
        return [
            'sell_price' => 'decimal:2',
            'avg_cost' => 'decimal:4',
            'stock' => 'integer',
            'reorder_level' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function purchaseItems(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function isLowStock(): bool
    {
        return $this->stock <= $this->reorder_level;
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query->whereColumn('stock', '<=', 'reorder_level');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
