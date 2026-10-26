<?php

namespace App\Services\Media;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MediaUploadService
{
    public function __construct(
        private readonly ImageOptimizationService $images,
        private readonly AudioOptimizationService $audio,
    ) {}

    /** @return array<string, mixed> */
    public function store(UploadedFile $file, string $expectedType, string $ownerId, ?int $clientDurationMs = null): array
    {
        $size = (int) $file->getSize();
        $limit = (int) config("media.max_bytes.{$expectedType}", 0);
        if (! $file->isValid() || $size < 1 || $size > $limit) {
            throw ValidationException::withMessages(['media' => 'La taille ou la lecture d’une pièce jointe est invalide.']);
        }

        $sourcePath = $file->getRealPath();
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($sourcePath) ?: 'application/octet-stream';
        $type = $this->typeFromMime($mime);
        if ($type !== $expectedType || ! $this->hasValidSignature($sourcePath, $mime)) {
            throw ValidationException::withMessages(['media' => 'Le contenu réel du fichier ne correspond pas à une image, vidéo ou piste audio prise en charge.']);
        }

        $diskName = (string) config('media.disk', 'local');
        $disk = Storage::disk($diskName);
        $workingDirectory = storage_path('app/media-tmp');
        if (! is_dir($workingDirectory) && ! mkdir($workingDirectory, 0700, true) && ! is_dir($workingDirectory)) {
            throw new \RuntimeException('Impossible de préparer le traitement média.');
        }

        $sourceName = basename((string) $file->getClientOriginalName());
        $sourceName = preg_replace('/[\x00-\x1F\x7F\/\\\\]/u', '_', $sourceName) ?? '';
        $sourceExtension = strtolower(pathinfo($sourceName, PATHINFO_EXTENSION));
        $sourceExtension = $this->canonicalExtension($mime, $sourceExtension);
        $uuid = (string) Str::uuid();
        $folder = $ownerId.'/'.$uuid;
        $originalStoragePath = $folder.'/original.'.$sourceExtension;
        $storedStoragePath = $originalStoragePath;
        $storedMime = $mime;
        $processedPath = $sourcePath;
        $derivedFile = null;
        $thumbnailPath = null;
        $thumbStoragePath = null;
        $originalWidth = null;
        $originalHeight = null;
        $processedWidth = null;
        $processedHeight = null;
        $profile = match ($type) {
            'image' => config('media.image.profile', 'standard'),
            'audio' => config('media.audio.profile', 'preserve_original'),
            default => config('media.video.profile', 'mobile_standard'),
        };
        $probe = null;
        $originalCodec = null;
        $outputCodec = null;
        $sampleRate = null;
        $audioBitrate = null;
        $originalAudioBitrate = null;
        $channels = null;
        $frameRate = null;
        $imageSettings = null;
        $durationMs = $clientDurationMs;
        $originalKey = null;

        try {
            if ($type === 'image') {
                try {
                    $optimized = $this->images->optimize($sourcePath, $workingDirectory);
                } catch (Throwable $error) {
                    throw ValidationException::withMessages(['media' => 'Cette image est endommagée ou son format n’est pas pris en charge.']);
                }
                $processedPath = $optimized['path'];
                $derivedFile = $processedPath !== $sourcePath ? $processedPath : null;
                $storedMime = $optimized['mime_type'];
                $storedStoragePath = $folder.'/image.'.$optimized['extension'];
                $originalWidth = $optimized['original_width'];
                $originalHeight = $optimized['original_height'];
                $processedWidth = $optimized['width'];
                $processedHeight = $optimized['height'];
                $profile = $optimized['profile'];
                $thumbnailPath = $optimized['thumbnail_path'] ?? null;
                $imageSettings = $optimized['settings'] ?? ['format' => 'preserved_original'];
            } else {
                $storedMime = $this->normalizedMime($mime);
                $probe = app(MediaInspectionService::class)->inspect($sourcePath);
                if ($probe === null && (bool) config('media.require_probe', false)) {
                    throw ValidationException::withMessages(['media' => 'L’inspection média est temporairement indisponible. Réessayez plus tard.']);
                }
                if ($probe !== null && (($type === 'video' && $probe['video_codec'] === null)
                    || ($type === 'audio' && $probe['audio_codec'] === null))) {
                    throw ValidationException::withMessages(['media' => 'Le fichier ne contient pas de piste audio ou vidéo valide.']);
                }
                if ($probe !== null) {
                    $durationMs = $probe['duration_ms'] ?? $durationMs;
                    $originalCodec = $type === 'video'
                        ? $probe['video_codec'].($probe['audio_codec'] ? '/'.$probe['audio_codec'] : '')
                        : $probe['audio_codec'];
                    $outputCodec = $originalCodec;
                    $originalWidth = $processedWidth = $probe['width'];
                    $originalHeight = $processedHeight = $probe['height'];
                    $sampleRate = $probe['sample_rate'];
                    $channels = $probe['channels'];
                    $audioBitrate = $originalAudioBitrate = $probe['audio_bitrate'];
                    $frameRate = $probe['frame_rate'];
                }
                if ($type === 'audio') {
                    $optimizedAudio = $this->audio->optimize($sourcePath, $workingDirectory, $probe);
                    if ($optimizedAudio['changed']) {
                        $processedPath = $optimizedAudio['path'];
                        $derivedFile = $processedPath;
                        $storedMime = $optimizedAudio['mime_type'];
                        $storedStoragePath = $folder.'/audio.'.$optimizedAudio['extension'];
                        $outputCodec = $optimizedAudio['codec'];
                        $sampleRate = $optimizedAudio['sample_rate'];
                        $channels = $optimizedAudio['channels'];
                        $audioBitrate = $optimizedAudio['bitrate'];
                        $durationMs = $optimizedAudio['duration_ms'] ?? $durationMs;
                    }
                    $profile = $optimizedAudio['profile'];
                    $audioSettings = $optimizedAudio['settings'];
                }
                $durationLimit = (int) config("media.{$type}.max_duration_seconds", $type === 'video' ? 180 : 3600) * 1000;
                if ($durationMs !== null && ($durationMs < 0 || $durationMs > $durationLimit)) {
                    throw ValidationException::withMessages(['media' => $type === 'video' ? 'La vidéo ne peut pas dépasser 3 minutes.' : 'Le message audio ne peut pas dépasser 60 minutes.']);
                }
            }

            if ($type === 'video') {
                $queueVideo = (bool) config('media.video.async', false)
                    && config('queue.default') !== 'sync'
                    && config('media.video.profile') !== 'archive_original'
                    && $size >= (int) config('media.video.async_threshold_bytes', 20 * 1024 * 1024);
                $processInline = config('media.video.profile') !== 'archive_original'
                    && $size <= (int) config('media.video.sync_threshold_bytes', 8 * 1024 * 1024);
                $processingStatus = $queueVideo ? 'queued' : ($processInline ? 'processing' : 'ready');
            } else {
                $processingStatus = 'ready';
            }

            if ($type === 'image' && (bool) config('media.image.keep_original', false) && $derivedFile !== null) {
                $originalKey = 'request-media/'.$folder.'/source.'.$sourceExtension;
                $this->putFile($diskName, $originalKey, $sourcePath, $mime);
            }

            $objectKey = 'request-media/'.$storedStoragePath;
            $processedBytes = (int) (filesize($processedPath) ?: $size);
            $this->putFile($diskName, $objectKey, $processedPath, $storedMime);
            if ($thumbnailPath !== null && is_file($thumbnailPath)) {
                $thumbStoragePath = 'request-media/'.$folder.'/thumbnail.webp';
                $this->putFile($diskName, $thumbStoragePath, $thumbnailPath, 'image/webp');
            }
            if ($derivedFile !== null) {
                @unlink($derivedFile);
            }
            if ($thumbnailPath !== null) {
                @unlink($thumbnailPath);
            }

            $clientBaseName = pathinfo($sourceName, PATHINFO_FILENAME) ?: 'piece-jointe';
            $clientExtension = pathinfo($storedStoragePath, PATHINFO_EXTENSION);
            $clientBaseName = mb_substr($clientBaseName, 0, max(1, 254 - strlen($clientExtension)));
            $clientName = $clientBaseName.'.'.$clientExtension;
            $ratio = $size > 0 ? round((1 - ($processedBytes / $size)) * 100, 2) : 0;

            return [
                'type' => $type,
                'storagePath' => $storedStoragePath,
                'objectDisk' => $diskName,
                'fileName' => $clientName,
                'mimeType' => $storedMime,
                'originalMimeType' => $mime,
                'extension' => pathinfo($storedStoragePath, PATHINFO_EXTENSION),
                'byteSize' => $processedBytes,
                'originalSizeBytes' => $size,
                'compressionRatio' => $ratio,
                'durationMs' => $durationMs,
                'originalWidth' => $originalWidth,
                'originalHeight' => $originalHeight,
                'width' => $processedWidth,
                'height' => $processedHeight,
                'originalCodec' => $originalCodec,
                'outputCodec' => $outputCodec,
                'sampleRate' => $sampleRate,
                'channels' => $channels,
                'originalAudioBitrate' => $originalAudioBitrate,
                'processedAudioBitrate' => $audioBitrate,
                'originalFrameRate' => $frameRate,
                'processedFrameRate' => $frameRate,
                'profile' => $profile,
                'processingSettings' => match ($type) {
                    'image' => $imageSettings,
                    'audio' => $audioSettings ?? ['mode' => 'preserve_original'],
                    default => ['profile' => $profile, 'target' => 'h264/aac mp4'] + (array) config("media.video.profiles.{$profile}", config('media.video.profiles.mobile_standard')),
                },
                'processingStatus' => $processingStatus,
                'originalObjectKey' => $originalKey,
                'thumbnailObjectKey' => $thumbStoragePath,
                'uploadedObjectKeys' => array_values(array_filter([$objectKey, $originalKey, $thumbStoragePath])),
                'needsVideoProcessing' => $type === 'video' && in_array($processingStatus, ['queued', 'processing'], true),
                'sizeSavedBytes' => max(0, $size - $processedBytes),
            ];
        } catch (Throwable $error) {
            if (isset($objectKey)) {
                $disk->delete($objectKey);
            }
            if ($originalKey !== null) {
                $disk->delete($originalKey);
            }
            if ($thumbStoragePath !== null) {
                $disk->delete($thumbStoragePath);
            }
            if ($derivedFile !== null && is_file($derivedFile)) {
                @unlink($derivedFile);
            }
            if ($thumbnailPath !== null && is_file($thumbnailPath)) {
                @unlink($thumbnailPath);
            }
            throw $error;
        }
    }

    private function putFile(string $disk, string $key, string $path, string $mime): void
    {
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new \RuntimeException('Impossible de lire le fichier média préparé.');
        }
        try {
            $ok = Storage::disk($disk)->put($key, $stream, ['ContentType' => $mime, 'visibility' => 'private']);
        } finally {
            fclose($stream);
        }
        if (! $ok) {
            throw new \RuntimeException('Le stockage média a refusé le fichier.');
        }
        $storedSize = (int) Storage::disk($disk)->size($key);
        if ($storedSize !== (int) filesize($path)) {
            Storage::disk($disk)->delete($key);
            throw new \RuntimeException('La taille du fichier stocké ne correspond pas à la taille envoyée.');
        }
    }

    private function typeFromMime(string $mime): ?string
    {
        return match (true) {
            str_starts_with($mime, 'image/') => 'image',
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'audio/') || $mime === 'application/ogg' => 'audio',
            default => null,
        };
    }

    private function canonicalExtension(string $mime, string $provided): string
    {
        $extensions = [
            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/avif' => 'avif',
            'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm',
            'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/wav' => 'wav',
            'audio/x-wav' => 'wav', 'audio/aac' => 'aac', 'audio/ogg' => 'ogg', 'audio/webm' => 'webm',
            'audio/flac' => 'flac', 'audio/x-flac' => 'flac',
            'audio/aiff' => 'aiff', 'audio/x-aiff' => 'aiff', 'audio/amr' => 'amr',
            'audio/x-caf' => 'caf', 'audio/caf' => 'caf', 'audio/opus' => 'opus', 'application/ogg' => 'ogg',
        ];
        $canonical = $extensions[$mime] ?? null;
        $aliases = match ($mime) {
            'image/jpeg' => ['jpg', 'jpeg'],
            'audio/mp4', 'audio/x-m4a' => ['m4a', 'mp4'],
            'audio/ogg', 'application/ogg' => ['ogg', 'oga', 'opus'],
            'video/mp4' => ['mp4', 'm4v'],
            default => $canonical ? [$canonical] : [],
        };
        if ($canonical === null || ($provided !== '' && ! in_array($provided, $aliases, true))) {
            throw ValidationException::withMessages(['media' => 'L’extension du fichier ne correspond pas à son format réel.']);
        }

        return $canonical;
    }

    private function normalizedMime(string $mime): string
    {
        return match ($mime) {
            'audio/x-wav' => 'audio/wav',
            'audio/x-m4a' => 'audio/mp4',
            'audio/x-flac' => 'audio/flac',
            'application/ogg' => 'audio/ogg',
            default => $mime,
        };
    }

    private function hasValidSignature(string $path, string $mime): bool
    {
        $handle = fopen($path, 'rb');
        $head = $handle ? (string) fread($handle, 32) : '';
        if ($handle) {
            fclose($handle);
        }
        if (str_starts_with($mime, 'image/')) {
            return @getimagesize($path) !== false;
        }
        if (str_starts_with($mime, 'video/') || str_starts_with($mime, 'audio/')) {
            return str_contains($head, 'ftyp')
                || str_starts_with($head, "\x1A\x45\xDF\xA3")
                || str_starts_with($head, 'RIFF')
                || str_starts_with($head, 'OggS')
                || str_starts_with($head, 'fLaC')
                || str_starts_with($head, 'ID3')
                || str_starts_with($head, 'FORM')
                || str_starts_with($head, 'caff')
                || str_starts_with($head, '#!AMR')
                || (strlen($head) > 1 && ord($head[0]) === 0xFF && (ord($head[1]) & 0xE0) === 0xE0);
        }

        return false;
    }
}
