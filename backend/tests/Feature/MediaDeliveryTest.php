<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Tests\TestCase;

class MediaDeliveryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropIfExists('request_media');
        Schema::create('request_media', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('object_disk')->default('local');
            $table->string('storage_path');
            $table->string('file_name');
            $table->string('mime_type');
            $table->unsignedBigInteger('byte_size');
        });
    }

    public function test_signed_media_delivery_supports_byte_ranges_without_public_bucket_access(): void
    {
        Storage::fake('local');
        $id = (string) Str::uuid();
        Storage::disk('local')->put('request-media/user/'.$id.'/clip.mp4', '0123456789');
        DB::table('request_media')->insert([
            'id' => $id,
            'object_disk' => 'local',
            'storage_path' => 'user/'.$id.'/clip.mp4',
            'file_name' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'byte_size' => 10,
        ]);
        $signedUrl = URL::temporarySignedRoute('api.media.show', now()->addMinute(), ['media' => $id], false);

        $response = $this->get($signedUrl, ['Range' => 'bytes=2-5'])
            ->assertStatus(206)
            ->assertHeader('Content-Range', 'bytes 2-5/10')
            ->assertHeader('Content-Length', '4');
        ob_start();
        $response->baseResponse->sendContent();
        $body = ob_get_clean();
        $this->assertSame('2345', $body);
        $this->get('/api/media/'.$id)->assertForbidden();
    }
}
