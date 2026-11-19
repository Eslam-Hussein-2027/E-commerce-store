<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $itemsLoaded = $this->relationLoaded('items');

        return [
            'id' => $this->id,
            'customer_name' => $this->customer_name,
            'phone' => $this->phone,
            'area' => $this->area,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'allowed_transitions' => array_map(fn ($s) => $s->value, $this->status->allowedTransitions()),
            'goods_total' => (float) $this->goods_total,
            'delivery_fee' => (float) $this->delivery_fee,
            'delivered_by_user_id' => $this->delivered_by_user_id,
            'delivered_by' => $this->whenLoaded('deliveredBy', fn () => $this->deliveredBy
                ? ['id' => $this->deliveredBy->id, 'name' => $this->deliveredBy->name]
                : null),
            'order_date' => $this->order_date?->toDateString(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'note' => $this->note,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product' => $item->relationLoaded('product') ? [
                    'id' => $item->product->id,
                    'name' => $item->product->name,
                ] : null,
                'qty' => (int) $item->qty,
                'unit_price' => (float) $item->unit_price,
                'unit_cost' => round((float) $item->unit_cost, 4),
                'line_total' => round($item->qty * (float) $item->unit_price, 2),
                'line_profit' => round($item->qty * ((float) $item->unit_price - (float) $item->unit_cost), 2),
            ])),
            'gross_profit' => $this->when($itemsLoaded, fn () => round($this->items->sum(
                fn ($i) => $i->qty * ((float) $i->unit_price - (float) $i->unit_cost)
            ), 2)),
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
