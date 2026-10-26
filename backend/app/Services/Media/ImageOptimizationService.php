<?php

namespace App\Services\Media;

use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Format;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;

class ImageOptimizationService
{
    /**
     * Decode (thereby validating) an image, auto-orient it, strip metadata, and
     * return an optimized derivative only when it is smaller than the source.
     */
    public function optimize(string $sourcePath, string $workingDirectory): array
    {
        $dimensions = @getimagesize($sourcePath);
        if (! is_array($dimensions) || $dimensions[0] < 1 || $dimensions[1] < 1
            || ($dimensions[0] * $dimensions[1]) > (int) config('media.image.max_pixels', 40000000)) {
            throw new \RuntimeException('Image dimensions exceed safe processing limits.');
        }
        $manager = new ImageManager(new GdDriver, autoOrientation: true, strip: true);
        $image = $manager->decodePath($sourcePath);
        $originalWidth = $image->width();
        $originalHeight = $image->height();
        $originalFormat = strtolower(Format::create($image->origin()->mediaType())->name);
        $originalBytes = filesize($sourcePath) ?: 0;
        $profile = (string) config('media.image.profile', 'standard');

        if ($profile === 'lossless') {
            return [
                'path' => $sourcePath,
                'mime_type' => mime_content_type($sourcePath) ?: 'application/octet-stream',
                'extension' => $this->extensionForFormat($originalFormat),
                'original_width' => $originalWidth,
                'original_height' => $originalHeight,
                'width' => $originalWidth,
                'height' => $originalHeight,
                'profile' => 'lossless_original',
                'changed' => false,
                'original_format' => $originalFormat,
                'thumbnail_path' => null,
                'settings' => ['format' => 'original_lossless', 'metadata_stripped' => false],
            ];
        }

        // Preserve animated images: this image driver optimizes still frames;
        // flattening an animation would silently alter user content.
        if ($image->isAnimated()) {
            return $this->unchanged($sourcePath, $originalWidth, $originalHeight, $originalFormat, 'animated_original');
        }

        $maxWidth = $profile === 'thumbnail' ? 640 : (int) config('media.image.max_width', 2560);
        $maxHeight = $profile === 'thumbnail' ? 640 : (int) config('media.image.max_height', 2560);
        if ($originalFormat === 'webp' && $originalWidth <= $maxWidth && $originalHeight <= $maxHeight) {
            $result = $this->unchanged($sourcePath, $originalWidth, $originalHeight, $originalFormat, 'already_webp');
            $result['thumbnail_path'] = $this->thumbnail($image, $workingDirectory);
            $result['settings'] = ['format' => 'webp_original', 'reencoded' => false];

            return $result;
        }
        $image->scaleDown(width: $maxWidth, height: $maxHeight);
        $targetFormat = Format::WEBP;
        $defaultQuality = match ($profile) {
            'thumbnail' => 78, 'high_quality' => 93, default => (int) config('media.image.quality', 85)
        };
        $quality = max(40, min(99, (int) config('media.image.'.$profile.'_quality', $defaultQuality)));
        $outputPath = $workingDirectory.'/'.bin2hex(random_bytes(12)).'.webp';
        $image->encodeUsingFormat($targetFormat, quality: $quality)->save($outputPath);

        $wasResized = $originalWidth > $maxWidth || $originalHeight > $maxHeight;
        if ((filesize($outputPath) ?: PHP_INT_MAX) >= $originalBytes && ! $wasResized) {
            @unlink($outputPath);

            $result = $this->unchanged($sourcePath, $originalWidth, $originalHeight, $originalFormat, 'original_smaller');
            $result['thumbnail_path'] = $this->thumbnail($image, $workingDirectory);

            return $result;
        }

        $processedWidth = $image->width();
        $processedHeight = $image->height();
        $thumbnailPath = $this->thumbnail($image, $workingDirectory);

        return [
            'path' => $outputPath,
            'mime_type' => 'image/webp',
            'extension' => 'webp',
            'original_width' => $originalWidth,
            'original_height' => $originalHeight,
            'width' => $processedWidth,
            'height' => $processedHeight,
            'profile' => $profile,
            'changed' => true,
            'original_format' => $originalFormat,
            'thumbnail_path' => $thumbnailPath,
            'quality' => $quality,
            'settings' => ['format' => 'webp_lossy', 'quality' => $quality, 'max_width' => $maxWidth, 'max_height' => $maxHeight, 'metadata_stripped' => true],
        ];
    }

    private function thumbnail(ImageInterface $image, string $workingDirectory): ?string
    {
        if (! (bool) config('media.image.thumbnail', true)) {
            return null;
        }
        try {
            $image->scaleDown(width: 640, height: 640);
            $target = $workingDirectory.'/'.bin2hex(random_bytes(12)).'.thumb.webp';
            $image->encodeUsingFormat(Format::WEBP, quality: 78)->save($target);

            return $target;
        } catch (\Throwable) {
            return null;
        }
    }

    private function unchanged(string $path, int $width, int $height, string $format, string $profile): array
    {
        return [
            'path' => $path,
            'mime_type' => mime_content_type($path) ?: 'application/octet-stream',
            'extension' => $this->extensionForFormat($format),
            'original_width' => $width,
            'original_height' => $height,
            'width' => $width,
            'height' => $height,
            'profile' => $profile,
            'changed' => false,
            'original_format' => $format,
            'settings' => ['format' => $format, 'reencoded' => false],
        ];
    }

    private function extensionForFormat(string $format): string
    {
        return match ($format) {
            'jpeg' => 'jpg',
            'png' => 'png',
            'webp' => 'webp',
            'avif' => 'avif',
            default => throw new \RuntimeException('Unsupported image output format.'),
        };
    }
}
