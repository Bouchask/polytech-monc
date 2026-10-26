<?php

namespace App\Jobs;

use App\Services\Media\MediaInspectionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Throwable;

class OptimizeRequestVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout;

    public function __construct(public readonly string $mediaId)
    {
        $this->timeout = (int) config('media.process_timeout_seconds', 600) + 60;
    }

    public function middleware(): array
    {
        return [(new WithoutOverlapping('media-video-'.$this->mediaId))->expireAfter($this->timeout + 60)];
    }

    public function handle(MediaInspectionService $inspection): void
    {
        $row = DB::table('request_media')->where('id', $this->mediaId)->first();
        if (! $row || ! in_array(($row->processing_status ?? null), ['queued', 'processing'], true)) {
            return;
        }
        $diskName = $row->object_disk ?: config('media.disk', 'local');
        $disk = Storage::disk($diskName);
        $sourceKey = 'request-media/'.$row->storage_path;
        DB::table('request_media')->where('id', $this->mediaId)->update(['processing_status' => 'processing', 'processing_started_at' => now(), 'processing_error' => null]);
        $sourceStream = $disk->readStream($sourceKey);
        if ($sourceStream === false) {
            throw new \RuntimeException('Source video object is not available.');
        }

        $directory = storage_path('app/media-tmp');
        if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            fclose($sourceStream);
            throw new \RuntimeException('Cannot create media workspace.');
        }
        $sourcePath = tempnam($directory, 'video-in-');
        if ($sourcePath === false) {
            fclose($sourceStream);
            throw new \RuntimeException('Cannot allocate source workspace.');
        }
        $outputPathBase = tempnam($directory, 'video-out-');
        if ($outputPathBase === false) {
            fclose($sourceStream);
            @unlink($sourcePath);
            throw new \RuntimeException('Cannot allocate output workspace.');
        }
        @unlink($outputPathBase);
        $outputPath = $outputPathBase.'.mp4';
        $targetKey = null;
        try {
            $target = fopen($sourcePath, 'wb');
            if ($target === false) {
                throw new \RuntimeException('Cannot open temporary video file.');
            }
            try {
                stream_copy_to_stream($sourceStream, $target);
            } finally {
                fclose($target);
                fclose($sourceStream);
            }

            $sourceInfo = $inspection->inspect($sourcePath);
            if ($sourceInfo === null || $sourceInfo['video_codec'] === null) {
                DB::table('request_media')->where('id', $this->mediaId)->update(['processing_status' => 'ready', 'processing_error' => 'Probe indisponible; fichier original conservé.', 'processing_completed_at' => now()]);

                return;
            }

            $profile = (string) config('media.video.profile', 'mobile_standard');
            if ($profile === 'archive_original') {
                DB::table('request_media')->where('id', $this->mediaId)->update([
                    'processing_status' => 'ready', 'processing_error' => null,
                    'output_codec' => $sourceInfo['video_codec'].($sourceInfo['audio_codec'] ? '/'.$sourceInfo['audio_codec'] : ''),
                    'processed_width' => $sourceInfo['width'], 'processed_height' => $sourceInfo['height'],
                    'processing_completed_at' => now(),
                ]);

                return;
            }
            $profileOptions = config("media.video.profiles.{$profile}", config('media.video.profiles.mobile_standard'));
            $maxWidth = (int) ($profileOptions['max_width'] ?? config('media.video.max_width', 1920));
            $maxHeight = (int) ($profileOptions['max_height'] ?? config('media.video.max_height', 1080));
            if ($row->mime_type === 'video/mp4'
                && $sourceInfo['video_codec'] === 'h264'
                && ($sourceInfo['audio_codec'] === null || $sourceInfo['audio_codec'] === 'aac')
                && ($sourceInfo['width'] ?? PHP_INT_MAX) <= $maxWidth
                && ($sourceInfo['height'] ?? PHP_INT_MAX) <= $maxHeight) {
                DB::table('request_media')->where('id', $this->mediaId)->update([
                    'processing_status' => 'ready', 'processing_error' => null,
                    'original_codec' => 'h264'.($sourceInfo['audio_codec'] ? '/'.$sourceInfo['audio_codec'] : ''),
                    'output_codec' => 'h264'.($sourceInfo['audio_codec'] ? '/'.$sourceInfo['audio_codec'] : ''),
                    'processed_width' => $sourceInfo['width'], 'processed_height' => $sourceInfo['height'],
                    'processing_completed_at' => now(),
                ]);

                return;
            }

            $scale = 'scale=w=min('.$maxWidth.'\\,iw):h=min('.$maxHeight.'\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2';
            $process = new Process([
                config('media.ffmpeg'), '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', $sourcePath,
                '-map', '0:v:0', '-map', '0:a?', '-vf', $scale,
                '-c:v', 'libx264', '-preset', (string) ($profileOptions['preset'] ?? config('media.video.preset', 'veryfast')),
                '-crf', (string) max(18, min(30, (int) ($profileOptions['crf'] ?? config('media.video.crf', 22)))),
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', (string) ($profileOptions['audio_bitrate'] ?? config('media.video.audio_bitrate', '128k')),
                '-movflags', '+faststart', $outputPath,
            ]);
            $process->setTimeout((float) config('media.process_timeout_seconds', 600));
            $process->run();
            if (! $process->isSuccessful() || ! is_file($outputPath)) {
                throw new \RuntimeException('FFmpeg could not produce a compatible video.');
            }

            $resultInfo = $inspection->inspect($outputPath);
            $resultSize = (int) filesize($outputPath);
            $sourceDuration = $sourceInfo['duration_ms'];
            $resultDuration = $resultInfo['duration_ms'] ?? null;
            $durationTolerance = max(1000, (int) round(($sourceDuration ?? 0) * 0.02));
            $lostAudio = $sourceInfo['audio_codec'] !== null && ($resultInfo['audio_codec'] ?? null) === null;
            $badAudioCodec = $sourceInfo['audio_codec'] !== null && ($resultInfo['audio_codec'] ?? null) !== 'aac';
            $durationChanged = $sourceDuration !== null && $resultDuration !== null && abs($sourceDuration - $resultDuration) > $durationTolerance;
            $syncChanged = $sourceInfo['video_start_ms'] !== null && ($resultInfo['video_start_ms'] ?? null) !== null
                && abs($sourceInfo['video_start_ms'] - $resultInfo['video_start_ms']) > 500;
            if ($sourceInfo['audio_start_ms'] !== null && $sourceInfo['video_start_ms'] !== null
                && ($resultInfo['audio_start_ms'] ?? null) !== null && ($resultInfo['video_start_ms'] ?? null) !== null) {
                $sourceOffset = $sourceInfo['audio_start_ms'] - $sourceInfo['video_start_ms'];
                $resultOffset = $resultInfo['audio_start_ms'] - $resultInfo['video_start_ms'];
                $syncChanged = $syncChanged || abs($sourceOffset - $resultOffset) > 500;
            }
            $sourceRate = $sourceInfo['frame_rate'];
            $resultRate = $resultInfo['frame_rate'] ?? null;
            $frameRateChanged = $sourceRate !== null && $resultRate !== null && abs($sourceRate - $resultRate) > max(0.5, $sourceRate * 0.02);
            if ($resultInfo === null || $resultInfo['video_codec'] !== 'h264' || $lostAudio || $badAudioCodec || $durationChanged || $syncChanged || $frameRateChanged || $resultSize >= (int) $row->byte_size) {
                DB::table('request_media')->where('id', $this->mediaId)->update([
                    'processing_status' => 'ready', 'processing_error' => $resultInfo === null ? 'Validation du dérivé impossible; original conservé.' : ($lostAudio || $badAudioCodec || $durationChanged || $syncChanged || $frameRateChanged ? 'Validation audio/vidéo non conforme; original conservé.' : 'Original conservé car le dérivé n’est pas plus léger.'),
                    'processing_completed_at' => now(),
                ]);

                return;
            }

            $newRelativePath = preg_replace('/\.[^.]+$/', '', $row->storage_path).'.optimized.mp4';
            $targetKey = 'request-media/'.$newRelativePath;
            $stream = fopen($outputPath, 'rb');
            if ($stream === false || ! $disk->put($targetKey, $stream, ['ContentType' => 'video/mp4', 'visibility' => 'private'])) {
                if (is_resource($stream)) {
                    fclose($stream);
                }
                throw new \RuntimeException('Unable to store optimized video.');
            }
            fclose($stream);

            try {
                DB::table('request_media')->where('id', $this->mediaId)->update([
                    'storage_path' => $newRelativePath,
                    'mime_type' => 'video/mp4',
                    'file_name' => preg_replace('/\.[^.]+$/', '', $row->file_name).'.mp4',
                    'byte_size' => $resultSize,
                    'duration_ms' => $resultInfo['duration_ms'],
                    'compression_ratio' => round((1 - ($resultSize / max(1, (int) $row->original_size_bytes))) * 100, 2),
                    'processed_width' => $resultInfo['width'],
                    'processed_height' => $resultInfo['height'],
                    'processed_frame_rate' => $resultInfo['frame_rate'],
                    'processed_audio_bitrate' => $resultInfo['audio_bitrate'],
                    'output_codec' => $resultInfo['video_codec'].($resultInfo['audio_codec'] ? '/'.$resultInfo['audio_codec'] : ''),
                    'processing_status' => 'ready',
                    'processing_settings' => json_encode(['profile' => $profile] + $profileOptions, JSON_THROW_ON_ERROR),
                    'processing_error' => null,
                    'processing_completed_at' => now(),
                ]);
            } catch (Throwable $error) {
                $disk->delete($targetKey);
                throw $error;
            }
            $disk->delete($sourceKey);
        } finally {
            if (is_resource($sourceStream)) {
                fclose($sourceStream);
            }
            @unlink($sourcePath);
            @unlink($outputPath);
        }
    }

    public function failed(?Throwable $exception): void
    {
        DB::table('request_media')->where('id', $this->mediaId)->whereIn('processing_status', ['queued', 'processing'])->update([
            'processing_status' => 'failed',
            'processing_error' => 'Le traitement vidéo a échoué; le fichier original reste disponible.',
            'processing_completed_at' => now(),
        ]);
    }
}
