<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Supabase/PostgreSQL crypt() emits the equivalent bcrypt $2a$ marker.
        // Laravel/PHP's strict bcrypt verifier expects $2y$; the hash payload
        // is unchanged, so normalizing this marker preserves the password.
        DB::table('users')
            ->where('password', 'like', '$2a$%')
            ->update(['password' => DB::raw("'$2y$' || substring(password from 5)")]);
    }

    public function down(): void
    {
        DB::table('users')
            ->where('password', 'like', '$2y$%')
            ->update(['password' => DB::raw("'$2a$' || substring(password from 5)")]);
    }
};
