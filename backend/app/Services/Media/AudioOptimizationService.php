<?php

namespace App\Services\Media;

use Symfony\Component\Process\Process;
use Throwable;

class AudioOptimizationService
{
    /** Preserve uploads by default; optional profiles transcode only when explicitly configured. */
    public function optimize(string $sourcePath, string $workingDirectory, ?array $probe): array
    {
        $profile = (string) config('media.audio.profile', 'preserve_original');
        $sourceSize = (int) filesize($sourcePath);
        $sourceCodec = $probe['audio_codec'] ?? null;
        $sourceChannels = $probe['channels'] ?? null;
        $sourceRate = $probe['sample_rate'] ?? null;
        $sourceBitrate = $probe['audio_bitrate'] ?? null;
        $profileOptions = config("media.audio.profiles.{$profile}");
        $keep = fn (string $effectiveProfile = 'preserve_original') => [
            'path' => $sourcePath, 'extension' => null, 'mime_type' => null,
            'codec' => $sourceCodec, 'channels' => $sourceChannels, 'sample_rate' => $sourceRate,
            'bitrate' => $sourceBitrate,
            'profile' => $effectiveProfile, 'settings' => ['mode' => 'preserve_original'],
            'changed' => false,
        ];

        if ($probe === null || $profile === 'preserve_original' || ! is_array($profileOptions)) {
            return $keep();
        }
        if ($profile === 'voice_compact' && $sourceCodec === 'opus' && $sourceChannels === 1
            && $sourceRate !== null && $sourceRate <= (int) ($profileOptions['sample_rate'] ?? 48000)
            && $sourceBitrate !== null && $sourceBitrate <= (int) (preg_replace('/[^0-9]/', '', $profileOptions['bitrate'] ?? '32k')) * 1000) {
            return $keep('voice_compact_already_opus');
        }
        if ($profile === 'voice_high_quality' && $sourceCodec === 'aac' && $sourceRate !== null && $sourceRate <= (int) ($profileOptions['sample_rate'] ?? 48000)
            && ($probe['audio_bitrate'] ?? 0) >= (int) (preg_replace('/[^0-9]/', '', $profileOptions['bitrate'] ?? '96k')) * 1000) {
            return $keep('voice_high_quality_already_aac');
        }
        if ($profile === 'music_high_quality' && $sourceCodec === 'aac' && $sourceRate !== null && $sourceRate <= (int) ($profileOptions['sample_rate'] ?? 48000)
            && ($probe['audio_bitrate'] ?? 0) >= (int) (preg_replace('/[^0-9]/', '', $profileOptions['bitrate'] ?? '192k')) * 1000) {
            return $keep('music_high_quality_already_aac');
        }
        if ($profile === 'lossless_archive' && in_array($sourceCodec, ['flac', 'pcm_s16le', 'pcm_s24le', 'alac'], true)) {
            return $keep('lossless_source_preserved');
        }

        $extension = $profileOptions['extension'] ?? null;
        if ($extension === null) {
            return $keep('preserve_original_unknown_profile');
        }
        $output = $workingDirectory.'/'.bin2hex(random_bytes(12)).'.'.$extension;
        $retainOutput = false;
        $arguments = [config('media.ffmpeg'), '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', $sourcePath, '-map', '0:a:0', '-vn'];
        $codec = (string) ($profileOptions['codec'] ?? '');
        array_push($arguments, '-c:a', $codec);
        if (! empty($profileOptions['bitrate'])) {
            array_push($arguments, '-b:a', (string) $profileOptions['bitrate']);
        }
        if (! empty($profileOptions['sample_rate']) && $sourceRate !== null) {
            array_push($arguments, '-ar', (string) min($sourceRate, (int) $profileOptions['sample_rate']));
        }
        if (! empty($profileOptions['channels'])) {
            array_push($arguments, '-ac', (string) $profileOptions['channels']);
        }
        if ($profile === 'voice_compact') {
            array_push($arguments, '-vbr', 'on', '-application', 'voip');
        }
        $settings = ['profile' => $profile] + $profileOptions;
        if ($profile === 'lossless_archive') {
            $settings['lossless'] = true;
        }
        array_push($arguments, $output);

        try {
            $process = new Process($arguments);
            $process->setTimeout((float) config('media.process_timeout_seconds', 600));
            $process->run();
            if (! $process->isSuccessful() || ! is_file($output)) {
                return $keep($profile.'_fallback_original');
            }
            $verified = app(MediaInspectionService::class)->inspect($output);
            if ($verified === null || $verified['audio_codec'] === null) {
                return $keep($profile.'_verification_failed_original');
            }
            $durationTolerance = max(1000, (int) round(($probe['duration_ms'] ?? 0) * 0.05));
            if (isset($probe['duration_ms'], $verified['duration_ms']) && abs($probe['duration_ms'] - $verified['duration_ms']) > $durationTolerance) {
                return $keep($profile.'_duration_check_failed_original');
            }
            if ($profile !== 'lossless_archive' && filesize($output) >= $sourceSize) {
                return $keep($profile.'_original_smaller');
            }
            if (filesize($output) > (int) config('media.max_bytes.audio', 20 * 1024 * 1024)) {
                return $keep($profile.'_output_exceeds_limit_original');
            }

            $retainOutput = true;

            return [
                'path' => $output,
                'extension' => $extension,
                'mime_type' => $profileOptions['mime_type'],
                'codec' => $verified['audio_codec'],
                'channels' => $verified['channels'],
                'sample_rate' => $verified['sample_rate'],
                'bitrate' => $verified['audio_bitrate'],
                'duration_ms' => $verified['duration_ms'],
                'profile' => $profile,
                'settings' => $settings,
                'changed' => true,
            ];
        } catch (Throwable) {
            return $keep($profile.'_fallback_original');
        } finally {
            if (! $retainOutput && is_file($output)) {
                @unlink($output);
            }
        }
    }
}
