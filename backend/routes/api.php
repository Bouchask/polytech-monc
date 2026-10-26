<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\OfferController;
use App\Http\Controllers\Api\RequestController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    try {
        DB::selectOne('select 1');

        return response()->json(['status' => 'ok', 'database' => 'connected']);
    } catch (Throwable) {
        return response()->json(['status' => 'degraded', 'database' => 'unavailable'], 503);
    }
});

Route::get('/media/{media}', [MediaController::class, 'show'])->middleware('signed:relative')->name('api.media.show');
Route::get('/catalog', [CatalogController::class, 'index']);

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/verify-email', [AuthController::class, 'verifyEmail'])->middleware('throttle:10,1');
    Route::post('/resend-signup', [AuthController::class, 'resendSignup'])->middleware('throttle:5,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/password/forgot', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/password/reset', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/password/change', [AuthController::class, 'changePassword']);
    Route::get('/me/bootstrap', [AccountController::class, 'bootstrap']);
    Route::patch('/me/profile', [AccountController::class, 'updateProfile']);
    Route::get('/addresses', [AccountController::class, 'addresses']);
    Route::post('/addresses', [AccountController::class, 'addAddress']);
    Route::delete('/addresses/{id}', [AccountController::class, 'deleteAddress']);
    Route::post('/notifications/read', [AccountController::class, 'markNotificationRead']);
    Route::post('/notifications/{id}/read', [AccountController::class, 'markNotificationRead']);
    Route::get('/requests', [RequestController::class, 'index']);
    Route::post('/requests', [RequestController::class, 'create'])->middleware('throttle:10,1');
    Route::get('/requests/{id}', [RequestController::class, 'show']);
    Route::post('/requests/{id}/cancel', [RequestController::class, 'cancel']);
    Route::post('/requests/{requestId}/offers/{offerId}/accept', [OfferController::class, 'accept']);
    Route::patch('/requests/{requestId}/appointment', [AppointmentController::class, 'reschedule']);
    Route::delete('/requests/{requestId}/appointment', [AppointmentController::class, 'cancel']);
});
