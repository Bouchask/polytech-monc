<?php

return [
    'disk' => env('MEDIA_DISK', env('FILESYSTEM_DISK', 'local')),
    'max_bytes' => [
        'image' => (int) env('MEDIA_IMAGE_MAX_BYTES', 20 * 1024 * 1024),
        'audio' => (int) env('MEDIA_AUDIO_MAX_BYTES', 20 * 1024 * 1024),
        'video' => (int) env('MEDIA_VIDEO_MAX_BYTES', 100 * 1024 * 1024),
    ],
    'max_request_bytes' => (int) env('MEDIA_REQUEST_MAX_BYTES', 220 * 1024 * 1024),
    'image' => [
        'profile' => env('MEDIA_IMAGE_PROFILE', 'standard'),
        'quality' => (int) env('MEDIA_IMAGE_QUALITY', 85),
        'max_width' => (int) env('MEDIA_IMAGE_MAX_WIDTH', 2560),
        'max_height' => (int) env('MEDIA_IMAGE_MAX_HEIGHT', 2560),
        'max_pixels' => (int) env('MEDIA_IMAGE_MAX_PIXELS', 40000000),
        'keep_original' => (bool) env('MEDIA_IMAGE_KEEP_ORIGINAL', false),
        'thumbnail' => (bool) env('MEDIA_IMAGE_THUMBNAIL', true),
    ],
    'audio' => [
        'profile' => env('MEDIA_AUDIO_PROFILE', 'preserve_original'),
        'max_duration_seconds' => (int) env('MEDIA_AUDIO_MAX_DURATION_SECONDS', 3600),
        'profiles' => [
            'voice_compact' => ['codec' => 'libopus', 'extension' => 'ogg', 'mime_type' => 'audio/ogg', 'bitrate' => env('MEDIA_AUDIO_VOICE_COMPACT_BITRATE', '32k'), 'sample_rate' => (int) env('MEDIA_AUDIO_VOICE_COMPACT_SAMPLE_RATE', 48000), 'channels' => 1],
            'voice_high_quality' => ['codec' => 'aac', 'extension' => 'm4a', 'mime_type' => 'audio/mp4', 'bitrate' => env('MEDIA_AUDIO_VOICE_HIGH_QUALITY_BITRATE', '96k'), 'sample_rate' => (int) env('MEDIA_AUDIO_VOICE_HIGH_QUALITY_SAMPLE_RATE', 48000), 'channels' => null],
            'music_high_quality' => ['codec' => 'aac', 'extension' => 'm4a', 'mime_type' => 'audio/mp4', 'bitrate' => env('MEDIA_AUDIO_MUSIC_HIGH_QUALITY_BITRATE', '192k'), 'sample_rate' => (int) env('MEDIA_AUDIO_MUSIC_HIGH_QUALITY_SAMPLE_RATE', 48000), 'channels' => null],
            'lossless_archive' => ['codec' => 'flac', 'extension' => 'flac', 'mime_type' => 'audio/flac', 'bitrate' => null, 'sample_rate' => null, 'channels' => null],
        ],
    ],
    'video' => [
        'profile' => env('MEDIA_VIDEO_PROFILE', 'mobile_standard'),
        'async' => (bool) env('MEDIA_VIDEO_ASYNC', false),
        'async_threshold_bytes' => (int) env('MEDIA_VIDEO_ASYNC_THRESHOLD_BYTES', 20 * 1024 * 1024),
        'sync_threshold_bytes' => (int) env('MEDIA_VIDEO_SYNC_THRESHOLD_BYTES', 8 * 1024 * 1024),
        'max_duration_seconds' => (int) env('MEDIA_VIDEO_MAX_DURATION_SECONDS', 180),
        'max_width' => (int) env('MEDIA_VIDEO_MAX_WIDTH', 1920),
        'max_height' => (int) env('MEDIA_VIDEO_MAX_HEIGHT', 1080),
        'crf' => (int) env('MEDIA_VIDEO_CRF', 22),
        'preset' => env('MEDIA_VIDEO_PRESET', 'veryfast'),
        'audio_bitrate' => env('MEDIA_VIDEO_AUDIO_BITRATE', '128k'),
        'profiles' => [
            'mobile_standard' => ['max_width' => (int) env('MEDIA_VIDEO_MAX_WIDTH', 1920), 'max_height' => (int) env('MEDIA_VIDEO_MAX_HEIGHT', 1080), 'crf' => (int) env('MEDIA_VIDEO_CRF', 22), 'preset' => env('MEDIA_VIDEO_PRESET', 'veryfast'), 'audio_bitrate' => env('MEDIA_VIDEO_AUDIO_BITRATE', '128k')],
            'mobile_high_quality' => ['max_width' => 1920, 'max_height' => 1080, 'crf' => (int) env('MEDIA_VIDEO_HIGH_QUALITY_CRF', 20), 'preset' => env('MEDIA_VIDEO_HIGH_QUALITY_PRESET', 'medium'), 'audio_bitrate' => env('MEDIA_VIDEO_HIGH_QUALITY_AUDIO_BITRATE', '160k')],
            'small_file' => ['max_width' => 1280, 'max_height' => 720, 'crf' => (int) env('MEDIA_VIDEO_SMALL_FILE_CRF', 26), 'preset' => env('MEDIA_VIDEO_SMALL_FILE_PRESET', 'veryfast'), 'audio_bitrate' => env('MEDIA_VIDEO_SMALL_FILE_AUDIO_BITRATE', '96k')],
            'archive_original' => ['preserve_original' => true],
        ],
    ],
    'ffmpeg' => env('FFMPEG_BINARY', 'ffmpeg'),
    'ffprobe' => env('FFPROBE_BINARY', 'ffprobe'),
    'process_timeout_seconds' => (int) env('MEDIA_PROCESS_TIMEOUT_SECONDS', 600),
    'require_probe' => (bool) env('MEDIA_REQUIRE_PROBE', env('APP_ENV') === 'production'),
    'cleanup_orphans_after_hours' => (int) env('MEDIA_ORPHAN_RETENTION_HOURS', 24),
];
