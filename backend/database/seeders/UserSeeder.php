<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The two brothers. CHANGE THESE PASSWORDS after the first login (الحساب ← تغيير كلمة المرور).
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(['email' => 'ahmed@store.local'], ['name' => 'أحمد', 'password' => 'password']);
        User::updateOrCreate(['email' => 'mohamed@store.local'], ['name' => 'محمد', 'password' => 'password']);
    }
}
