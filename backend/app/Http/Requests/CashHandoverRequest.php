<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CashHandoverRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999'],
            'handed_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
