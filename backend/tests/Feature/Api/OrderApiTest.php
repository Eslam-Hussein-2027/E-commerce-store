<?php

namespace Tests\Feature\Api;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    private function stockedProduct(int $qty = 10, float $cost = 5): Product
    {
        $product = Product::factory()->create(['name' => 'حقيبة', 'sell_price' => 25]);
        $this->postJson('/api/purchases', [
            'supplier' => 'مورد',
            'purchase_date' => now()->toDateString(),
            'paid_by_user_id' => $this->user->id,
            'items' => [['product_id' => $product->id, 'qty' => $qty, 'unit_cost' => $cost]],
        ])->assertCreated()->assertJsonPath('total_cost', fn ($v) => $v == $qty * $cost);

        return $product->refresh();
    }

    private function orderPayload(Product $product, int $qty): array
    {
        return [
            'customer_name' => 'سالم',
            'phone' => '0921234567',
            'area' => 'بنغازي',
            'delivery_fee' => 10,
            'items' => [['product_id' => $product->id, 'qty' => $qty, 'unit_price' => 25]],
        ];
    }

    #[Test]
    public function stock_and_avg_cost_cannot_be_set_through_the_product_api(): void
    {
        $id = $this->postJson('/api/products', [
            'name' => 'منتج', 'sell_price' => 10, 'stock' => 999, 'avg_cost' => 1,
        ])->assertCreated()->assertJsonPath('stock', 0)->json('id');

        $this->assertSame(0, Product::find($id)->stock);

        $this->putJson("/api/products/{$id}", ['name' => 'منتج', 'sell_price' => 12, 'stock' => 50])
            ->assertOk()->assertJsonPath('stock', 0);
    }

    #[Test]
    public function product_name_must_be_unique_and_no_sku_is_needed(): void
    {
        $this->postJson('/api/products', ['name' => 'ساعة', 'sell_price' => 50])
            ->assertCreated()
            ->assertJsonMissingPath('sku');

        $this->postJson('/api/products', ['name' => 'ساعة', 'sell_price' => 60])
            ->assertStatus(422)
            ->assertJsonPath('errors.name.0', 'قيمة الاسم مستخدمة من قبل.');
    }

    #[Test]
    public function creating_an_order_through_the_api_deducts_stock(): void
    {
        $product = $this->stockedProduct();

        $this->postJson('/api/orders', $this->orderPayload($product, 4))
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('goods_total', 100)
            ->assertJsonPath('items.0.unit_cost', 5);

        $this->assertSame(6, $product->refresh()->stock);
    }

    #[Test]
    public function insufficient_stock_returns_422_with_arabic_message(): void
    {
        $product = $this->stockedProduct(3);

        $this->postJson('/api/orders', $this->orderPayload($product, 5))
            ->assertStatus(422)
            ->assertJsonPath('errors', fn ($errors) => str_contains($errors['items.0.qty'][0], 'أكبر من المتوفر في المخزون (3)'))
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'حقيبة'));

        $this->assertSame(3, $product->refresh()->stock);
        $this->assertDatabaseCount('orders', 0);
    }

    #[Test]
    public function status_endpoint_restores_stock_once_and_rejects_repeat(): void
    {
        $product = $this->stockedProduct();
        $orderId = $this->postJson('/api/orders', $this->orderPayload($product, 4))->json('id');

        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])
            ->assertOk()->assertJsonPath('status', 'cancelled')->assertJsonPath('status_label', 'ملغي');
        $this->assertSame(10, $product->refresh()->stock);

        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'cancelled'])->assertStatus(422);
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'returned'])->assertStatus(422);
        $this->assertSame(10, $product->refresh()->stock);
    }

    #[Test]
    public function delivering_requires_delivered_by(): void
    {
        $product = $this->stockedProduct();
        $orderId = $this->postJson('/api/orders', $this->orderPayload($product, 1))->json('id');

        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'delivered'])
            ->assertStatus(422)
            ->assertJsonPath('errors.delivered_by_user_id.0', 'يجب تحديد من قام بالتوصيل عند تأكيد التسليم.');

        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'delivered', 'delivered_by_user_id' => $this->user->id])
            ->assertOk()
            ->assertJsonPath('delivered_by.id', $this->user->id)
            ->assertJsonPath('allowed_transitions', ['returned']);
    }

    #[Test]
    public function dashboard_returns_all_sections_and_excludes_delivery_fee(): void
    {
        $product = $this->stockedProduct();
        $orderId = $this->postJson('/api/orders', $this->orderPayload($product, 2))->json('id');
        $this->patchJson("/api/orders/{$orderId}/status", [
            'status' => 'delivered', 'delivered_by_user_id' => $this->user->id, 'delivery_fee' => 10,
        ])->assertOk();

        $res = $this->getJson('/api/dashboard?from='.now()->startOfMonth()->toDateString().'&to='.now()->toDateString())
            ->assertOk()
            ->assertJsonStructure([
                'period', 'kpis' => ['revenue', 'gross_profit', 'expenses', 'net_profit', 'net_margin', 'stock_value',
                    'orders_count', 'avg_order_value', 'return_rate'],
                'custody', 'monthly', 'top_products_by_qty', 'top_products_by_profit', 'low_stock',
                'dead_stock', 'sales_by_area', 'top_customers', 'delivery_earnings' => ['rows'],
            ]);

        $this->assertEquals(50, $res->json('kpis.revenue'));       // 2 × 25, no delivery fee
        $this->assertEquals(40, $res->json('kpis.gross_profit'));  // (25 − 5) × 2
        $this->assertEquals(40, $res->json('kpis.stock_value'));   // 8 × 5
        $this->assertCount(12, $res->json('monthly'));
        $this->assertEquals(10, $res->json('delivery_earnings.rows.0.earnings'));
        // Custody: collected 50 − purchase paid 50 = 0 (fee not included)
        $this->assertEquals(0, $res->json('custody.0.balance'));
    }

    #[Test]
    public function purchase_cannot_be_deleted_after_its_stock_was_sold(): void
    {
        $product = $this->stockedProduct(5);
        $purchaseId = \App\Models\Purchase::first()->id;
        $this->postJson('/api/orders', $this->orderPayload($product, 2))->assertCreated();

        $this->deleteJson("/api/purchases/{$purchaseId}")->assertStatus(422);
        $this->assertSame(3, $product->refresh()->stock);
    }
}
