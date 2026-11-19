<?php

namespace Tests;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use App\Services\OrderService;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Safety net: with a cached config (`php artisan optimize` in production)
     * Laravel ignores phpunit.xml and would run RefreshDatabase against the
     * REAL database. Refuse to start before the app (and RefreshDatabase) boots.
     */
    protected function setUp(): void
    {
        if (is_file(dirname(__DIR__).'/bootstrap/cache/config.php')) {
            throw new \RuntimeException(
                'Config is cached — tests would hit the real database. Run `php artisan config:clear` first, '
                .'then `php artisan optimize` again after the tests.'
            );
        }

        parent::setUp();

        if (! $this->app->environment('testing')) {
            throw new \RuntimeException('Tests must run with APP_ENV=testing.');
        }
    }

    protected function purchase(Product $product, int $qty, float $unitCost, ?User $paidBy = null): Purchase
    {
        return app(PurchaseService::class)->create([
            'supplier' => 'مورد تجريبي',
            'purchase_date' => now()->toDateString(),
            'paid_by_user_id' => ($paidBy ?? auth()->user())->id,
            'items' => [['product_id' => $product->id, 'qty' => $qty, 'unit_cost' => $unitCost]],
        ]);
    }

    /**
     * @param  array<int, array{0: Product, 1: int, 2: float}>  $lines  [product, qty, unit_price]
     */
    protected function order(array $lines, array $overrides = []): Order
    {
        return app(OrderService::class)->create(array_merge([
            'customer_name' => 'زبون تجريبي',
            'phone' => '0912345678',
            'area' => 'طرابلس',
            'delivery_fee' => 0,
            'items' => array_map(fn ($l) => [
                'product_id' => $l[0]->id, 'qty' => $l[1], 'unit_price' => $l[2],
            ], $lines),
        ], $overrides));
    }

    protected function deliver(Order $order, User $by, float $deliveryFee = 0): Order
    {
        return app(OrderService::class)->changeStatus($order, OrderStatus::Delivered, [
            'delivered_by_user_id' => $by->id,
            'delivery_fee' => $deliveryFee,
        ]);
    }
}
