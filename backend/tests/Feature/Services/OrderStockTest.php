<?php

namespace Tests\Feature\Services;

use App\Enums\MovementType;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderService;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrderStockTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    #[Test]
    public function creating_an_order_deducts_stock_immediately(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5);

        $order = $this->order([[$product, 3, 15]]);

        $this->assertSame(7, $product->refresh()->stock);
        $this->assertSame(OrderStatus::Pending, $order->status);
        $this->assertEquals(45.0, (float) $order->goods_total);
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id, 'type' => MovementType::Out->value, 'qty' => -3,
            'reference_type' => 'order', 'reference_id' => $order->id, 'stock_after' => 7,
        ]);
        $this->assertSame([], app(StockService::class)->audit());
    }

    #[Test]
    public function order_item_snapshots_avg_cost_so_history_never_changes(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5);

        $order = $this->order([[$product, 2, 15]]);
        $this->assertEquals(5.0, (float) $order->items->first()->unit_cost);

        // A later, more expensive purchase moves the average…
        $this->purchase($product, 8, 20);
        $this->assertNotEquals(5.0, (float) $product->refresh()->avg_cost);

        // …but the saved order item keeps its original cost.
        $this->assertEquals(5.0, (float) $order->items()->first()->unit_cost);
    }

    #[Test]
    public function order_exceeding_available_stock_is_rejected(): void
    {
        $product = Product::factory()->create(['name' => 'ساعة']);
        $this->purchase($product, 2, 5);

        try {
            $this->order([[$product, 3, 15]]);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('items.0.qty', $e->errors());
            $this->assertStringContainsString('أكبر من المتوفر', $e->errors()['items.0.qty'][0]);
        }

        $this->assertSame(2, $product->refresh()->stock);
        $this->assertSame(0, Order::count());
    }

    #[Test]
    public function duplicate_rows_for_same_product_are_checked_together(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 5, 5);

        $this->expectException(ValidationException::class);
        $this->order([[$product, 3, 15], [$product, 3, 15]]);
    }

    #[Test]
    public function cancelling_restores_stock_exactly_once(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5);
        $order = $this->order([[$product, 4, 15]]);
        $service = app(OrderService::class);

        $service->changeStatus($order, OrderStatus::Cancelled);
        $this->assertSame(10, $product->refresh()->stock);

        // Second attempt must be refused and must not touch stock.
        try {
            $service->changeStatus($order, OrderStatus::Cancelled);
            $this->fail('Expected ValidationException');
        } catch (ValidationException) {
        }
        try {
            $service->changeStatus($order, OrderStatus::Returned);
            $this->fail('Expected ValidationException');
        } catch (ValidationException) {
        }

        $this->assertSame(10, $product->refresh()->stock);
        $this->assertSame(1, $order->refresh()->stock_restored ? 1 : 0);
        $this->assertSame(1, \App\Models\StockMovement::where('type', MovementType::Return->value)->count());
        $this->assertSame([], app(StockService::class)->audit());
    }

    #[Test]
    public function returning_a_delivered_order_restores_stock_once(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5);
        $order = $this->order([[$product, 4, 15]]);
        $this->deliver($order, $this->user, 10);

        app(OrderService::class)->changeStatus($order, OrderStatus::Returned);
        $this->assertSame(10, $product->refresh()->stock);

        $this->expectException(ValidationException::class);
        app(OrderService::class)->changeStatus($order, OrderStatus::Returned);
    }

    #[Test]
    public function delivering_requires_a_delivering_user_and_sets_delivered_at(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5);
        $order = $this->order([[$product, 1, 15]]);

        try {
            app(OrderService::class)->changeStatus($order, OrderStatus::Delivered);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('delivered_by_user_id', $e->errors());
        }

        $order = $this->deliver($order, $this->user, 7.5);
        $this->assertSame(OrderStatus::Delivered, $order->status);
        $this->assertNotNull($order->delivered_at);
        $this->assertSame($this->user->id, $order->delivered_by_user_id);
        $this->assertEquals(7.5, (float) $order->delivery_fee);
    }

    #[Test]
    public function editing_a_pending_order_moves_only_the_difference(): void
    {
        $a = Product::factory()->create();
        $b = Product::factory()->create();
        $this->purchase($a, 10, 5);
        $this->purchase($b, 10, 5);
        $order = $this->order([[$a, 4, 15]]); // a: 6

        app(OrderService::class)->update($order, [
            'customer_name' => 'زبون', 'phone' => '0910000000',
            'items' => [
                ['product_id' => $a->id, 'qty' => 10, 'unit_price' => 15], // uses the 4 already held + 6 left
                ['product_id' => $b->id, 'qty' => 2, 'unit_price' => 20],
            ],
        ]);

        $this->assertSame(0, $a->refresh()->stock);
        $this->assertSame(8, $b->refresh()->stock);
        $this->assertEquals(190.0, (float) $order->refresh()->goods_total);
        $this->assertSame([], app(StockService::class)->audit());
    }

    #[Test]
    public function negative_adjustment_cannot_exceed_stock_and_is_valued_at_avg_cost(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 5, 4);

        $adjustment = app(StockService::class)->adjust([
            'product_id' => $product->id, 'qty' => -2, 'reason' => 'damaged',
        ]);
        $this->assertSame(3, $product->refresh()->stock);
        $this->assertEquals(8.0, $adjustment->lossValue());

        $this->expectException(ValidationException::class);
        app(StockService::class)->adjust(['product_id' => $product->id, 'qty' => -4, 'reason' => 'lost']);
    }
}
