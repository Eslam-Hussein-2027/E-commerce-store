<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SKU was removed from the product model. Existing databases created with the
 * earlier schema get the column (and its unique index) dropped here; data is kept.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'sku')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['sku']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sku');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'sku')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            $table->string('sku')->nullable()->unique()->after('name');
        });
    }
};
