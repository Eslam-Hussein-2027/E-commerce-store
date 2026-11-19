<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('customer_name');
            $table->string('phone', 30);
            $table->string('area')->nullable();
            $table->enum('status', ['pending', 'out_for_delivery', 'delivered', 'cancelled', 'returned'])
                ->default('pending');
            // Store revenue = goods only.
            $table->decimal('goods_total', 12, 2)->default(0);
            // Personal income of the delivering brother — never store revenue.
            $table->decimal('delivery_fee', 12, 2)->default(0);
            $table->foreignId('delivered_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->date('order_date');
            $table->dateTime('delivered_at')->nullable();
            // Idempotency guard: stock is returned at most once per order.
            $table->boolean('stock_restored')->default(false);
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'delivered_at']);
            $table->index('order_date');
            $table->index('phone');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('qty');
            $table->decimal('unit_price', 12, 2);
            // Snapshot of products.avg_cost when the item was saved.
            $table->decimal('unit_cost', 12, 4);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
