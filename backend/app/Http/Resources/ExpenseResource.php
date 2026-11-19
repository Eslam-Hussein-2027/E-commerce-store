<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Expense */
class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category->value,
            'category_label' => $this->category->label(),
            'amount' => (float) $this->amount,
            'expense_date' => $this->expense_date?->toDateString(),
            'paid_by_user_id' => $this->paid_by_user_id,
            'paid_by' => $this->whenLoaded('paidBy', fn () => ['id' => $this->paidBy->id, 'name' => $this->paidBy->name]),
            'note' => $this->note,
            'created_by_name' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
