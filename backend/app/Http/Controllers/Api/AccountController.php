<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    public function bootstrap(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = DB::table('profiles')->where('id', $user->id)->first();
        $addresses = DB::table('addresses')->where('user_id', $user->id)->orderByDesc('created_at')->get();
        $requests = DB::table('service_requests')->where('user_id', $user->id)->orderByDesc('created_at')->get();
        $requestIds = $requests->pluck('id');
        $mediaByRequest = $requestIds->isEmpty()
            ? collect()
            : DB::table('request_media')->whereIn('request_id', $requestIds)->orderBy('created_at')->get()->groupBy('request_id');
        foreach ($requests as $row) {
            if (is_string($row->address_snapshot ?? null)) {
                $row->address_snapshot = json_decode($row->address_snapshot, true) ?: [];
            }
            $row->request_media = $mediaByRequest->get($row->id, collect())->map(function ($media) {
                $media->url = URL::temporarySignedRoute('api.media.show', now()->addHour(), ['media' => $media->id], false);

                return $media;
            });
        }

        $offers = DB::table('offers')->join('service_requests', 'offers.request_id', '=', 'service_requests.id')
            ->join('technicians', 'offers.technician_id', '=', 'technicians.id')
            ->where('service_requests.user_id', $user->id)
            ->orderBy('offers.created_at')
            ->select(['offers.*', 'service_requests.id as request_id', 'technicians.id as joined_technician_id', 'technicians.name', 'technicians.specialty', 'technicians.rating', 'technicians.review_count', 'technicians.completed_jobs', 'technicians.experience_years', 'technicians.biography', 'technicians.avatar_url'])
            ->get()->map(function ($row) {
                $technician = [
                    'id' => $row->joined_technician_id,
                    'name' => $row->name,
                    'specialty' => $row->specialty,
                    'rating' => $row->rating,
                    'review_count' => $row->review_count,
                    'completed_jobs' => $row->completed_jobs,
                    'experience_years' => $row->experience_years,
                    'biography' => $row->biography,
                    'avatar_url' => $row->avatar_url,
                ];
                $item = (array) $row;
                foreach (['joined_technician_id', 'name', 'specialty', 'rating', 'review_count', 'completed_jobs', 'experience_years', 'biography', 'avatar_url'] as $field) {
                    unset($item[$field]);
                }
                $item['technicians'] = $technician;

                return $item;
            });

        $payload = [
            'user' => ['id' => $user->id, 'name' => $profile->full_name ?? $user->full_name, 'phone' => $profile->phone ?? $user->phone, 'email' => $profile->email ?? $user->email],
            'profile' => $profile,
            'addresses' => $addresses,
            'requests' => $requests,
            'offers' => $offers,
            'notifications' => DB::table('notifications')->where('user_id', $user->id)->orderByDesc('created_at')->limit(100)->get(),
            'appointments' => DB::table('appointments')->whereIn('request_id', $requests->pluck('id'))->orderByDesc('created_at')->get(),
        ];
        if ($request->boolean('includeTechnicians', true)) {
            $payload['technicians'] = DB::table('technicians')->orderBy('name')->get();
        }

        return response()->json($payload);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'phone' => ['nullable', 'string', 'max:24'],
            'email' => ['nullable', 'email:rfc', 'max:254'],
        ]);
        $user = $request->user();
        $email = isset($validated['email']) && $validated['email'] !== '' ? strtolower(trim($validated['email'])) : $user->email;
        if ($email !== $user->email) {
            throw ValidationException::withMessages(['email' => 'Pour protéger votre compte, le changement d’adresse e-mail doit être vérifié séparément.']);
        }

        DB::transaction(function () use ($user, $validated) {
            $name = trim($validated['name']);
            $phone = $this->normalizeMoroccanPhone($validated['phone'] ?? null);
            $user->forceFill(['full_name' => $name, 'name' => $name, 'phone' => $phone])->save();
            DB::table('profiles')->updateOrInsert(
                ['id' => $user->id],
                ['full_name' => $name, 'phone' => $phone ?? '', 'email' => $user->email, 'updated_at' => now(), 'created_at' => now()],
            );
        });
        $updatedUser = $user->fresh();

        return response()->json(['user' => ['id' => $updatedUser->id, 'name' => $updatedUser->full_name, 'phone' => $updatedUser->phone, 'email' => $updatedUser->email]]);
    }

    public function addresses(Request $request): JsonResponse
    {
        return response()->json(['addresses' => DB::table('addresses')->where('user_id', $request->user()->id)->orderByDesc('created_at')->get()]);
    }

    public function addAddress(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'min:1', 'max:80'],
            'address' => ['required', 'string', 'min:1', 'max:300'],
            'details' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
        $id = (string) Str::uuid();
        DB::table('addresses')->insert([
            'id' => $id, 'user_id' => $request->user()->id, 'label' => trim($data['label']), 'address' => trim($data['address']),
            'details' => $data['details'] ?? null, 'latitude' => $data['latitude'] ?? null, 'longitude' => $data['longitude'] ?? null,
            'is_default' => false, 'created_at' => now(),
        ]);

        return response()->json(['address' => DB::table('addresses')->where('id', $id)->first()], 201);
    }

    public function deleteAddress(Request $request, string $id): JsonResponse
    {
        $deleted = DB::table('addresses')->where('id', $id)->where('user_id', $request->user()->id)->delete();
        abort_unless($deleted, 404, 'Adresse introuvable.');

        return response()->json(['message' => 'Adresse supprimée.']);
    }

    public function markNotificationRead(Request $request, ?string $id = null): JsonResponse
    {
        $userId = $request->user()->id;
        DB::transaction(function () use ($userId, $id) {
            DB::statement("select set_config('request.jwt.claim.sub', ?, true)", [$userId]);
            DB::select('select public.mark_notification_read(?::uuid)', [$id]);
        });

        return response()->json(['message' => 'Notifications mises à jour.']);
    }

    private function normalizeMoroccanPhone(?string $phone): ?string
    {
        if (! $phone || trim($phone) === '') {
            return null;
        }
        $value = preg_replace('/[\s().-]+/', '', trim($phone)) ?? '';
        if (preg_match('/^0([67]\d{8})$/', $value, $match)) {
            $value = '+212'.$match[1];
        } elseif (preg_match('/^212([67]\d{8})$/', $value, $match)) {
            $value = '+212'.$match[1];
        }
        if (! preg_match('/^\+212[67]\d{8}$/', $value)) {
            throw ValidationException::withMessages(['phone' => 'Saisissez un numéro mobile marocain valide.']);
        }

        return $value;
    }
}
