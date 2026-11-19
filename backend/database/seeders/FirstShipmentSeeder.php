<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Expense;
use App\Models\Order;
use App\Models\Partner;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\User;
use App\Services\PurchaseService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * The real first shipment (from the brothers' purchase sheet), on an empty database:
 *   php artisan db:seed --class=FirstShipmentSeeder --force
 *
 * - Unit cost = "total unit cost" column (goods + shipping) in USD × 10.
 * - Paid from the partners' capital (paid_by = NULL) → no brother's cash custody changes.
 * - Capital 133,100 LYD vs. item costs 132,918 LYD: the 182 LYD rounding gap is recorded
 *   as an expense so the books match the sheet (expected profit 90,550 LYD).
 */
class FirstShipmentSeeder extends Seeder
{
    private const USD_TO_LYD = 10;

    /** [category, product, qty, total unit cost (USD, incl. shipping), sell price (LYD)] */
    private const ITEMS = [
        ['سكوترات', 'سكوتر كهربائي', 22, 181.5, 2500],
        ['باور ستيشن', 'باور ستيشن 300 وات', 8, 103.5, 2000],
        ['باور ستيشن', 'باور ستيشن 600 وات', 12, 156.5, 2500],
        ['باور ستيشن', 'باور ستيشن 1200 وات', 9, 210, 3300],
        ['أجهزة منزلية', 'ماكينة قهوة', 48, 21, 400],
        ['أجهزة منزلية', 'مكيف صغير محمول', 48, 3.5, 100],
        ['أجهزة منزلية', 'جهاز تدليك', 96, 5.3, 200],
        ['كاميرات مراقبة', 'كاميرا مراقبة ثلاثية', 48, 29.5, 500],
        ['أحواض سباحة', 'حوض سباحة 3.05 متر', 20, 22.6, 400],
        ['أحواض سباحة', 'حوض سباحة 2.62 متر', 15, 18.3, 350],
        ['أحواض سباحة', 'حوض سباحة 2 متر', 15, 16.2, 300],
        ['أحواض سباحة', 'حوض سباحة 3 متر بقواعد', 10, 56.5, 800],
        ['أحواض سباحة', 'نفاخة كهربائية', 50, 1.35, 0], // given away free with pools
    ];

    /** [name, capital (LYD), note] */
    private const PARTNERS = [
        ['محمد', 99100, 'البضاعة 7,960$ + الشحن 1,950$'],
        ['إسلام', 14000, '1,400$'],
        ['الحرابي', 20000, 'ممول فقط — 2,000$'],
    ];

    public function run(): void
    {
        $this->call(UserSeeder::class);

        if (Product::query()->exists() || Purchase::query()->exists() || Order::query()->exists()) {
            $this->command?->warn('Database is not empty - first shipment NOT added (run migrate:fresh first).');

            return;
        }

        Auth::guard('web')->setUser(User::query()->where('email', 'eslam@store.local')->first() ?? User::query()->first());

        DB::transaction(function () {
            $items = [];
            foreach (self::ITEMS as [$categoryName, $name, $qty, $unitCostUsd, $sellPrice]) {
                $category = Category::firstOrCreate(['name' => $categoryName]);
                $product = Product::create([
                    'name' => $name,
                    'category_id' => $category->id,
                    'sell_price' => $sellPrice,
                    'reorder_level' => $sellPrice >= 1000 ? 3 : 5,
                    'is_active' => true,
                ]);
                $items[] = ['product_id' => $product->id, 'qty' => $qty, 'unit_cost' => round($unitCostUsd * self::USD_TO_LYD, 2)];
            }

            $purchase = app(PurchaseService::class)->create([
                'supplier' => null,
                'purchase_date' => now()->toDateString(),
                'paid_by_user_id' => null, // partners' capital
                'note' => 'الشحنة الأولى — تكلفة القطعة شاملة الشحن (1$ = 10 د.ل)، مموّلة من رأس مال الشركاء',
                'items' => $items,
            ]);

            $capital = array_sum(array_column(self::PARTNERS, 1));
            $gap = round($capital - (float) $purchase->total_cost, 2);
            if ($gap > 0) {
                Expense::create([
                    'category' => 'other',
                    'amount' => $gap,
                    'expense_date' => now()->toDateString(),
                    'paid_by_user_id' => null,
                    'note' => "فرق تقريب تكلفة الشحنة الأولى: رأس المال {$capital} − تكلفة الأصناف {$purchase->total_cost}",
                ]);
            }

            foreach (self::PARTNERS as [$name, $amount, $note]) {
                Partner::firstOrCreate(['name' => $name], ['capital' => $amount, 'note' => $note]);
            }
        });

        Auth::guard('web')->forgetUser();
        $this->command?->info('First shipment added: 13 products, 1 purchase, 3 partners.');
    }
}
