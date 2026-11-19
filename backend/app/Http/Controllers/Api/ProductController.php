<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::query()
            ->with('category:id,name')
            ->when($request->filled('search'), function ($q) use ($request) {
                $q->where('name', 'like', $this->likeTerm($request->string('search')));
            })
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->boolean('low_stock'), fn ($q) => $q->lowStock())
            ->when($request->filled('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->when($request->boolean('in_stock'), fn ($q) => $q->where('stock', '>', 0));

        $sort = $request->string('sort')->toString();
        match ($sort) {
            'stock' => $query->orderBy('stock'),
            'stock_value' => $query->orderByRaw('stock * avg_cost DESC'),
            'newest' => $query->latest('id'),
            default => $query->orderBy('name'),
        };

        $summary = [
            'stock_value' => round((float) Product::query()->selectRaw('COALESCE(SUM(stock * avg_cost), 0) as v')->value('v'), 2),
            'low_stock_count' => Product::query()->active()->lowStock()->count(),
        ];

        // ?all=1 → unpaginated list for selects (order / purchase forms).
        $result = $request->boolean('all') ? $query->limit(2000)->get() : $query->paginate($this->perPage($request));

        return ProductResource::collection($result)->additional(['summary' => $summary]);
    }

    public function store(ProductRequest $request): ProductResource
    {
        $product = Product::create($request->validated());

        return new ProductResource($product->refresh()->load('category:id,name'));
    }

    public function show(Product $product): ProductResource
    {
        return new ProductResource($product->load(['category:id,name', 'creator:id,name']));
    }

    public function update(ProductRequest $request, Product $product): ProductResource
    {
        $product->update($request->validated());

        return new ProductResource($product->load('category:id,name'));
    }

    public function destroy(Product $product): Response
    {
        if ($product->movements()->exists() || $product->orderItems()->exists() || $product->purchaseItems()->exists()) {
            throw ValidationException::withMessages([
                'product' => 'لا يمكن حذف منتج له حركات مخزون أو طلبات. يمكنك إيقافه (غير نشط) بدلاً من ذلك.',
            ]);
        }

        $product->delete();

        return response()->noContent();
    }
}
