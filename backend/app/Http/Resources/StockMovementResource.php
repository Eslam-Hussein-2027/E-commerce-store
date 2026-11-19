<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StockMovement */
class StockMovementResource extends JsonResource
{
    private const REFERENCE_LABELS = [
        'purchase' => 'فاتورة شراء',
        'order' => 'طلب',
        'adjustment' => 'تسوية',
    ];

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id, 'name' => $this->product->name,
            ]),
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'qty' => (int) $this->qty,
            'stock_after' => (int) $this->stock_after,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'reference_label' => $this->reference_type
                ? (self::REFERENCE_LABELS[$this->reference_type] ?? $this->reference_type).' #'.$this->reference_id
                : null,
            'note' => $this->note,
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
