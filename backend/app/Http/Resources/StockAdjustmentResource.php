<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StockAdjustment */
class StockAdjustmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id, 'name' => $this->product->name,
            ]),
            'qty' => (int) $this->qty,
            'reason' => $this->reason->value,
            'reason_label' => $this->reason->label(),
            'unit_cost' => round((float) $this->unit_cost, 4),
            'loss_value' => $this->lossValue(),
            'note' => $this->note,
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
