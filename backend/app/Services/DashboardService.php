<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * All dashboard KPIs.
 *
 * Revenue rules:
 *  - Only DELIVERED orders count, dated by delivered_at.
 *  - Revenue = goods_total only. delivery_fee is the delivering brother's personal
 *    money and is never part of revenue, profit or cash custody.
 *  - Net profit = gross profit − expenses − stock losses (negative adjustments at avg cost).
 */
class DashboardService
{
    private const DEAD_STOCK_DAYS = 60;

    public function build(CarbonInterface $from, CarbonInterface $to): array
    {
        $from = CarbonImmutable::instance($from)->startOfDay();
        $to = CarbonImmutable::instance($to)->endOfDay();
        $now = CarbonImmutable::now();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => array_merge(
                $this->financials($from, $to),
                $this->orderRates($from, $to),
                ['stock_value' => $this->stockValue()],
            ),
            'custody' => $this->custody(),
            'monthly' => $this->monthly(12),
            'top_products_by_qty' => $this->topProducts($from, $to, 'qty'),
            'top_products_by_profit' => $this->topProducts($from, $to, 'profit'),
            'low_stock' => $this->lowStock(),
            'dead_stock' => $this->deadStock(),
            'sales_by_area' => $this->salesByArea($from, $to),
            'top_customers' => $this->topCustomers(),
            'delivery_earnings' => [
                'from' => $now->startOfMonth()->toDateString(),
                'to' => $now->endOfMonth()->toDateString(),
                'rows' => $this->deliveryEarnings($now->startOfMonth(), $now->endOfMonth()),
            ],
        ];
    }

    /**
     * Revenue, gross profit, expenses, stock losses, net profit, margins, orders, AOV.
     */
    public function financials(CarbonInterface $from, CarbonInterface $to): array
    {
        $delivered = $this->deliveredOrders($from, $to);

        $revenue = (float) (clone $delivered)->sum('goods_total');
        $ordersCount = (clone $delivered)->count();

        $items = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::Delivered->value)
            ->whereBetween('orders.delivered_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(order_items.qty * order_items.unit_cost), 0) as cogs')
            ->selectRaw('COALESCE(SUM((order_items.unit_price - order_items.unit_cost) * order_items.qty), 0) as gross_profit')
            ->first();

        $grossProfit = (float) $items->gross_profit;
        $expenses = (float) DB::table('expenses')
            ->whereBetween('expense_date', [$from, $to])
            ->sum('amount');
        $stockLosses = $this->stockLosses($from, $to);
        $netProfit = $grossProfit - $expenses - $stockLosses;

        return [
            'revenue' => round($revenue, 2),
            'cogs' => round((float) $items->cogs, 2),
            'gross_profit' => round($grossProfit, 2),
            'expenses' => round($expenses, 2),
            'stock_losses' => round($stockLosses, 2),
            'net_profit' => round($netProfit, 2),
            'gross_margin' => $revenue > 0 ? round($grossProfit / $revenue * 100, 1) : 0.0,
            'net_margin' => $revenue > 0 ? round($netProfit / $revenue * 100, 1) : 0.0,
            'orders_count' => $ordersCount,
            'avg_order_value' => $ordersCount > 0 ? round($revenue / $ordersCount, 2) : 0.0,
        ];
    }

    /** Losses from negative stock adjustments, valued at the avg cost snapshot. */
    public function stockLosses(CarbonInterface $from, CarbonInterface $to): float
    {
        return (float) DB::table('stock_adjustments')
            ->where('qty', '<', 0)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('COALESCE(SUM(-qty * unit_cost), 0) as loss')
            ->value('loss');
    }

    /** Orders created in the period (by order_date) and the cancel/return rate. */
    public function orderRates(CarbonInterface $from, CarbonInterface $to): array
    {
        $rows = DB::table('orders')
            ->whereBetween('order_date', [$from, $to])
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $total = (int) $rows->sum();
        $cancelled = (int) ($rows[OrderStatus::Cancelled->value] ?? 0);
        $returned = (int) ($rows[OrderStatus::Returned->value] ?? 0);

        return [
            'orders_created' => $total,
            'orders_by_status' => collect(OrderStatus::cases())
                ->mapWithKeys(fn (OrderStatus $s) => [$s->value => (int) ($rows[$s->value] ?? 0)])
                ->all(),
            'cancelled_count' => $cancelled,
            'returned_count' => $returned,
            'return_rate' => $total > 0 ? round(($cancelled + $returned) / $total * 100, 1) : 0.0,
        ];
    }

    public function stockValue(): float
    {
        return round((float) DB::table('products')->selectRaw('COALESCE(SUM(stock * avg_cost), 0) as v')->value('v'), 2);
    }

    /**
     * Cash custody (عهدة) per brother, all-time balance:
     *   delivered goods collected − purchases paid − expenses paid − cash handed over.
     * Negative = the store owes him money.
     */
    public function custody(): array
    {
        $collected = DB::table('orders')
            ->where('status', OrderStatus::Delivered->value)
            ->whereNotNull('delivered_by_user_id')
            ->groupBy('delivered_by_user_id')
            ->selectRaw('delivered_by_user_id as uid, SUM(goods_total) as total')
            ->pluck('total', 'uid');

        $purchases = DB::table('purchases')->groupBy('paid_by_user_id')
            ->selectRaw('paid_by_user_id as uid, SUM(total_cost) as total')->pluck('total', 'uid');

        $expenses = DB::table('expenses')->groupBy('paid_by_user_id')
            ->selectRaw('paid_by_user_id as uid, SUM(amount) as total')->pluck('total', 'uid');

        $handovers = DB::table('cash_handovers')->groupBy('user_id')
            ->selectRaw('user_id as uid, SUM(amount) as total')->pluck('total', 'uid');

        return User::query()->orderBy('id')->get(['id', 'name'])->map(function (User $user) use ($collected, $purchases, $expenses, $handovers) {
            $c = (float) ($collected[$user->id] ?? 0);
            $p = (float) ($purchases[$user->id] ?? 0);
            $e = (float) ($expenses[$user->id] ?? 0);
            $h = (float) ($handovers[$user->id] ?? 0);

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'collected' => round($c, 2),
                'purchases_paid' => round($p, 2),
                'expenses_paid' => round($e, 2),
                'handed_over' => round($h, 2),
                'balance' => round($c - $p - $e - $h, 2),
            ];
        })->all();
    }

    /** Revenue / gross profit / expenses / losses / net profit for the last N months. */
    public function monthly(int $months = 12): array
    {
        $start = CarbonImmutable::now()->startOfMonth()->subMonths($months - 1);
        $end = CarbonImmutable::now()->endOfMonth();

        $revenue = DB::table('orders')
            ->where('status', OrderStatus::Delivered->value)
            ->whereBetween('delivered_at', [$start, $end])
            ->selectRaw($this->monthExpr('delivered_at').' as m, SUM(goods_total) as total, COUNT(*) as cnt')
            ->groupBy('m')->get()->keyBy('m');

        $profit = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', OrderStatus::Delivered->value)
            ->whereBetween('orders.delivered_at', [$start, $end])
            ->selectRaw($this->monthExpr('orders.delivered_at').' as m, SUM((order_items.unit_price - order_items.unit_cost) * order_items.qty) as total')
            ->groupBy('m')->pluck('total', 'm');

        $expenses = DB::table('expenses')
            ->whereBetween('expense_date', [$start, $end])
            ->selectRaw($this->monthExpr('expense_date').' as m, SUM(amount) as total')
            ->groupBy('m')->pluck('total', 'm');

        $losses = DB::table('stock_adjustments')
            ->where('qty', '<', 0)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw($this->monthExpr('created_at').' as m, SUM(-qty * unit_cost) as total')
            ->groupBy('m')->pluck('total', 'm');

        $rows = [];
        for ($i = 0; $i < $months; $i++) {
            $key = $start->addMonths($i)->format('Y-m');
            $rev = (float) ($revenue[$key]->total ?? 0);
            $gp = (float) ($profit[$key] ?? 0);
            $exp = (float) ($expenses[$key] ?? 0);
            $loss = (float) ($losses[$key] ?? 0);

            $rows[] = [
                'month' => $key,
                'orders' => (int) ($revenue[$key]->cnt ?? 0),
                'revenue' => round($rev, 2),
                'gross_profit' => round($gp, 2),
                'expenses' => round($exp, 2),
                'stock_losses' => round($loss, 2),
                'net_profit' => round($gp - $exp - $loss, 2),
            ];
        }

        return $rows;
    }

    /** Top 10 products in the period, by quantity sold or by gross profit. */
    public function topProducts(CarbonInterface $from, CarbonInterface $to, string $by = 'qty', int $limit = 10): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.status', OrderStatus::Delivered->value)
            ->whereBetween('orders.delivered_at', [$from, $to])
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->selectRaw('products.id, products.name, products.sku')
            ->selectRaw('SUM(order_items.qty) as qty')
            ->selectRaw('SUM(order_items.qty * order_items.unit_price) as revenue')
            ->selectRaw('SUM((order_items.unit_price - order_items.unit_cost) * order_items.qty) as profit')
            ->orderByDesc($by === 'profit' ? 'profit' : 'qty')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'name' => $r->name,
                'sku' => $r->sku,
                'qty' => (int) $r->qty,
                'revenue' => round((float) $r->revenue, 2),
                'profit' => round((float) $r->profit, 2),
            ])->all();
    }

    public function lowStock(int $limit = 50): array
    {
        return DB::table('products')
            ->where('is_active', true)
            ->whereColumn('stock', '<=', 'reorder_level')
            ->orderBy('stock')->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'sku', 'stock', 'reorder_level'])
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'name' => $r->name,
                'sku' => $r->sku,
                'stock' => (int) $r->stock,
                'reorder_level' => (int) $r->reorder_level,
            ])->all();
    }

    /** Products with stock > 0 and no (non-cancelled) sale in the last 60 days. */
    public function deadStock(int $limit = 50): array
    {
        $since = CarbonImmutable::now()->subDays(self::DEAD_STOCK_DAYS)->toDateString();
        $sellingStatuses = [OrderStatus::Pending->value, OrderStatus::OutForDelivery->value, OrderStatus::Delivered->value];

        $lastSale = fn (Builder $q) => $q->from('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereColumn('order_items.product_id', 'products.id')
            ->whereIn('orders.status', $sellingStatuses)
            ->selectRaw('MAX(orders.order_date)');

        return DB::table('products')
            ->where('stock', '>', 0)
            ->whereNotExists(fn (Builder $q) => $q->from('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->whereColumn('order_items.product_id', 'products.id')
                ->whereIn('orders.status', $sellingStatuses)
                ->where('orders.order_date', '>=', $since)
                ->selectRaw('1'))
            ->select(['id', 'name', 'sku', 'stock', 'avg_cost'])
            ->selectSub($lastSale, 'last_sold_at')
            ->orderByRaw('stock * avg_cost DESC')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'id' => (int) $r->id,
                'name' => $r->name,
                'sku' => $r->sku,
                'stock' => (int) $r->stock,
                'stock_value' => round($r->stock * (float) $r->avg_cost, 2),
                'last_sold_at' => $r->last_sold_at ? substr((string) $r->last_sold_at, 0, 10) : null,
            ])->all();
    }

    public function salesByArea(CarbonInterface $from, CarbonInterface $to): array
    {
        return $this->deliveredOrders($from, $to)
            ->selectRaw("COALESCE(NULLIF(area, ''), 'غير محدد') as area_name, COUNT(*) as orders, SUM(goods_total) as revenue")
            ->groupBy('area_name')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($r) => [
                'area' => $r->area_name,
                'orders' => (int) $r->orders,
                'revenue' => round((float) $r->revenue, 2),
            ])->all();
    }

    /** Repeat customers (2+ delivered orders), grouped by phone, all time. */
    public function topCustomers(int $limit = 10): array
    {
        return DB::table('orders')
            ->where('status', OrderStatus::Delivered->value)
            ->groupBy('phone')
            ->havingRaw('COUNT(*) >= 2')
            ->selectRaw('phone, MAX(customer_name) as name, MAX(area) as area, COUNT(*) as orders, SUM(goods_total) as total, MAX(order_date) as last_order')
            ->orderByDesc('orders')->orderByDesc('total')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'phone' => $r->phone,
                'name' => $r->name,
                'area' => $r->area,
                'orders' => (int) $r->orders,
                'total' => round((float) $r->total, 2),
                'last_order' => substr((string) $r->last_order, 0, 10),
            ])->all();
    }

    /**
     * Delivery fees earned personally by each brother (NOT store income).
     */
    public function deliveryEarnings(CarbonInterface $from, CarbonInterface $to): array
    {
        $rows = DB::table('orders')
            ->where('status', OrderStatus::Delivered->value)
            ->whereBetween('delivered_at', [$from, $to])
            ->whereNotNull('delivered_by_user_id')
            ->groupBy('delivered_by_user_id')
            ->selectRaw('delivered_by_user_id as uid, COUNT(*) as deliveries, SUM(delivery_fee) as earnings')
            ->get()->keyBy('uid');

        return User::query()->orderBy('id')->get(['id', 'name'])->map(fn (User $u) => [
            'user_id' => $u->id,
            'name' => $u->name,
            'deliveries' => (int) ($rows[$u->id]->deliveries ?? 0),
            'earnings' => round((float) ($rows[$u->id]->earnings ?? 0), 2),
        ])->all();
    }

    private function deliveredOrders(CarbonInterface $from, CarbonInterface $to): Builder
    {
        return DB::table('orders')
            ->where('status', OrderStatus::Delivered->value)
            ->whereBetween('delivered_at', [$from, $to]);
    }

    private function monthExpr(string $column): string
    {
        return match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m', {$column})",
            'pgsql' => "to_char({$column}, 'YYYY-MM')",
            default => "DATE_FORMAT({$column}, '%Y-%m')",
        };
    }
}
