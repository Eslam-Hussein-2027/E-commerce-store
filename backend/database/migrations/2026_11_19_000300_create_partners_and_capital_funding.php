<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * - partners: capital owners. Profit share = partner capital / total capital.
 *   A partner may be a financier only (no login, never delivers or pays).
 * - purchases/expenses.paid_by_user_id becomes nullable: NULL = paid from the
 *   partners' capital / shared store box, so no brother's cash custody changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('capital', 12, 2)->default(0);
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->unsignedBigInteger('paid_by_user_id')->nullable()->change();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedBigInteger('paid_by_user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partners');
        // paid_by_user_id stays nullable: rows paid from capital have no user to restore.
    }
};
