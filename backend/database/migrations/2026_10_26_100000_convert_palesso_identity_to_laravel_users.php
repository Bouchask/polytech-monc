<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Keep existing customer UUIDs and profiles while moving app ownership
        // away from Supabase Auth. Existing password hashes remain usable.
        DB::statement(<<<'SQL'
            INSERT INTO public.users (id, full_name, name, phone, email, email_verified_at, password, created_at, updated_at)
            SELECT
                id,
                COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''), email, 'Client Palesso'),
                COALESCE(NULLIF(raw_user_meta_data ->> 'full_name', ''), email, 'Client Palesso'),
                NULLIF(COALESCE(phone, raw_user_meta_data ->> 'phone', ''), ''),
                email,
                email_confirmed_at,
                NULLIF(encrypted_password, ''),
                COALESCE(created_at, now()),
                COALESCE(updated_at, now())
            FROM auth.users
            WHERE email IS NOT NULL AND email <> ''
            ON CONFLICT (id) DO NOTHING
        SQL);

        DB::statement('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey');
        DB::statement('ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey');
        DB::statement('ALTER TABLE public.addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_user_id_fkey');
        DB::statement('ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.request_media DROP CONSTRAINT IF EXISTS request_media_user_id_fkey');
        DB::statement('ALTER TABLE public.request_media ADD CONSTRAINT request_media_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey');
        DB::statement('ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE');

        DB::statement('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE public.personal_access_tokens ENABLE ROW LEVEL SECURITY');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $newUsers = (int) DB::table('users')->whereNotIn('id', DB::table('auth.users')->select('id'))->count();
        if ($newUsers > 0) {
            throw new RuntimeException('Cannot roll back identity migration while Laravel-authenticated customers exist. Export or migrate those accounts first.');
        }

        DB::statement('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey');
        DB::statement('ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey');
        DB::statement('ALTER TABLE public.addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_user_id_fkey');
        DB::statement('ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.request_media DROP CONSTRAINT IF EXISTS request_media_user_id_fkey');
        DB::statement('ALTER TABLE public.request_media ADD CONSTRAINT request_media_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey');
        DB::statement('ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE public.users DISABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE public.personal_access_tokens DISABLE ROW LEVEL SECURITY');
    }
};
