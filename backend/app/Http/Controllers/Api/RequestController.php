<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\OptimizeRequestVideo;
use App\Services\Media\MediaUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Throwable;

class RequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $requests = DB::table('service_requests')->where('user_id', $request->user()->id)->orderByDesc('created_at')->get();

        return response()->json(['requests' => $this->withMedia($requests)]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $rows = DB::table('service_requests')->where('user_id', $request->user()->id)->where('id', $id)->get();
        abort_if($rows->isEmpty(), 404, 'Demande introuvable.');
        $row = $this->withMedia($rows)->first();

        return response()->json([
            'request' => $row,
            'offers' => $this->offersFor($id),
            'appointment' => DB::table('appointments')->where('request_id', $id)->first(),
        ]);
    }

    public function create(Request $request, MediaUploadService $mediaUploader): JsonResponse
    {
        $payload = $request->input('payload');
        if (is_string($payload)) {
            $payload = json_decode($payload, true);
        }
        if (! is_array($payload)) {
            throw ValidationException::withMessages(['payload' => 'Les détails de la demande sont invalides.']);
        }
        validator($payload, [
            'categoryId' => ['required', 'string', 'max:80'],
            'serviceTypes' => ['array', 'max:20'],
            'serviceTypes.*' => ['string', 'max:120'],
            'serviceItemIds' => ['array', 'max:30'],
            'serviceItemIds.*' => ['string', 'max:100'],
            'customService' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:5000'],
            'urgency' => ['required', 'in:urgent,scheduled'],
            'scheduledAt' => ['nullable', 'date'],
            'allDay' => ['nullable', 'boolean'],
            'address.label' => ['nullable', 'string', 'max:80'],
            'address.address' => ['required', 'string', 'max:300'],
            'address.details' => ['nullable', 'string', 'max:500'],
            'address.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'address.longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ])->validate();

        $user = $request->user();
        $files = $request->file('media', []);
        $files = is_array($files) ? array_values($files) : [$files];
        $metadata = $request->input('mediaMeta', []);
        if (is_string($metadata)) {
            $metadata = json_decode($metadata, true) ?: [];
        }
        $metadata = is_array($metadata) ? array_values($metadata) : [];
        if (count($files) > 6) {
            throw ValidationException::withMessages(['media' => 'Vous pouvez joindre jusqu’à 6 fichiers.']);
        }

        $savedFiles = [];
        $uploadedMedia = [];
        $queuedMediaIds = [];
        $databaseCommitted = false;
        $mediaPayload = [];
        $mediaCounts = ['image' => 0, 'video' => 0, 'audio' => 0];
        $totalMediaBytes = 0;
        try {
            foreach ($files as $index => $file) {
                if (! $file || ! $file->isValid()) {
                    throw ValidationException::withMessages(['media' => 'Une pièce jointe n’a pas pu être lue.']);
                }
                $size = (int) $file->getSize();
                $totalMediaBytes += $size;
                if ($totalMediaBytes > (int) config('media.max_request_bytes', 220 * 1024 * 1024)) {
                    throw ValidationException::withMessages(['media' => 'La taille totale des pièces jointes dépasse la limite autorisée.']);
                }
                $meta = is_array($metadata[$index] ?? null) ? $metadata[$index] : [];
                $claimedType = (string) ($meta['type'] ?? '');
                if (! in_array($claimedType, ['image', 'video', 'audio'], true)) {
                    throw ValidationException::withMessages(['media' => 'Le contenu de la pièce jointe ne correspond pas à son type annoncé.']);
                }
                $type = $claimedType;
                $mediaCounts[$type]++;
                $limit = ['image' => 4, 'video' => 1, 'audio' => 1][$type];
                if ($mediaCounts[$type] > $limit) {
                    throw ValidationException::withMessages(['media' => match ($type) {
                        'image' => 'Vous pouvez joindre jusqu’à 4 photos.',
                        'video' => 'Vous pouvez joindre une seule vidéo.',
                        'audio' => 'Vous pouvez joindre un seul message audio.',
                    }]);
                }
                $durationMs = isset($meta['durationMs']) && is_numeric($meta['durationMs']) ? (int) $meta['durationMs'] : null;
                if ($type === 'video' && $durationMs !== null && $durationMs > 180_000) {
                    throw ValidationException::withMessages(['media' => 'La vidéo ne peut pas dépasser 3 minutes.']);
                }
                if ($type === 'audio' && $durationMs !== null && $durationMs > 3_600_000) {
                    throw ValidationException::withMessages(['media' => 'Le message audio ne peut pas dépasser 60 minutes.']);
                }
                $stored = $mediaUploader->store($file, $type, (string) $user->id, $durationMs);
                $uploadedMedia[] = $stored;
                foreach ($stored['uploadedObjectKeys'] as $objectKey) {
                    $savedFiles[] = ['disk' => $stored['objectDisk'], 'key' => $objectKey];
                }
                $mediaPayload[] = [
                    'type' => $type,
                    'storagePath' => $stored['storagePath'],
                    'fileName' => $stored['fileName'],
                    'mimeType' => $stored['mimeType'],
                    'byteSize' => $stored['byteSize'],
                    'durationMs' => $stored['durationMs'],
                ];
            }

            $payload['media'] = $mediaPayload;
            $payload['description'] = $payload['description'] ?? '';
            $payload['serviceTypes'] = $payload['serviceTypes'] ?? [];
            $payload['serviceItemIds'] = $payload['serviceItemIds'] ?? [];
            $payload['address']['label'] = $payload['address']['label'] ?? 'Adresse';
            $payload['allDay'] = (bool) ($payload['allDay'] ?? false);
            $created = DB::transaction(function () use ($user, $payload, $uploadedMedia, &$queuedMediaIds) {
                DB::statement("select set_config('request.jwt.claim.sub', ?, true)", [$user->id]);
                $result = DB::selectOne('select to_jsonb(public.create_service_request(?::jsonb)) as request_row', [json_encode($payload, JSON_THROW_ON_ERROR)]);
                $record = is_string($result->request_row ?? null) ? json_decode($result->request_row, true) : (array) ($result->request_row ?? []);

                $mediaRows = DB::table('request_media')->where('request_id', $record['id'])->where('user_id', $user->id)->get();
                foreach ($mediaRows as $row) {
                    $details = collect($uploadedMedia)->firstWhere('storagePath', $row->storage_path);
                    if ($details === null) {
                        continue;
                    }
                    DB::table('request_media')->where('id', $row->id)->update([
                        'object_disk' => $details['objectDisk'],
                        'original_mime_type' => $details['originalMimeType'],
                        'file_extension' => $details['extension'],
                        'original_size_bytes' => $details['originalSizeBytes'],
                        'compression_ratio' => $details['compressionRatio'],
                        'original_width' => $details['originalWidth'],
                        'original_height' => $details['originalHeight'],
                        'processed_width' => $details['width'],
                        'processed_height' => $details['height'],
                        'original_codec' => $details['originalCodec'],
                        'output_codec' => $details['outputCodec'],
                        'sample_rate' => $details['sampleRate'],
                        'channel_count' => $details['channels'],
                        'original_audio_bitrate' => $details['originalAudioBitrate'],
                        'processed_audio_bitrate' => $details['processedAudioBitrate'],
                        'original_frame_rate' => $details['originalFrameRate'],
                        'processed_frame_rate' => $details['processedFrameRate'],
                        'processing_profile' => $details['profile'],
                        'processing_settings' => json_encode($details['processingSettings'], JSON_THROW_ON_ERROR),
                        'processing_status' => $details['processingStatus'],
                        'original_object_key' => $details['originalObjectKey'],
                        'thumbnail_object_key' => $details['thumbnailObjectKey'],
                        'processing_completed_at' => $details['processingStatus'] === 'ready' ? now() : null,
                    ]);
                    if ($details['needsVideoProcessing']) {
                        $queuedMediaIds[] = $row->id;
                    }
                }

                return $record;
            });
            $databaseCommitted = true;
            foreach ($queuedMediaIds as $mediaId) {
                try {
                    $status = DB::table('request_media')->where('id', $mediaId)->value('processing_status');
                    if ($status === 'queued') {
                        OptimizeRequestVideo::dispatch($mediaId);
                    } else {
                        OptimizeRequestVideo::dispatchSync($mediaId);
                    }
                } catch (Throwable $dispatchError) {
                    // Keep the source usable and recorded if the queue is temporarily unavailable.
                    DB::table('request_media')->where('id', $mediaId)->update([
                        'processing_status' => 'ready',
                        'processing_error' => 'Traitement différé indisponible; la vidéo originale est conservée.',
                        'processing_completed_at' => now(),
                    ]);
                    report($dispatchError);
                }
            }
            $rows = DB::table('service_requests')->where('id', $created['id'])->get();

            return response()->json(['request' => $this->withMedia($rows)->first()], 201);
        } catch (Throwable $error) {
            if (! $databaseCommitted) {
                foreach ($savedFiles as $stored) {
                    Storage::disk($stored['disk'])->delete($stored['key']);
                }
            }
            throw $error;
        }
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        DB::transaction(function () use ($request, $id) {
            DB::statement("select set_config('request.jwt.claim.sub', ?, true)", [$request->user()->id]);
            DB::select('select public.cancel_service_request(?::uuid)', [$id]);
        });

        return response()->json(['message' => 'Demande annulée.']);
    }

    private function withMedia($requests)
    {
        $requestIds = $requests->pluck('id');
        $mediaByRequest = $requestIds->isEmpty()
            ? collect()
            : DB::table('request_media')->whereIn('request_id', $requestIds)->orderBy('created_at')->get()->groupBy('request_id');

        return $requests->map(function ($row) use ($mediaByRequest) {
            if (is_string($row->address_snapshot ?? null)) {
                $row->address_snapshot = json_decode($row->address_snapshot, true) ?: [];
            }
            $row->request_media = $mediaByRequest->get($row->id, collect())->map(function ($media) {
                $media->url = URL::temporarySignedRoute('api.media.show', now()->addHour(), ['media' => $media->id], false);
                if ($media->thumbnail_object_key ?? null) {
                    $media->thumbnail_url = URL::temporarySignedRoute('api.media.show', now()->addHour(), ['media' => $media->id, 'variant' => 'thumbnail'], false);
                }

                return $media;
            });

            return $row;
        });
    }

    private function offersFor(string $requestId)
    {
        return DB::table('offers')->join('technicians', 'offers.technician_id', '=', 'technicians.id')
            ->where('offers.request_id', $requestId)
            ->select(['offers.*', 'technicians.id as joined_technician_id', 'technicians.name', 'technicians.specialty', 'technicians.rating', 'technicians.review_count', 'technicians.completed_jobs', 'technicians.experience_years', 'technicians.biography', 'technicians.avatar_url'])
            ->orderBy('offers.created_at')->get()->map(function ($row) {
                $item = (array) $row;
                $item['technicians'] = [
                    'id' => $row->joined_technician_id, 'name' => $row->name, 'specialty' => $row->specialty,
                    'rating' => $row->rating, 'review_count' => $row->review_count, 'completed_jobs' => $row->completed_jobs,
                    'experience_years' => $row->experience_years, 'biography' => $row->biography, 'avatar_url' => $row->avatar_url,
                ];
                foreach (['joined_technician_id', 'name', 'specialty', 'rating', 'review_count', 'completed_jobs', 'experience_years', 'biography', 'avatar_url'] as $field) {
                    unset($item[$field]);
                }

                return $item;
            });
    }
}
