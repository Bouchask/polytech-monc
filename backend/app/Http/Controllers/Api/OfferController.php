<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfferController extends Controller
{
    public function accept(Request $request, string $requestId, string $offerId): JsonResponse
    {
        DB::transaction(function () use ($request, $requestId, $offerId) {
            DB::statement("select set_config('request.jwt.claim.sub', ?, true)", [$request->user()->id]);
            DB::select('select to_jsonb(public.accept_service_offer(?::uuid, ?::uuid))', [$requestId, $offerId]);
        });

        return response()->json(['message' => 'Offre acceptée.']);
    }
}
