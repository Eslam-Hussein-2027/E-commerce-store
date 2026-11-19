<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StockAdjustmentRequest;
use App\Http\Resources\StockAdjustmentResource;
use App\Models\StockAdjustment;
use App\Services\StockService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Adjustments are append-only (like the stock ledger). Fix a mistake with an opposite adjustment.
 */
class StockAdjustmentController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = StockAdjustment::query()
            ->with(['product:id,name', 'creator:id,name'])
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', $request->integer('product_id')))
            ->when($request->filled('reason'), fn ($q) => $q->where('reason', $request->string('reason')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('created_by', $request->integer('user_id')));

        $this->applyDateRange($query, $request, 'created_at');

        $summary = [
            'loss_value' => round((float) (clone $query)->where('qty', '<', 0)->selectRaw('COALESCE(SUM(-qty * unit_cost), 0) as v')->value('v'), 2),
        ];

        return StockAdjustmentResource::collection(
            $query->latest('id')->paginate($this->perPage($request))
        )->additional(['summary' => $summary]);
    }

    public function store(StockAdjustmentRequest $request): StockAdjustmentResource
    {
        return new StockAdjustmentResource($this->stock->adjust($request->validated()));
    }

    public function show(StockAdjustment $stockAdjustment): StockAdjustmentResource
    {
        return new StockAdjustmentResource($stockAdjustment->load(['product:id,name', 'creator:id,name']));
    }
}
