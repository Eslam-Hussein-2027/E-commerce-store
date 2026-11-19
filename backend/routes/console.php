<?php

use App\Services\StockService;
use Illuminate\Support\Facades\Artisan;

Artisan::command('stock:audit', function (StockService $stock) {
    $diffs = $stock->audit();

    if ($diffs === []) {
        $this->info('OK: products.stock matches SUM(stock_movements) for every product.');

        return 0;
    }

    $this->error('Mismatch between cached stock and the movements ledger:');
    $this->table(['ID', 'Product', 'Cached', 'Ledger'], $diffs);

    return 1;
})->purpose('Verify cached product stock against the stock movements ledger');
