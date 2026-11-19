<?php

namespace App\Providers;

use App\Models\Order;
use App\Models\Purchase;
use App\Models\StockAdjustment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Short, stable names stored in stock_movements.reference_type.
        Relation::enforceMorphMap([
            'purchase' => Purchase::class,
            'order' => Order::class,
            'adjustment' => StockAdjustment::class,
        ]);

        // Catch N+1 queries during development and tests.
        Model::preventLazyLoading(! $this->app->isProduction());

        JsonResource::withoutWrapping();
    }
}
