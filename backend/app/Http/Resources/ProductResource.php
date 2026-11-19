<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Product */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ] : null),
            'sell_price' => (float) $this->sell_price,
            'avg_cost' => round((float) $this->avg_cost, 4),
            'stock' => (int) $this->stock,
            'stock_value' => round($this->stock * (float) $this->avg_cost, 2),
            'reorder_level' => (int) $this->reorder_level,
            'is_low_stock' => $this->isLowStock(),
            'is_active' => (bool) $this->is_active,
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
