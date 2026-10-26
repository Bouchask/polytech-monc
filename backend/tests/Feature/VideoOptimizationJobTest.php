<?php

namespace Tests\Feature;

use App\Jobs\OptimizeRequestVideo;
use App\Services\Media\MediaInspectionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VideoOptimizationJobTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropIfExists('request_media');
        Schema::create('request_media', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('object_disk')->default('local');
            $table->string('storage_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('byte_size');
            $table->string('processing_status');
            $table->text('processing_error')->nullable();
            $table->timestamp('processing_started_at')->nullable();
            $table->timestamp('processing_completed_at')->nullable();
        });
    }

    public function test_unprobeable_video_keeps_original_and_marks_media_ready(): void
    {
        Storage::fake('local');
        config(['media.disk' => 'local']);
        $id = 'media-test-id';
        $path = 'user/'.$id.'/original.mp4';
        $key = 'request-media/'.$path;
        Storage::disk('local')->put($key, pack('N', 24).'ftypmp42'.pack('N', 0).'mp42isom');
        DB::table('request_media')->insert([
            'id' => $id,
            'object_disk' => 'local',
            'storage_path' => $path,
            'mime_type' => 'video/mp4',
            'byte_size' => Storage::disk('local')->size($key),
            'processing_status' => 'queued',
        ]);

        (new OptimizeRequestVideo($id))->handle(app(MediaInspectionService::class));

        $this->assertSame('ready', DB::table('request_media')->where('id', $id)->value('processing_status'));
        Storage::disk('local')->assertExists($key);
    }
}
