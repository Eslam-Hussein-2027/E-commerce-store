<?php

namespace App\Http\Requests;

use App\Enums\OrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OrderStatusRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(OrderStatus::class)],
            'delivered_by_user_id' => ['nullable', 'required_if:status,delivered', 'integer', 'exists:users,id'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'delivered_at' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'delivered_by_user_id.required_if' => 'يجب تحديد من قام بالتوصيل عند تأكيد التسليم.',
        ];
    }

    public function status(): OrderStatus
    {
        return OrderStatus::from($this->validated('status'));
    }
}
