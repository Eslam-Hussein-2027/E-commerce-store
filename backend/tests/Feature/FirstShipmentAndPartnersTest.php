<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\Partner;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\StockService;
use Database\Seeders\FirstShipmentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FirstShipmentAndPartnersTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function first_shipment_matches_the_purchase_sheet(): void
    {
        $this->seed(FirstShipmentSeeder::class);

        $this->assertSame(13, Product::count());
        $this->assertSame(1, Purchase::count());

        $purchase = Purchase::first();
        $this->assertNull($purchase->paid_by_user_id);                 // from capital
        $this->assertEquals(132918.00, (float) $purchase->total_cost);   // Σ qty × unit cost × 10
        $this->assertEquals(182.00, (float) Expense::sum('amount'));     // 133,100 − 132,918

        $scooter = Product::where('name', 'سكوتر كهربائي')->first();
        $this->assertSame(22, $scooter->stock);
        $this->assertEquals(1815, (float) $scooter->avg_cost);
        $this->assertEquals(2500, (float) $scooter->sell_price);
        $this->assertEquals(0, (float) Product::where('name', 'نفاخة كهربائية')->value('sell_price'));
        $this->assertSame([], app(StockService::class)->audit());

        // Selling everything at list price = 223,650 → profit 90,550 (as on the sheet).
        $p = app(DashboardService::class)->partners(0);
        $this->assertEquals(133100, $p['total_capital']);
        $this->assertEquals(223650, $p['stock_sales_value']);
        $this->assertEquals(223650, $p['expected_pool']);
        $rows = collect($p['rows'])->keyBy('name');
        $this->assertEquals(74.46, $rows['محمد']['share_percent']);
        $this->assertEquals(166519.27, $rows['محمد']['expected_total']);
        $this->assertEquals(23524.42, $rows['إسلام']['expected_total']);
        $this->assertEquals(33606.31, $rows['الحرابي']['expected_total']);

        // Capital-funded purchase must not touch anyone's cash custody.
        foreach (app(DashboardService::class)->custody() as $c) {
            $this->assertEquals(0, $c['balance']);
        }
    }

    #[Test]
    public function first_shipment_is_never_added_twice(): void
    {
        $this->seed(FirstShipmentSeeder::class);
        $this->seed(FirstShipmentSeeder::class);

        $this->assertSame(13, Product::count());
        $this->assertSame(1, Purchase::count());
        $this->assertSame(3, Partner::count());
        $this->assertSame(2, User::count());
    }

    #[Test]
    public function partners_api_returns_shares_from_capital(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/api/partners', ['name' => 'أ', 'capital' => 300])->assertCreated();
        $this->postJson('/api/partners', ['name' => 'ب', 'capital' => 100])->assertCreated();
        $this->postJson('/api/partners', ['name' => 'ب', 'capital' => 5])->assertStatus(422);

        $this->getJson('/api/partners')
            ->assertOk()
            ->assertJsonPath('summary.total_capital', 400)
            ->assertJsonPath('data.0.share_percent', 75)
            ->assertJsonPath('data.1.share_percent', 25);
    }

    #[Test]
    public function purchase_and_expense_can_be_paid_from_capital(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $product = Product::factory()->create();

        $this->postJson('/api/purchases', [
            'purchase_date' => now()->toDateString(),
            'paid_by_user_id' => null,
            'items' => [['product_id' => $product->id, 'qty' => 4, 'unit_cost' => 10]],
        ])->assertCreated()->assertJsonPath('paid_by', null);

        $this->postJson('/api/expenses', [
            'category' => 'ads', 'amount' => 25, 'expense_date' => now()->toDateString(), 'paid_by_user_id' => '',
        ])->assertCreated()->assertJsonPath('paid_by', null);

        $custody = collect(app(DashboardService::class)->custody())->keyBy('user_id');
        $this->assertEquals(0, $custody[$user->id]['balance']);
        $this->assertSame(4, $product->refresh()->stock);
    }
}
