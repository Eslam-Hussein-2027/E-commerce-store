<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * stock / avg_cost are deliberately absent: they are never edited manually.
 */
class ProductRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // The name is the product's identifier, so it must be unique.
            'name' => ['required', 'string', 'max:150', Rule::unique('products', 'name')->ignore($this->route('product'))],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'sell_price' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'reorder_level' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
