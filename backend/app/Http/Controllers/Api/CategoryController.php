<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Category::query()
            ->withCount('products')
            ->with('creator:id,name')
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', $this->likeTerm($request->string('search'))))
            ->orderBy('name');

        return CategoryResource::collection(
            $request->boolean('all') ? $query->get() : $query->paginate($this->perPage($request, 50))
        );
    }

    public function store(CategoryRequest $request): CategoryResource
    {
        return new CategoryResource(Category::create($request->validated())->loadCount('products'));
    }

    public function show(Category $category): CategoryResource
    {
        return new CategoryResource($category->loadCount('products')->load('creator:id,name'));
    }

    public function update(CategoryRequest $request, Category $category): CategoryResource
    {
        $category->update($request->validated());

        return new CategoryResource($category->loadCount('products'));
    }

    public function destroy(Category $category): Response
    {
        if ($category->products()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'لا يمكن حذف تصنيف يحتوي على منتجات. انقل المنتجات لتصنيف آخر أولاً.',
            ]);
        }

        $category->delete();

        return response()->noContent();
    }
}
