<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Only one brother logs in. The other is a "partner without login": he still
 * delivers orders, pays purchases/expenses and holds cash custody, so he stays
 * in `users`, but with no email and no password (he can never authenticate).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();
        });

        // Convert the previously seeded login of the second brother.
        $id = DB::table('users')->where('email', 'mohamed@store.local')->value('id');
        if ($id) {
            DB::table('users')->where('id', $id)->update(['email' => null, 'password' => null, 'remember_token' => null]);
            DB::table('sessions')->where('user_id', $id)->delete();
        }
    }

    public function down(): void
    {
        DB::table('users')->whereNull('email')->orderBy('id')->each(function ($user) {
            DB::table('users')->where('id', $user->id)->update(['email' => "user{$user->id}@store.local"]);
        });
        DB::table('users')->whereNull('password')->update(['password' => bcrypt(bin2hex(random_bytes(16)))]);

        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};
