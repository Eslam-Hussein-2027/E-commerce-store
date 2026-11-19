<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CashHandoverRequest;
use App\Http\Resources\CashHandoverResource;
use App\Models\CashHandover;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CashHandoverController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = CashHandover::query()
            ->with(['user:id,name', 'creator:id,name'])
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')));

        $this->applyDateRange($query, $request, 'handed_at');

        $summary = ['total' => round((float) (clone $query)->sum('amount'), 2)];

        return CashHandoverResource::collection(
            $query->latest('handed_at')->latest('id')->paginate($this->perPage($request))
        )->additional(['summary' => $summary]);
    }

    public function store(CashHandoverRequest $request): CashHandoverResource
    {
        return new CashHandoverResource(CashHandover::create($request->validated())->load('user:id,name'));
    }

    public function show(CashHandover $cashHandover): CashHandoverResource
    {
        return new CashHandoverResource($cashHandover->load(['user:id,name', 'creator:id,name']));
    }

    public function update(CashHandoverRequest $request, CashHandover $cashHandover): CashHandoverResource
    {
        $cashHandover->update($request->validated());

        return new CashHandoverResource($cashHandover->load('user:id,name'));
    }

    public function destroy(CashHandover $cashHandover): Response
    {
        $cashHandover->delete();

        return response()->noContent();
    }
}
