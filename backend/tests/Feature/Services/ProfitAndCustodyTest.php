<?php

namespace Tests\Feature\Services;

use App\Enums\OrderStatus;
use App\Models\CashHandover;
use App\Models\Expense;
use App\Models\Product;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\OrderService;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProfitAndCustodyTest extends TestCase
{
    use RefreshDatabase;

    private User $ali;

    private User $omar;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ali = User::factory()->create(['name' => 'علي']);
        $this->omar = User::factory()->create(['name' => 'عمر']);
        $this->actingAs($this->ali);
    }

    private function financials(): array
    {
        return app(DashboardService::class)->financials(now()->startOfMonth(), now()->endOfMonth());
    }

    #[Test]
    public function revenue_and_profit_exclude_delivery_fee(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5, $this->ali);

        // 2 × 20 = 40 goods, 15 delivery fee (personal).
        $order = $this->order([[$product, 2, 20]], ['delivery_fee' => 15]);
        $this->deliver($order, $this->omar, 15);

        $f = $this->financials();
        $this->assertEquals(40.0, $f['revenue']);
        $this->assertEquals(30.0, $f['gross_profit']);   // (20 − 5) × 2
        $this->assertEquals(30.0, $f['net_profit']);
        $this->assertSame(1, $f['orders_count']);
        $this->assertEquals(40.0, $f['avg_order_value']);

        $earnings = collect(app(DashboardService::class)->deliveryEarnings(now()->startOfMonth(), now()->endOfMonth()))
            ->keyBy('user_id');
        $this->assertEquals(15.0, $earnings[$this->omar->id]['earnings']);
        $this->assertEquals(0.0, $earnings[$this->ali->id]['earnings']);
    }

    #[Test]
    public function only_delivered_orders_count_toward_revenue(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 20, 5, $this->ali);

        $this->order([[$product, 1, 20]]);                                  // pending
        $cancelled = $this->order([[$product, 1, 20]]);
        app(OrderService::class)->changeStatus($cancelled, OrderStatus::Cancelled);
        $returned = $this->order([[$product, 1, 20]]);
        $this->deliver($returned, $this->ali);
        app(OrderService::class)->changeStatus($returned, OrderStatus::Returned);
        $this->deliver($this->order([[$product, 3, 20]]), $this->ali);     // the only counted one

        $f = $this->financials();
        $this->assertEquals(60.0, $f['revenue']);
        $this->assertEquals(45.0, $f['gross_profit']);

        $rates = app(DashboardService::class)->orderRates(now()->startOfMonth(), now()->endOfMonth());
        $this->assertSame(4, $rates['orders_created']);
        $this->assertEquals(50.0, $rates['return_rate']);
    }

    #[Test]
    public function net_profit_subtracts_expenses_and_stock_losses(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 10, 5, $this->ali);
        $this->deliver($this->order([[$product, 4, 20]]), $this->ali); // gross 60

        Expense::create(['category' => 'ads', 'amount' => 12.5, 'expense_date' => now()->toDateString(), 'paid_by_user_id' => $this->ali->id]);
        app(StockService::class)->adjust(['product_id' => $product->id, 'qty' => -2, 'reason' => 'damaged']); // loss 10

        $f = $this->financials();
        $this->assertEquals(60.0, $f['gross_profit']);
        $this->assertEquals(12.5, $f['expenses']);
        $this->assertEquals(10.0, $f['stock_losses']);
        $this->assertEquals(37.5, $f['net_profit']);
        $this->assertEquals(46.9, $f['net_margin']); // 37.5 / 80
    }

    #[Test]
    public function custody_is_collected_minus_paid_minus_handed_over(): void
    {
        $product = Product::factory()->create();
        $this->purchase($product, 20, 5, $this->ali);    // Ali paid 100
        $this->purchase($product, 10, 5, $this->omar);   // Omar paid 50

        // Ali delivers 2 orders: 3×30 + 2×30 = 150 goods (+ fees that must NOT count)
        $this->deliver($this->order([[$product, 3, 30]], ['delivery_fee' => 10]), $this->ali, 10);
        $this->deliver($this->order([[$product, 2, 30]], ['delivery_fee' => 10]), $this->ali, 10);
        // Omar delivers 1 order of 60, later returned → excluded
        $returned = $this->order([[$product, 2, 30]]);
        $this->deliver($returned, $this->omar, 5);
        app(OrderService::class)->changeStatus($returned, OrderStatus::Returned);
        // Pending order delivered by nobody → excluded
        $this->order([[$product, 1, 30]]);

        Expense::create(['category' => 'packaging', 'amount' => 20, 'expense_date' => now()->toDateString(), 'paid_by_user_id' => $this->ali->id]);
        CashHandover::create(['user_id' => $this->ali->id, 'amount' => 25, 'handed_at' => now()]);

        $custody = collect(app(DashboardService::class)->custody())->keyBy('user_id');

        // Ali: 150 − 100 − 20 − 25 = 5
        $this->assertEquals(150.0, $custody[$this->ali->id]['collected']);
        $this->assertEquals(5.0, $custody[$this->ali->id]['balance']);
        // Omar: 0 − 50 = −50 (store owes him)
        $this->assertEquals(-50.0, $custody[$this->omar->id]['balance']);
    }
}
