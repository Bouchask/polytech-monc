<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CleanupOrphanedMedia extends Command
{
    protected $signature = 'media:cleanup-orphans {--dry-run : Report candidates without deleting them}';

    protected $description = 'Remove old request-media R2 objects that have no Supabase metadata row';

    public function handle(): int
    {
        $temporaryDirectory = storage_path('app/media-tmp');
        if (is_dir($temporaryDirectory)) {
            foreach (new \DirectoryIterator($temporaryDirectory) as $temporaryFile) {
                if ($temporaryFile->isDot() || ! $temporaryFile->isFile()) {
                    continue;
                }
                if ($temporaryFile->getMTime() <= now()->subHours((int) config('media.cleanup_orphans_after_hours', 24))->timestamp) {
                    @unlink($temporaryFile->getPathname());
                }
            }
        }
        $diskName = (string) config('media.disk');
        if ($diskName !== 'r2') {
            $this->components->info('MEDIA_DISK is not r2; no cloud objects checked.');

            return self::SUCCESS;
        }
        $disk = Storage::disk($diskName);
        $cutoff = now()->subHours((int) config('media.cleanup_orphans_after_hours', 24))->timestamp;
        $batch = [];
        $removed = 0;
        $checked = 0;

        foreach ($disk->getDriver()->listContents('request-media', true) as $attributes) {
            if (! $attributes->isFile() || ($attributes->lastModified() ?? PHP_INT_MAX) > $cutoff) {
                continue;
            }
            $batch[] = $attributes->path();
            if (count($batch) >= 300) {
                $removed += $this->reconcileBatch($disk, $batch);
                $checked += count($batch);
                $batch = [];
            }
        }
        if ($batch !== []) {
            $removed += $this->reconcileBatch($disk, $batch);
            $checked += count($batch);
        }

        $this->components->info("Checked {$checked} old R2 objects; removed {$removed} orphan(s).".($this->option('dry-run') ? ' (dry run)' : ''));

        return self::SUCCESS;
    }

    private function reconcileBatch($disk, array $keys): int
    {
        $relativePaths = array_map(static fn (string $key) => preg_replace('#^request-media/#', '', $key), $keys);
        $rows = DB::table('request_media')->where(function ($query) use ($relativePaths, $keys) {
            $query->whereIn('storage_path', $relativePaths)
                ->orWhereIn('original_object_key', $keys)
                ->orWhereIn('thumbnail_object_key', $keys);
        })->where('object_disk', 'r2')->get(['storage_path', 'original_object_key', 'thumbnail_object_key']);
        $referenced = [];
        foreach ($rows as $row) {
            $referenced['request-media/'.$row->storage_path] = true;
            if ($row->original_object_key) {
                $referenced[$row->original_object_key] = true;
            }
            if ($row->thumbnail_object_key) {
                $referenced[$row->thumbnail_object_key] = true;
            }
        }

        $deleted = 0;
        foreach ($keys as $key) {
            if (isset($referenced[$key])) {
                continue;
            }
            if (! $this->option('dry-run')) {
                $disk->delete($key);
            }
            $deleted++;
        }

        return $deleted;
    }
}
