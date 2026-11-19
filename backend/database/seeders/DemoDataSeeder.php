<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Models\CashHandover;
use App\Models\Category;
use App\Models\Expense;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\OrderService;
use App\Services\PurchaseService;
use App\Services\StockService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

/**
 * Simulates ~12 months of store activity by moving the clock day by day and
 * calling the real services, so stock ledger, average cost and profit
 * snapshots are fully consistent. Deterministic (fixed random seed).
 */
class DemoDataSeeder extends Seeder
{
    private const CATALOG = [
        'عطور' => [
            ['PER-001', 'عطر عود ملكي 100 مل', 180, 110],
            ['PER-002', 'عطر فانيلا 50 مل', 95, 55],
            ['PER-003', 'بخور معطر (علبة)', 45, 24],
        ],
        'ساعات' => [
            ['WAT-001', 'ساعة كلاسيك رجالية', 150, 92],
            ['WAT-002', 'ساعة رياضية ذكية', 220, 138],
        ],
        'حقائب' => [
            ['BAG-001', 'حقيبة يد جلد', 175, 100],
            ['BAG-002', 'حقيبة ظهر', 85, 48],
            ['BAG-003', 'محفظة رجالية', 60, 30],
        ],
        'إكسسوارات' => [
            ['ACC-001', 'نظارة شمسية', 70, 35],
            ['ACC-002', 'سوار فضة', 55, 25],
            ['ACC-003', 'خاتم فضة', 40, 18],
        ],
        'إلكترونيات' => [
            ['ELE-001', 'سماعات بلوتوث', 95, 55],
            ['ELE-002', 'شاحن سريع 20 واط', 35, 18],
            ['ELE-003', 'باور بانك 10000', 75, 42],
            ['ELE-004', 'حامل جوال للسيارة', 25, 10],
        ],
    ];

    /** Never sold → shows up as dead stock. */
    private const DEAD_SKUS = ['ACC-003', 'ELE-004'];

    private const AREAS = ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'تاجوراء', 'جنزور', 'سوق الجمعة', 'عين زارة'];

    private const FIRST_NAMES = ['سالم', 'خالد', 'فاطمة', 'مريم', 'عبدالله', 'يوسف', 'هند', 'نورا', 'طارق', 'سارة',
        'إبراهيم', 'آمنة', 'مصطفى', 'رحاب', 'أسامة', 'ليلى', 'حمزة', 'منى', 'عمر', 'خديجة'];

    private const LAST_NAMES = ['الورفلي', 'المصراتي', 'الزوي', 'الترهوني', 'البرعصي', 'الغرياني', 'الفيتوري', 'العبيدي'];

    private array $brothers;

    private array $customers = [];

    public function run(): void
    {
        mt_srand(20261119);

        $this->brothers = User::query()->orderBy('id')->take(2)->get()->all();
        $orders = app(OrderService::class);
        $purchases = app(PurchaseService::class);
        $stock = app(StockService::class);

        $this->buildCustomers();

        $today = CarbonImmutable::today();
        $start = $today->subMonths(11)->startOfMonth();

        // --- Catalog + opening stock --------------------------------------
        $this->travel($start->setTime(9, 0), $this->brothers[0]);
        $products = $this->createCatalog();
        $purchases->create([
            'supplier' => 'مورد الجملة - طرابلس',
            'purchase_date' => $start->toDateString(),
            'paid_by_user_id' => $this->brothers[0]->id,
            'note' => 'بضاعة افتتاحية',
            'items' => collect($products)->map(fn (Product $p) => [
                'product_id' => $p->id,
                'qty' => in_array($p->sku, self::DEAD_SKUS, true) ? 12 : mt_rand(25, 40),
                'unit_cost' => $this->costFor($p),
            ])->values()->all(),
        ]);

        $sellable = collect($products)->reject(fn (Product $p) => in_array($p->sku, self::DEAD_SKUS, true))->values();
        $queue = []; // [resolve_date, order_id, final_status, brother_index]

        for ($day = $start; $day->lte($today); $day = $day->addDay()) {
            $daysAgo = $day->diffInDays($today);
            $growth = 1 + (365 - $daysAgo) / 365; // business grows over the year

            // Monthly / periodic expenses
            if ($day->day === 1) {
                $this->expense($day, 'ads', mt_rand(150, 320), 'حملة إعلانات فيسبوك وإنستغرام');
            }
            if ($day->day === 3 || $day->day === 17) {
                $this->expense($day, 'packaging', mt_rand(30, 70), 'أكياس وعلب تغليف');
            }
            if ($day->day === 25 && mt_rand(0, 2) === 0) {
                $this->expense($day, 'other', mt_rand(20, 60), 'طباعة ملصقات');
            }

            // Restock weekly (Saturdays)
            if ($day->isSaturday()) {
                $this->restock($purchases, $sellable, $day);
            }

            // New orders
            $count = mt_rand(0, (int) round(2 * $growth));
            for ($i = 0; $i < $count; $i++) {
                $order = $this->newOrder($orders, $sellable, $day->setTime(mt_rand(9, 21), mt_rand(0, 59)));
                if (! $order) {
                    continue;
                }

                $roll = mt_rand(1, 100);
                $final = match (true) {
                    $roll <= 82 => OrderStatus::Delivered,
                    $roll <= 91 => OrderStatus::Cancelled,
                    default => OrderStatus::Returned,
                };
                $queue[] = [$day->addDays(mt_rand(1, 3)), $order->id, $final, mt_rand(0, 1)];
            }

            // Resolve orders due today (unless they are in the future)
            foreach ($queue as $k => [$due, $orderId, $final, $b]) {
                if ($due->gt($day)) {
                    continue;
                }
                unset($queue[$k]);
                $this->settleOrder($orders, Order::find($orderId), $final, $this->brothers[$b], $day->setTime(19, mt_rand(0, 59)));
            }

            // Occasional stock problems
            if (mt_rand(1, 45) === 1) {
                $this->travel($day->setTime(20, 0), $this->brothers[mt_rand(0, 1)]);
                $p = $sellable->random()->refresh();
                if ($p->stock > 2) {
                    $reason = ['damaged', 'lost', 'count_correction'][mt_rand(0, 2)];
                    $stock->adjust([
                        'product_id' => $p->id,
                        'qty' => $reason === 'count_correction' && mt_rand(0, 1) ? 1 : -mt_rand(1, 2),
                        'reason' => $reason,
                        'note' => $reason === 'damaged' ? 'تلف أثناء النقل' : null,
                    ]);
                }
            }

            // Cash handovers every 10 days
            if ($day->day % 10 === 0) {
                $this->handovers($day);
            }
        }

        // Leave the most recent orders open (pending / out for delivery) so lists look real.
        foreach ($queue as [$due, $orderId, $final, $b]) {
            if (mt_rand(0, 1)) {
                $this->travel($today->setTime(12, 0), $this->brothers[$b]);
                $orders->changeStatus(Order::find($orderId), OrderStatus::OutForDelivery, ['delivered_by_user_id' => $this->brothers[$b]->id]);
            }
        }

        // A few fresh orders still being prepared today.
        for ($i = 0; $i < 3; $i++) {
            $this->newOrder($orders, $sellable, $today->setTime(8 + $i, mt_rand(0, 59)));
        }

        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        Auth::guard('web')->forgetUser();
    }

    private function travel(CarbonImmutable $at, User $as): void
    {
        Carbon::setTestNow($at);
        CarbonImmutable::setTestNow($at);
        Auth::guard('web')->setUser($as);
    }

    private function createCatalog(): array
    {
        $products = [];
        foreach (self::CATALOG as $categoryName => $items) {
            $category = Category::create(['name' => $categoryName]);
            foreach ($items as [$sku, $name, $price]) {
                $products[] = Product::create([
                    'name' => $name,
                    'sku' => $sku,
                    'category_id' => $category->id,
                    'sell_price' => $price,
                    'reorder_level' => $price >= 150 ? 3 : 5,
                    'is_active' => true,
                ]);
            }
        }

        return $products;
    }

    private function costFor(Product $p): float
    {
        foreach (self::CATALOG as $items) {
            foreach ($items as [$sku, , , $cost]) {
                if ($sku === $p->sku) {
                    // ±12% supplier price variation → the weighted average moves over time.
                    return round($cost * mt_rand(88, 112) / 100, 2);
                }
            }
        }

        return 10;
    }

    private function restock(PurchaseService $purchases, $sellable, CarbonImmutable $day): void
    {
        $needs = $sellable->map->refresh()
            // Keep the smart watch running low to demonstrate the low-stock list.
            ->filter(fn (Product $p) => $p->sku !== 'WAT-002' && $p->stock <= $p->reorder_level + 6)
            ->values();

        if ($needs->isEmpty()) {
            return;
        }

        $payer = $this->brothers[mt_rand(0, 1)];
        $this->travel($day->setTime(10, 0), $payer);

        $purchases->create([
            'supplier' => ['مورد الجملة - طرابلس', 'مستورد بنغازي', 'شركة النور للتوريد'][mt_rand(0, 2)],
            'purchase_date' => $day->toDateString(),
            'paid_by_user_id' => $payer->id,
            'items' => $needs->map(fn (Product $p) => [
                'product_id' => $p->id,
                'qty' => mt_rand(15, 30),
                'unit_cost' => $this->costFor($p),
            ])->all(),
        ]);
    }

    private function newOrder(OrderService $orders, $sellable, CarbonImmutable $at): ?Order
    {
        $this->travel($at, $this->brothers[mt_rand(0, 1)]);

        $lines = [];
        foreach ($sellable->random(mt_rand(1, 3)) as $p) {
            $p->refresh();
            $qty = min(mt_rand(1, 3), $p->stock);
            if ($qty < 1) {
                continue;
            }
            // Occasional discount
            $price = mt_rand(1, 6) === 1 ? round($p->sell_price * 0.9, 2) : (float) $p->sell_price;
            $lines[] = ['product_id' => $p->id, 'qty' => $qty, 'unit_price' => $price];
        }

        if (! $lines) {
            return null;
        }

        $customer = $this->pickCustomer();

        return $orders->create([
            'customer_name' => $customer['name'],
            'phone' => $customer['phone'],
            'area' => $customer['area'],
            'delivery_fee' => [10, 10, 15, 15, 20][mt_rand(0, 4)],
            'order_date' => $at->toDateString(),
            'items' => $lines,
        ]);
    }

    private function settleOrder(OrderService $orders, Order $order, OrderStatus $final, User $brother, CarbonImmutable $at): void
    {
        $this->travel($at, $brother);

        if ($final === OrderStatus::Cancelled) {
            $orders->changeStatus($order, OrderStatus::Cancelled);

            return;
        }

        $orders->changeStatus($order, OrderStatus::OutForDelivery, ['delivered_by_user_id' => $brother->id]);
        $orders->changeStatus($order, OrderStatus::Delivered, ['delivered_by_user_id' => $brother->id]);

        if ($final === OrderStatus::Returned) {
            $this->travel($at->addHour(), $brother);
            $orders->changeStatus($order, OrderStatus::Returned);
        }
    }

    private function expense(CarbonImmutable $day, string $category, float $amount, string $note): void
    {
        $payer = $this->brothers[mt_rand(0, 1)];
        $this->travel($day->setTime(13, 0), $payer);
        Expense::create([
            'category' => $category,
            'amount' => $amount,
            'expense_date' => $day->toDateString(),
            'paid_by_user_id' => $payer->id,
            'note' => $note,
        ]);
    }

    private function handovers(CarbonImmutable $day): void
    {
        foreach (app(DashboardService::class)->custody() as $row) {
            if ($row['balance'] >= 200) {
                $brother = collect($this->brothers)->firstWhere('id', $row['user_id']);
                $this->travel($day->setTime(21, 0), $brother);
                CashHandover::create([
                    'user_id' => $brother->id,
                    'amount' => floor($row['balance'] * 0.7 / 10) * 10,
                    'handed_at' => $day->setTime(21, 0),
                    'note' => 'تسليم للصندوق',
                ]);
            }
        }
    }

    private function buildCustomers(): void
    {
        for ($i = 0; $i < 45; $i++) {
            $this->customers[] = [
                'name' => self::FIRST_NAMES[$i % count(self::FIRST_NAMES)].' '.self::LAST_NAMES[mt_rand(0, count(self::LAST_NAMES) - 1)],
                'phone' => '09'.[1, 2, 4][mt_rand(0, 2)].sprintf('%07d', mt_rand(1000000, 9999999)),
                'area' => self::AREAS[mt_rand(0, count(self::AREAS) - 1)],
            ];
        }
    }

    /** 20% of orders come from a small loyal group, so repeat buyers stand out. */
    private function pickCustomer(): array
    {
        $index = mt_rand(1, 5) === 1 ? mt_rand(0, 7) : mt_rand(0, count($this->customers) - 1);

        return $this->customers[$index];
    }
}
