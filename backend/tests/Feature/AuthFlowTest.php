<?php

namespace Tests\Feature;

use App\Mail\VerificationCodeMail;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['personal_access_tokens', 'addresses', 'profiles', 'pending_registrations', 'password_reset_tokens', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name', 120);
            $table->string('phone', 24)->nullable();
            $table->string('name')->default('');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('remember_token')->nullable();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('pending_registrations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name', 120);
            $table->string('phone', 24)->nullable();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('otp_hash');
            $table->timestamp('expires_at');
            $table->timestamp('last_sent_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamps();
        });

        Schema::create('profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name', 120);
            $table->string('phone', 24)->default('');
            $table->string('email')->nullable();
            $table->timestamps();
        });

        Schema::create('addresses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('label', 80);
            $table->string('address', 300);
            $table->string('details', 500)->nullable();
            $table->float('latitude')->nullable();
            $table->float('longitude')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table): void {
            $table->id();
            $table->string('tokenable_type');
            $table->uuid('tokenable_id');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function test_registration_sends_a_hashed_otp_and_verification_creates_a_session(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'client@example.test',
            'phone' => '06 63 74 29 75',
            'password' => 'StrongPassword2026!',
        ])->assertAccepted();

        $pending = DB::table('pending_registrations')->where('email', 'client@example.test')->first();
        $this->assertNotNull($pending);
        $this->assertSame('+212663742975', $pending->phone);
        $this->assertNotSame('StrongPassword2026!', $pending->password);
        $this->assertNotSame('000000', $pending->otp_hash);

        $code = null;
        Mail::assertSent(VerificationCodeMail::class, function (VerificationCodeMail $mail) use (&$code): bool {
            $code = $mail->code;

            return $mail->purpose === 'signup';
        });

        $response = $this->postJson('/api/auth/verify-email', [
            'email' => 'client@example.test',
            'code' => $code,
        ])->assertCreated()->assertJsonPath('user.email', 'client@example.test');

        $this->assertNotEmpty($response->json('token'));
        $this->assertDatabaseHas('users', ['email' => 'client@example.test', 'phone' => '+212663742975']);
        $this->assertDatabaseMissing('pending_registrations', ['email' => 'client@example.test']);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'client@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertOk()->assertJsonPath('user.email', 'client@example.test');

        $this->withToken($login->json('token'))->getJson('/api/me')
            ->assertOk()->assertJsonPath('user.name', 'Test Client');
    }

    public function test_invalid_otp_does_not_create_an_account_and_attempts_are_recorded(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'otp@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertAccepted();

        $this->postJson('/api/auth/verify-email', [
            'email' => 'otp@example.test',
            'code' => '000000',
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['email' => 'otp@example.test']);
        $this->assertDatabaseHas('pending_registrations', ['email' => 'otp@example.test', 'attempts' => 1]);
    }

    public function test_otp_verification_stops_after_five_incorrect_codes(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'attempts@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertAccepted();

        for ($attempt = 0; $attempt < 6; $attempt++) {
            $this->postJson('/api/auth/verify-email', [
                'email' => 'attempts@example.test',
                'code' => '000000',
            ])->assertUnprocessable();
        }

        $this->assertDatabaseHas('pending_registrations', ['email' => 'attempts@example.test', 'attempts' => 5]);
        $this->assertDatabaseMissing('users', ['email' => 'attempts@example.test']);
    }

    public function test_unverified_users_cannot_log_in_and_private_routes_require_authentication(): void
    {
        DB::table('users')->insert([
            'id' => (string) Str::uuid(),
            'full_name' => 'Unverified Client',
            'name' => 'Unverified Client',
            'email' => 'unverified@example.test',
            'password' => Hash::make('StrongPassword2026!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'unverified@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertUnprocessable();

        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/requests')->assertUnauthorized();
    }

    public function test_signup_rejects_invalid_moroccan_mobile_numbers(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'bad-phone@example.test',
            'phone' => '0512345678',
            'password' => 'StrongPassword2026!',
        ])->assertUnprocessable()->assertJsonValidationErrors('phone');

        $this->assertDatabaseMissing('pending_registrations', ['email' => 'bad-phone@example.test']);
        Mail::assertNothingSent();
    }

    public function test_missing_gmail_smtp_credentials_fail_before_an_otp_is_persisted(): void
    {
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.gmail.com',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.username' => null,
            'mail.mailers.smtp.password' => null,
            'mail.from.address' => null,
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'smtp-missing@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertServiceUnavailable()->assertJsonPath(
            'message',
            'Le service e-mail n’est pas configuré. Renseignez MAIL_HOST, MAIL_PORT et MAIL_FROM_ADDRESS; pour Gmail, ajoutez aussi MAIL_USERNAME et MAIL_PASSWORD dans backend/.env, puis redémarrez Laravel.',
        );

        $this->assertDatabaseMissing('pending_registrations', ['email' => 'smtp-missing@example.test']);
    }

    public function test_expired_otp_is_rejected_without_creating_an_account(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'expired@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertAccepted();

        DB::table('pending_registrations')->where('email', 'expired@example.test')
            ->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/auth/verify-email', [
            'email' => 'expired@example.test',
            'code' => '123456',
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['email' => 'expired@example.test']);
    }

    public function test_signup_resend_cooldown_prevents_duplicate_email_delivery(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'cooldown@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertAccepted();

        $this->postJson('/api/auth/resend-signup', ['email' => 'cooldown@example.test'])
            ->assertStatus(429);

        Mail::assertSent(VerificationCodeMail::class, 1);
    }

    public function test_signup_resend_without_pending_registration_does_not_claim_a_code_was_sent(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/resend-signup', ['email' => 'missing@example.test'])
            ->assertAccepted()
            ->assertJsonPath('message', 'Si une inscription est en attente, un nouveau code sera envoyé.');

        Mail::assertNothingSent();
        $this->assertDatabaseMissing('pending_registrations', ['email' => 'missing@example.test']);
    }

    public function test_signup_for_an_existing_account_does_not_send_a_registration_otp(): void
    {
        Mail::fake();
        DB::table('users')->insert([
            'id' => (string) Str::uuid(),
            'full_name' => 'Existing Client',
            'name' => 'Existing Client',
            'email' => 'existing@example.test',
            'email_verified_at' => now(),
            'password' => Hash::make('StrongPassword2026!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Existing Client',
            'email' => 'existing@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertConflict()->assertJsonPath('code', 'account_exists');

        Mail::assertNothingSent();
        $this->assertDatabaseMissing('pending_registrations', ['email' => 'existing@example.test']);
    }

    public function test_failed_signup_delivery_keeps_pending_registration_available_for_retry(): void
    {
        $attempt = 0;
        $pendingMail = \Mockery::mock(PendingMail::class);
        $pendingMail->shouldReceive('send')
            ->twice()
            ->with(\Mockery::type(VerificationCodeMail::class))
            ->andReturnUsing(function () use (&$attempt): void {
                if (++$attempt === 1) {
                    throw new \RuntimeException('SMTP unavailable');
                }
            });
        Mail::shouldReceive('to')->twice()->with('delivery@example.test')->andReturn($pendingMail);

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'delivery@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertStatus(503);

        $this->assertDatabaseHas('pending_registrations', [
            'email' => 'delivery@example.test',
            'last_sent_at' => null,
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Test Client',
            'email' => 'delivery@example.test',
            'password' => 'StrongPassword2026!',
        ])->assertAccepted();

        $this->assertNotNull(DB::table('pending_registrations')->where('email', 'delivery@example.test')->value('last_sent_at'));
    }

    public function test_password_recovery_response_is_generic_and_a_valid_code_changes_password(): void
    {
        Mail::fake();
        $id = (string) Str::uuid();
        DB::table('users')->insert([
            'id' => $id,
            'full_name' => 'Verified Client',
            'name' => 'Verified Client',
            'email' => 'verified@example.test',
            'email_verified_at' => now(),
            'password' => Hash::make('OriginalPassword2026!'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $existingResponse = $this->postJson('/api/auth/password/forgot', ['email' => 'verified@example.test'])
            ->assertAccepted()->json('message');
        $missingResponse = $this->postJson('/api/auth/password/forgot', ['email' => 'missing@example.test'])
            ->assertAccepted()->json('message');
        $this->assertSame($existingResponse, $missingResponse);

        $code = null;
        Mail::assertSent(VerificationCodeMail::class, function (VerificationCodeMail $mail) use (&$code): bool {
            if ($mail->purpose !== 'reset') {
                return false;
            }
            $code = $mail->code;

            return true;
        });

        $this->postJson('/api/auth/password/reset', [
            'email' => 'verified@example.test',
            'code' => $code,
            'password' => 'ReplacementPassword2026!',
            'password_confirmation' => 'ReplacementPassword2026!',
        ])->assertOk();

        $this->postJson('/api/auth/login', [
            'email' => 'verified@example.test',
            'password' => 'ReplacementPassword2026!',
        ])->assertOk();
    }

    public function test_request_upload_rejects_a_file_whose_content_does_not_match_its_declared_type(): void
    {
        Storage::fake('local');
        $user = new User([
            'full_name' => 'Test Client',
            'name' => 'Test Client',
            'email' => 'media@example.test',
            'email_verified_at' => now(),
            'password' => Hash::make('StrongPassword2026!'),
        ]);
        $user->id = (string) Str::uuid();
        $user->save();
        $token = $user->createToken('media-test')->plainTextToken;

        $response = $this->withToken($token)->withHeader('Accept', 'application/json')->post('/api/requests', [
            'payload' => json_encode([
                'categoryId' => 'electricite',
                'serviceTypes' => ['Électricité'],
                'serviceItemIds' => [],
                'description' => 'Une prise ne fonctionne plus.',
                'urgency' => 'urgent',
                'address' => ['address' => 'Maarif, Casablanca'],
            ], JSON_THROW_ON_ERROR),
            'mediaMeta' => json_encode([['type' => 'image', 'name' => 'photo.jpg']], JSON_THROW_ON_ERROR),
            'media' => [UploadedFile::fake()->createWithContent('payload.txt', '<?php echo "not an image";')],
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('media');
        $this->assertCount(0, Storage::disk('local')->allFiles('request-media'));
    }

    public function test_request_upload_enforces_the_four_photo_limit_before_creating_a_request(): void
    {
        Storage::fake('local');
        $user = new User([
            'full_name' => 'Test Client',
            'name' => 'Test Client',
            'email' => 'photo-limit@example.test',
            'email_verified_at' => now(),
            'password' => Hash::make('StrongPassword2026!'),
        ]);
        $user->id = (string) Str::uuid();
        $user->save();
        $token = $user->createToken('photo-limit-test')->plainTextToken;
        $files = [];
        $metadata = [];

        for ($index = 0; $index < 5; $index++) {
            $name = "photo-{$index}.jpg";
            $files[] = UploadedFile::fake()->createWithContent($name, 'fake image content');
            $metadata[] = ['type' => 'image', 'name' => $name];
        }

        $response = $this->withToken($token)->withHeader('Accept', 'application/json')->post('/api/requests', [
            'payload' => json_encode([
                'categoryId' => 'electricite',
                'serviceTypes' => ['Électricité'],
                'serviceItemIds' => [],
                'description' => 'Une prise ne fonctionne plus.',
                'urgency' => 'urgent',
                'address' => ['address' => 'Maarif, Casablanca'],
            ], JSON_THROW_ON_ERROR),
            'mediaMeta' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'media' => $files,
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('media');
        $this->assertCount(0, Storage::disk('local')->allFiles('request-media'));
    }

    public function test_customer_cannot_delete_an_address_owned_by_another_customer(): void
    {
        $owner = $this->createVerifiedUser('address-owner@example.test');
        $otherCustomerToken = $this->createVerifiedUser('address-other@example.test')->createToken('test')->plainTextToken;
        $addressId = (string) Str::uuid();
        DB::table('addresses')->insert([
            'id' => $addressId,
            'user_id' => $owner->id,
            'label' => 'Maison',
            'address' => 'Maarif, Casablanca',
            'is_default' => true,
            'created_at' => now(),
        ]);

        $this->withToken($otherCustomerToken)->deleteJson('/api/addresses/'.$addressId)->assertNotFound();
        $this->assertDatabaseHas('addresses', ['id' => $addressId, 'user_id' => $owner->id]);
    }

    public function test_email_cannot_be_changed_without_the_separate_verification_flow(): void
    {
        $token = $this->createVerifiedUser('profile@example.test')->createToken('test')->plainTextToken;

        $this->withToken($token)->patchJson('/api/me/profile', [
            'name' => 'Verified Client',
            'email' => 'new-address@example.test',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('users', ['email' => 'profile@example.test']);
        $this->assertDatabaseMissing('users', ['email' => 'new-address@example.test']);
    }

    private function createVerifiedUser(string $email): User
    {
        $user = new User([
            'full_name' => 'Test Client',
            'name' => 'Test Client',
            'email' => $email,
            'email_verified_at' => now(),
            'password' => Hash::make('StrongPassword2026!'),
        ]);
        $user->id = (string) Str::uuid();
        $user->save();

        return $user;
    }
}
