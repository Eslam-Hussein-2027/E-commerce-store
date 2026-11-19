<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Products always start with stock 0 / avg_cost 0.
 * Stock only arrives through purchases (PurchaseService).
 *
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'منتج '.fake()->unique()->numberBetween(1, 99999),
            'sku' => strtoupper(fake()->unique()->bothify('SKU-####-??')),
            'category_id' => Category::factory(),
            'sell_price' => fake()->randomFloat(2, 20, 200),
            'reorder_level' => 5,
            'is_active' => true,
        ];
    }
}
