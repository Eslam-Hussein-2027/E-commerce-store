<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function perPage(Request $request, int $default = 20): int
    {
        return max(1, min(100, (int) $request->integer('per_page', $default)));
    }

    /** Apply ?from=&to= (Y-m-d) to a date or datetime column. */
    protected function applyDateRange(Builder $query, Request $request, string $column): void
    {
        if ($request->filled('from')) {
            $query->where($column, '>=', $request->date('from')->startOfDay());
        }
        if ($request->filled('to')) {
            $query->where($column, '<=', $request->date('to')->endOfDay());
        }
    }

    protected function likeTerm(string $term): string
    {
        return '%'.addcslashes(trim($term), '%_\\').'%';
    }
}
