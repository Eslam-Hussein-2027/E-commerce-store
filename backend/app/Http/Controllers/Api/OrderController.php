<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\OrderRequest;
use App\Http\Requests\OrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Order::query()
            ->with(['items.product:id,name', 'deliveredBy:id,name', 'creator:id,name'])
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = trim($request->string('search'));
                $q->where(function ($w) use ($search) {
                    $w->where('customer_name', 'like', $this->likeTerm($search))
                        ->orWhere('phone', 'like', $this->likeTerm($search))
                        ->orWhere('area', 'like', $this->likeTerm($search));
                    if (ctype_digit(ltrim($search, '#'))) {
                        $w->orWhere('id', (int) ltrim($search, '#'));
                    }
                });
            })
            ->when($request->filled('user_id'), fn ($q) => $q->where('delivered_by_user_id', $request->integer('user_id')))
            ->when($request->filled('product_id'), fn ($q) => $q->whereHas('items', fn ($i) => $i->where('product_id', $request->integer('product_id'))));

        $this->applyDateRange($query, $request, 'order_date');

        // Tab counts ignore the status filter itself.
        $counts = (clone $query)->toBase()->reorder()->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        $query->when($request->filled('status'), fn ($q) => $q->whereIn('status', explode(',', $request->string('status'))));

        return OrderResource::collection(
            $query->latest('order_date')->latest('id')->paginate($this->perPage($request))
        )->additional(['summary' => ['by_status' => $counts]]);
    }

    public function store(OrderRequest $request): OrderResource
    {
        return new OrderResource($this->orders->create($request->validated()));
    }

    public function show(Order $order): OrderResource
    {
        return new OrderResource($order->load(['items.product:id,name', 'deliveredBy:id,name', 'creator:id,name']));
    }

    public function update(OrderRequest $request, Order $order): OrderResource
    {
        return new OrderResource($this->orders->update($order, $request->validated()));
    }

    public function updateStatus(OrderStatusRequest $request, Order $order): OrderResource
    {
        return new OrderResource($this->orders->changeStatus($order, $request->status(), $request->validated()));
    }
}
