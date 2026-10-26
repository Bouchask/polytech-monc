<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    public function show(Request $request, string $media)
    {
        abort_unless($request->hasValidSignature(false), 403);
        $row = DB::table('request_media')->where('id', $media)->first();
        abort_unless($row, 404);
        $diskName = $row->object_disk ?? 'local';
        $thumbnail = $request->query('variant') === 'thumbnail';
        if ($thumbnail) {
            abort_unless(is_string($row->thumbnail_object_key ?? null) && $row->thumbnail_object_key !== '', 404);
            $path = $row->thumbnail_object_key;
        } else {
            $path = 'request-media/'.$row->storage_path;
        }
        $disk = Storage::disk($diskName);
        abort_unless($disk->exists($path), 404);
        $stream = $disk->readStream($path);
        abort_if($stream === false, 404);
        $size = $thumbnail ? (int) $disk->size($path) : (int) $row->byte_size;
        $start = 0;
        $end = $size - 1;
        $status = 200;
        $range = $request->header('Range');
        if ($range !== null) {
            if (! preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $matches)
                || ($matches[1] === '' && $matches[2] === '') || str_contains($range, ',')) {
                fclose($stream);

                return response('', 416, ['Content-Range' => "bytes */{$size}", 'Accept-Ranges' => 'bytes']);
            }
            if ($matches[1] === '') {
                $suffixLength = min($size, (int) $matches[2]);
                $start = $size - $suffixLength;
            } else {
                $start = (int) $matches[1];
                if ($matches[2] !== '') {
                    $end = min($size - 1, (int) $matches[2]);
                }
            }
            if ($start >= $size || $end < $start) {
                fclose($stream);

                return response('', 416, ['Content-Range' => "bytes */{$size}", 'Accept-Ranges' => 'bytes']);
            }
            $status = 206;
        }
        $length = $end - $start + 1;
        $displayName = $thumbnail ? 'thumbnail.webp' : basename(str_replace('\\', '/', (string) $row->file_name));
        $displayName = preg_replace('/[\x00-\x1F\x7F]/u', '', $displayName) ?: 'media';

        return response()->stream(function () use ($stream, $start, $length): void {
            $streamInfo = stream_get_meta_data($stream);
            if ($start > 0 && ($streamInfo['seekable'] ?? false) && fseek($stream, $start) === 0) {
                $start = 0;
            }
            if ($start > 0) {
                $remainingSkip = $start;
                while ($remainingSkip > 0 && ! feof($stream)) {
                    $chunk = fread($stream, min(1024 * 1024, $remainingSkip));
                    if ($chunk === false || $chunk === '') {
                        break;
                    }
                    $remainingSkip -= strlen($chunk);
                }
            }
            $remaining = $length;
            while ($remaining > 0 && ! feof($stream)) {
                $chunk = fread($stream, min(1024 * 1024, $remaining));
                if ($chunk === false || $chunk === '') {
                    break;
                }
                echo $chunk;
                $remaining -= strlen($chunk);
            }
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, $status, [
            'Content-Type' => $thumbnail ? 'image/webp' : $row->mime_type,
            'Content-Length' => (string) $length,
            'Content-Disposition' => 'inline; filename="'.addcslashes($displayName, '"\\').'"',
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
            'Accept-Ranges' => 'bytes',
            ...($status === 206 ? ['Content-Range' => "bytes {$start}-{$end}/{$size}"] : []),
        ]);
    }
}
