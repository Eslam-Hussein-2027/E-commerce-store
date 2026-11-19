<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CashHandoverController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PartnerController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::put('password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('dashboard', DashboardController::class);
    Route::get('dashboard/custody', [DashboardController::class, 'custody']);
    Route::get('users', [UserController::class, 'index']);

    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('products', ProductController::class);
    Route::apiResource('purchases', PurchaseController::class)->except('update');

    Route::apiResource('orders', OrderController::class)->except('destroy');
    Route::patch('orders/{order}/status', [OrderController::class, 'updateStatus']);

    Route::apiResource('expenses', ExpenseController::class);
    Route::apiResource('partners', PartnerController::class);
    Route::apiResource('cash-handovers', CashHandoverController::class);
    Route::apiResource('stock-adjustments', StockAdjustmentController::class)->only(['index', 'store', 'show']);
    Route::get('stock-movements', [StockMovementController::class, 'index']);
});
