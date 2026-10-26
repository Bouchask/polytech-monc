<?php

namespace App\Services\Media;

use Symfony\Component\Process\Process;

class MediaInspectionService
{
    /** Return verified stream/container information, or null if ffprobe is unavailable. */
    public function inspect(string $path): ?array
    {
        $process = new Process([
            config('media.ffprobe'), '-v', 'error', '-show_format', '-show_streams',
            '-of', 'json', $path,
        ]);
        $process->setTimeout((float) config('media.process_timeout_seconds', 600));

        try {
            $process->run();
            if (! $process->isSuccessful()) {
                return null;
            }
            $data = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        $video = collect($data['streams'] ?? [])->firstWhere('codec_type', 'video');
        $audio = collect($data['streams'] ?? [])->firstWhere('codec_type', 'audio');
        $format = $data['format'] ?? [];

        return [
            'duration_ms' => isset($format['duration']) ? (int) round((float) $format['duration'] * 1000) : null,
            'container' => $format['format_name'] ?? null,
            'video_codec' => $video['codec_name'] ?? null,
            'audio_codec' => $audio['codec_name'] ?? null,
            'width' => isset($video['width']) ? (int) $video['width'] : null,
            'height' => isset($video['height']) ? (int) $video['height'] : null,
            'frame_rate' => isset($video['avg_frame_rate']) ? $this->fraction($video['avg_frame_rate']) : null,
            'video_start_ms' => isset($video['start_time']) ? (int) round((float) $video['start_time'] * 1000) : null,
            'audio_start_ms' => isset($audio['start_time']) ? (int) round((float) $audio['start_time'] * 1000) : null,
            'sample_rate' => isset($audio['sample_rate']) ? (int) $audio['sample_rate'] : null,
            'channels' => isset($audio['channels']) ? (int) $audio['channels'] : null,
            'audio_bitrate' => isset($audio['bit_rate']) ? (int) $audio['bit_rate'] : null,
        ];
    }

    private function fraction(string $value): ?float
    {
        [$numerator, $denominator] = array_pad(explode('/', $value, 2), 2, '1');

        return (float) $denominator === 0.0 ? null : (float) $numerator / (float) $denominator;
    }
}
