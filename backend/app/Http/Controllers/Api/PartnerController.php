<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PartnerRequest;
use App\Http\Resources\PartnerResource;
use App\Models\Partner;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PartnerController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $partners = Partner::query()->orderByDesc('capital')->orderBy('id')->get();
        $total = (float) $partners->sum('capital');

        $partners->each(fn (Partner $p) => $p->share_percent = $total > 0 ? round($p->capital / $total * 100, 2) : 0.0);

        return PartnerResource::collection($partners)->additional(['summary' => ['total_capital' => round($total, 2)]]);
    }

    public function store(PartnerRequest $request): PartnerResource
    {
        return new PartnerResource(Partner::create($request->validated()));
    }

    public function show(Partner $partner): PartnerResource
    {
        return new PartnerResource($partner);
    }

    public function update(PartnerRequest $request, Partner $partner): PartnerResource
    {
        $partner->update($request->validated());

        return new PartnerResource($partner);
    }

    public function destroy(Partner $partner): Response
    {
        $partner->delete();

        return response()->noContent();
    }
}
