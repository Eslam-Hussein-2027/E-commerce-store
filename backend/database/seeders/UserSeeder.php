<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * - إسلام: the only login account. CHANGE THE PASSWORD after the first login (الحساب ← تغيير كلمة المرور).
 * - محمد: no email / no password → cannot log in, but appears in every "who delivered / who paid" list
 *         and has his own cash custody.
 *
 * Safe to run again: it never resets a changed password.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(['email' => 'eslam@store.local'], ['name' => 'إسلام', 'password' => 'password']);

        $mohamed = User::query()->where('email', 'mohamed@store.local')->first()
            ?? User::query()->whereNull('email')->where('name', 'محمد')->first()
            ?? new User;

        $mohamed->forceFill(['name' => 'محمد', 'email' => null, 'password' => null, 'remember_token' => null])->save();
    }
}
