<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StockMovementResource;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Read-only stock ledger. */
class StockMovementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = StockMovement::query()
            ->with(['product:id,name', 'creator:id,name'])
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', $request->integer('product_id')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('created_by', $request->integer('user_id')))
            ->when($request->filled('reference_type'), fn ($q) => $q->where('reference_type', $request->string('reference_type')))
            ->when($request->filled('reference_id'), fn ($q) => $q->where('reference_id', $request->integer('reference_id')));

        $this->applyDateRange($query, $request, 'created_at');

        return StockMovementResource::collection($query->latest('id')->paginate($this->perPage($request, 30)));
    }
}
