<?php

namespace Tests\Feature\Services;

use App\Enums\MovementType;
use App\Models\Product;
use App\Models\User;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WeightedAverageCostTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::factory()->create());
    }

    #[Test]
    public function formula_matches_the_business_rule(): void
    {
        // (10 × 5 + 10 × 8) / 20 = 6.5
        $this->assertSame(6.5, PurchaseService::weightedAverage(10, 5.0, 10, 8.0));
        // Empty stock → the purchase cost becomes the average.
        $this->assertSame(12.25, PurchaseService::weightedAverage(0, 99.0, 4, 12.25));
    }

    #[Test]
    public function first_purchase_sets_average_to_unit_cost(): void
    {
        $product = Product::factory()->create();

        $this->purchase($product, 10, 5);

        $product->refresh();
        $this->assertSame(10, $product->stock);
        $this->assertEquals(5.0, (float) $product->avg_cost);
    }

    #[Test]
    public function subsequent_purchases_use_weighted_average(): void
    {
        $product = Product::factory()->create();

        $this->purchase($product, 10, 5);   // avg 5
        $this->purchase($product, 10, 8);   // (50 + 80) / 20 = 6.5
        $this->assertEquals(6.5, (float) $product->refresh()->avg_cost);

        // Sell 5 → stock 15 @ 6.5; then buy 5 @ 10 → (97.5 + 50) / 20 = 7.375
        $this->order([[$product, 5, 20]]);
        $this->purchase($product, 5, 10);

        $product->refresh();
        $this->assertSame(20, $product->stock);
        $this->assertEquals(7.375, (float) $product->avg_cost);
    }

    #[Test]
    public function purchase_records_in_movements_and_total_cost(): void
    {
        $a = Product::factory()->create();
        $b = Product::factory()->create();

        $purchase = app(PurchaseService::class)->create([
            'purchase_date' => now()->toDateString(),
            'paid_by_user_id' => auth()->id(),
            'items' => [
                ['product_id' => $a->id, 'qty' => 3, 'unit_cost' => 10.5],
                ['product_id' => $b->id, 'qty' => 2, 'unit_cost' => 4.25],
            ],
        ]);

        $this->assertEquals(40.0, (float) $purchase->total_cost); // 31.5 + 8.5
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $a->id, 'type' => MovementType::In->value, 'qty' => 3,
            'reference_type' => 'purchase', 'reference_id' => $purchase->id,
            'created_by' => auth()->id(),
        ]);
        $this->assertSame([], app(\App\Services\StockService::class)->audit());
    }

    #[Test]
    public function deleting_a_purchase_reverses_stock_and_average(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5);
        $second = $this->purchase($product, 10, 8); // avg 6.5

        app(PurchaseService::class)->delete($second);

        $product->refresh();
        $this->assertSame(10, $product->stock);
        $this->assertEquals(5.0, (float) $product->avg_cost);
        $this->assertSame([], app(\App\Services\StockService::class)->audit());
    }
}
