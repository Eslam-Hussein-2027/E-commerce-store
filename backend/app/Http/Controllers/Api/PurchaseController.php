<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseRequest;
use App\Http\Resources\PurchaseResource;
use App\Models\Purchase;
use App\Services\PurchaseService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PurchaseController extends Controller
{
    public function __construct(private readonly PurchaseService $purchases) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Purchase::query()
            ->with(['paidBy:id,name', 'creator:id,name', 'items.product:id,name'])
            ->when($request->filled('search'), fn ($q) => $q->where(function ($w) use ($request) {
                $w->where('supplier', 'like', $this->likeTerm($request->string('search')))
                    ->orWhere('id', (int) ltrim($request->string('search'), '#'));
            }))
            ->when($request->filled('user_id'), fn ($q) => $q->where('paid_by_user_id', $request->integer('user_id')))
            ->when($request->filled('product_id'), fn ($q) => $q->whereHas('items', fn ($i) => $i->where('product_id', $request->integer('product_id'))));

        $this->applyDateRange($query, $request, 'purchase_date');

        $summary = ['total_cost' => round((float) (clone $query)->sum('total_cost'), 2)];

        return PurchaseResource::collection(
            $query->latest('purchase_date')->latest('id')->paginate($this->perPage($request))
        )->additional(['summary' => $summary]);
    }

    public function store(PurchaseRequest $request): PurchaseResource
    {
        return new PurchaseResource($this->purchases->create($request->validated()));
    }

    public function show(Purchase $purchase): PurchaseResource
    {
        return new PurchaseResource($purchase->load(['items.product:id,name', 'paidBy:id,name', 'creator:id,name']));
    }

    public function destroy(Purchase $purchase): Response
    {
        $this->purchases->delete($purchase);

        return response()->noContent();
    }
}
