<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_handovers', function (Blueprint $table) {
            $table->id();
            // The brother who handed cash to the shared store box.
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->dateTime('handed_at');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('handed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_handovers');
    }
};
