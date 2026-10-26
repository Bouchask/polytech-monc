<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AppointmentController extends Controller
{
    public function reschedule(Request $request, string $requestId): JsonResponse
    {
        $data = $request->validate(['scheduledAt' => ['nullable', 'date', 'after:now'], 'allDay' => ['required', 'boolean']]);
        if (! $data['allDay'] && empty($data['scheduledAt'])) {
            throw ValidationException::withMessages(['scheduledAt' => 'Choisissez une date et une heure.']);
        }
        $appointment = DB::table('appointments')->join('service_requests', 'appointments.request_id', '=', 'service_requests.id')
            ->where('appointments.request_id', $requestId)->where('service_requests.user_id', $request->user()->id)
            ->select('appointments.*')->first();
        abort_unless($appointment, 404, 'Rendez-vous introuvable.');
        abort_if(in_array($appointment->status, ['COMPLETED', 'CANCELLED'], true), 409, 'Ce rendez-vous ne peut plus être modifié.');

        DB::transaction(function () use ($request, $requestId, $data) {
            DB::table('appointments')->where('request_id', $requestId)->update([
                'scheduled_at' => $data['allDay'] ? null : $data['scheduledAt'],
                'all_day' => $data['allDay'], 'status' => 'CONFIRMED', 'updated_at' => now(),
            ]);
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $request->user()->id,
                'request_id' => $requestId, 'title' => 'Rendez-vous modifié',
                'body' => 'La nouvelle date de votre rendez-vous a été enregistrée.', 'kind' => 'appointment', 'is_read' => false, 'created_at' => now(),
            ]);
        });

        return response()->json(['appointment' => DB::table('appointments')->where('request_id', $requestId)->first()]);
    }

    public function cancel(Request $request, string $requestId): JsonResponse
    {
        DB::transaction(function () use ($request, $requestId) {
            $serviceRequest = DB::table('service_requests')->where('id', $requestId)->where('user_id', $request->user()->id)->lockForUpdate()->first();
            abort_unless($serviceRequest, 404, 'Rendez-vous introuvable.');
            $appointment = DB::table('appointments')->where('request_id', $requestId)->lockForUpdate()->first();
            abort_unless($appointment, 404, 'Rendez-vous introuvable.');
            abort_if($appointment->status === 'COMPLETED', 409, 'Un rendez-vous terminé ne peut pas être annulé.');
            DB::table('appointments')->where('request_id', $requestId)->update(['status' => 'CANCELLED', 'updated_at' => now()]);
            DB::table('service_requests')->where('id', $requestId)->update(['status' => 'OFFERS_RECEIVED', 'accepted_offer_id' => null, 'updated_at' => now()]);
            DB::table('offers')->where('request_id', $requestId)->where('status', 'ACCEPTED')->update(['status' => 'PENDING']);
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $request->user()->id,
                'request_id' => $requestId, 'title' => 'Rendez-vous annulé',
                'body' => 'Le rendez-vous a été annulé. Vous pouvez consulter les offres disponibles.', 'kind' => 'status', 'is_read' => false, 'created_at' => now(),
            ]);
        });

        return response()->json(['message' => 'Rendez-vous annulé.']);
    }
}
