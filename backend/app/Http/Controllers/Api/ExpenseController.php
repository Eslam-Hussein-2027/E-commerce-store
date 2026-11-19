<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ExpenseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Expense::query()
            ->with(['paidBy:id,name', 'creator:id,name'])
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('paid_by_user_id', $request->integer('user_id')))
            ->when($request->filled('search'), fn ($q) => $q->where('note', 'like', $this->likeTerm($request->string('search'))));

        $this->applyDateRange($query, $request, 'expense_date');

        $summary = ['total' => round((float) (clone $query)->sum('amount'), 2)];

        return ExpenseResource::collection(
            $query->latest('expense_date')->latest('id')->paginate($this->perPage($request))
        )->additional(['summary' => $summary]);
    }

    public function store(ExpenseRequest $request): ExpenseResource
    {
        return new ExpenseResource(Expense::create($request->validated())->load('paidBy:id,name'));
    }

    public function show(Expense $expense): ExpenseResource
    {
        return new ExpenseResource($expense->load(['paidBy:id,name', 'creator:id,name']));
    }

    public function update(ExpenseRequest $request, Expense $expense): ExpenseResource
    {
        $expense->update($request->validated());

        return new ExpenseResource($expense->load('paidBy:id,name'));
    }

    public function destroy(Expense $expense): Response
    {
        $expense->delete();

        return response()->noContent();
    }
}
