<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(UserSeeder::class);

        // Demo data for trying out the dashboard. Skip in a real install with:
        //   php artisan db:seed --class=UserSeeder
        $this->call(DemoDataSeeder::class);
    }
}
