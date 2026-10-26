<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name', 120);
            $table->string('email')->unique();
            $table->string('phone', 24)->nullable();
            $table->string('password');
            $table->string('otp_hash');
            $table->timestamp('expires_at')->index();
            $table->timestamp('last_sent_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamps();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_registrations');
    }
};
