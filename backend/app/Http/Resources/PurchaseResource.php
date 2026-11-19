<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Purchase */
class PurchaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier' => $this->supplier,
            'purchase_date' => $this->purchase_date?->toDateString(),
            'total_cost' => (float) $this->total_cost,
            'paid_by_user_id' => $this->paid_by_user_id,
            'paid_by' => $this->whenLoaded('paidBy', fn () => ['id' => $this->paidBy->id, 'name' => $this->paidBy->name]),
            'note' => $this->note,
            'items_count' => $this->whenCounted('items'),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->relationLoaded('product') ? [
                    'id' => $item->product->id,
                    'name' => $item->product->name,
                ] : null,
                'qty' => (int) $item->qty,
                'unit_cost' => round((float) $item->unit_cost, 4),
                'line_total' => round($item->qty * (float) $item->unit_cost, 2),
            ])),
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
