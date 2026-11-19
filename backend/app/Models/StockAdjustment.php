<?php

namespace App\Models;

use App\Enums\AdjustmentReason;
use App\Models\Concerns\HasCreator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['product_id', 'qty', 'reason', 'unit_cost', 'note', 'created_by'])]
class StockAdjustment extends Model
{
    use HasCreator;

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'reason' => AdjustmentReason::class,
            'unit_cost' => 'decimal:4',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** Loss value (positive number) for negative adjustments, 0 otherwise. */
    public function lossValue(): float
    {
        return $this->qty < 0 ? round(abs($this->qty) * (float) $this->unit_cost, 2) : 0.0;
    }
}
