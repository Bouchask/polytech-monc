<?php

namespace Tests\Unit;

use App\Services\Media\MediaUploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MediaUploadServiceTest extends TestCase
{
    public function test_image_is_validated_optimized_and_written_to_private_storage(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local', 'media.image.thumbnail' => true, 'media.image.profile' => 'standard']);

        $path = tempnam(sys_get_temp_dir(), 'palesso-image-');
        $image = imagecreatetruecolor(900, 600);
        $color = imagecolorallocate($image, 35, 120, 190);
        imagefilledrectangle($image, 0, 0, 899, 599, $color);
        imagejpeg($image, $path, 92);
        imagedestroy($image);

        try {
            $upload = new UploadedFile($path, 'intervention.jpg', 'image/jpeg', null, true);
            $result = app(MediaUploadService::class)->store($upload, 'image', 'user-uuid');

            $this->assertSame('image', $result['type']);
            $this->assertSame('local', $result['objectDisk']);
            $this->assertGreaterThan(0, $result['originalSizeBytes']);
            $this->assertGreaterThan(0, $result['width']);
            Storage::disk('local')->assertExists('request-media/'.$result['storagePath']);
            $this->assertNotNull($result['thumbnailObjectKey']);
            Storage::disk('local')->assertExists($result['thumbnailObjectKey']);
        } finally {
            @unlink($path);
        }
    }

    public function test_malformed_image_content_is_rejected_instead_of_trusting_extension(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local']);
        $path = tempnam(sys_get_temp_dir(), 'palesso-invalid-');
        file_put_contents($path, 'not an image');

        try {
            $upload = new UploadedFile($path, 'fake.jpg', 'image/jpeg', null, true);
            try {
                app(MediaUploadService::class)->store($upload, 'image', 'user-uuid');
                $this->fail('Malformed image should be rejected.');
            } catch (ValidationException) {
                $this->assertSame([], Storage::disk('local')->allFiles('request-media'));
            }
        } finally {
            @unlink($path);
        }
    }

    public function test_existing_webp_keeps_a_valid_object_extension(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local']);
        $path = tempnam(sys_get_temp_dir(), 'palesso-webp-');
        $image = imagecreatetruecolor(32, 24);
        imagewebp($image, $path, 90);
        imagedestroy($image);

        try {
            $upload = new UploadedFile($path, 'already-optimized.webp', 'image/webp', null, true);
            $result = app(MediaUploadService::class)->store($upload, 'image', 'user-uuid');

            $this->assertSame('webp', $result['extension']);
            $this->assertStringEndsWith('.webp', $result['storagePath']);
            Storage::disk('local')->assertExists('request-media/'.$result['storagePath']);
        } finally {
            @unlink($path);
        }
    }

    public function test_declared_media_type_cannot_mismatch_detected_content(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local']);
        $path = tempnam(sys_get_temp_dir(), 'palesso-image-');
        $image = imagecreatetruecolor(20, 20);
        imagejpeg($image, $path);
        imagedestroy($image);

        try {
            $upload = new UploadedFile($path, 'picture.jpg', 'image/jpeg', null, true);
            $this->expectException(ValidationException::class);
            app(MediaUploadService::class)->store($upload, 'video', 'user-uuid');
        } finally {
            @unlink($path);
        }
    }

    public function test_supported_audio_is_kept_without_forced_reencoding(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local', 'media.audio.profile' => 'preserve_original']);
        $path = tempnam(sys_get_temp_dir(), 'palesso-audio-');
        $samples = str_repeat("\x80", 8000);
        $wav = pack('a4Va4a4VvvVVvv', 'RIFF', 36 + strlen($samples), 'WAVE', 'fmt ', 16, 1, 1, 8000, 8000, 1, 8)
            .pack('a4V', 'data', strlen($samples)).$samples;
        file_put_contents($path, $wav);

        try {
            $upload = new UploadedFile($path, 'voice.wav', 'audio/wav', null, true);
            $result = app(MediaUploadService::class)->store($upload, 'audio', 'user-uuid', 1000);

            $this->assertSame('audio', $result['type']);
            $this->assertSame('audio/wav', $result['mimeType']);
            $this->assertSame($result['originalSizeBytes'], $result['byteSize']);
            $this->assertSame('preserve_original', $result['profile']);
            Storage::disk('local')->assertExists('request-media/'.$result['storagePath']);
        } finally {
            @unlink($path);
        }
    }

    public function test_video_with_invalid_content_signature_is_rejected(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local']);
        $path = tempnam(sys_get_temp_dir(), 'palesso-video-');
        file_put_contents($path, str_repeat('not a video', 20));

        try {
            $upload = new UploadedFile($path, 'clip.mp4', 'video/mp4', null, true);
            $this->expectException(ValidationException::class);
            app(MediaUploadService::class)->store($upload, 'video', 'user-uuid', 1000);
        } finally {
            @unlink($path);
        }
    }

    public function test_storage_failure_is_reported_and_partial_object_is_removed(): void
    {
        config(['media.disk' => 'local', 'media.image.thumbnail' => false]);
        $disk = \Mockery::mock();
        $disk->shouldReceive('put')->once()->andReturn(false);
        $disk->shouldReceive('delete')->once()->withArgs(fn (string $key) => str_starts_with($key, 'request-media/user-uuid/'))->andReturn(true);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);

        $path = tempnam(sys_get_temp_dir(), 'palesso-image-');
        $image = imagecreatetruecolor(20, 20);
        imagejpeg($image, $path);
        imagedestroy($image);

        try {
            $upload = new UploadedFile($path, 'storage-failure.jpg', 'image/jpeg', null, true);
            $this->expectException(\RuntimeException::class);
            app(MediaUploadService::class)->store($upload, 'image', 'user-uuid');
        } finally {
            @unlink($path);
        }
    }
}
