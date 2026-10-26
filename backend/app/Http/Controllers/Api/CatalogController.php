<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CatalogController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'categories' => DB::table('categories')->orderBy('name')->get(),
            'serviceTypes' => DB::table('service_types')->orderBy('name')->get(),
            'serviceItems' => DB::table('service_items')->orderBy('name')->get(),
            'technicians' => DB::table('technicians')->orderBy('name')->get(),
        ]);
    }
}
