<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Models\Concerns\HasCreator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'customer_name', 'phone', 'area', 'status', 'goods_total', 'delivery_fee',
    'delivered_by_user_id', 'order_date', 'delivered_at', 'note', 'created_by',
])]
class Order extends Model
{
    use HasCreator, HasFactory;

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'goods_total' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'order_date' => 'date',
            'delivered_at' => 'datetime',
            'stock_restored' => 'boolean',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function deliveredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivered_by_user_id');
    }

    /** Only delivered orders count toward revenue, profit and custody. */
    public function scopeDelivered(Builder $query): Builder
    {
        return $query->where('status', OrderStatus::Delivered->value);
    }
}
