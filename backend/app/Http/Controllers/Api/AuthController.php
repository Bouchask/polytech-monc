<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\VerificationCodeMail;
use App\Models\PendingRegistration;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:254'],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ]);

        $mailConfigurationError = $this->mailConfigurationError();
        if ($mailConfigurationError) {
            return response()->json(['message' => $mailConfigurationError], 503);
        }

        $email = Str::lower(trim($validated['email']));
        $rateKey = 'signup:'.hash('sha256', $email).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($rateKey, 5)) {
            return response()->json(['message' => 'Trop de demandes. Réessayez dans quelques minutes.'], 429);
        }
        RateLimiter::hit($rateKey, 3600);

        if (User::query()->where('email', $email)->exists()) {
            return response()->json([
                'code' => 'account_exists',
                'message' => 'Un compte est déjà associé à cette adresse e-mail. Connectez-vous ou réinitialisez votre mot de passe.',
            ], 409);
        }

        $phone = isset($validated['phone']) && trim($validated['phone']) !== ''
            ? $this->normalizeMoroccanPhone($validated['phone'])
            : null;

        $pending = PendingRegistration::query()->where('email', $email)->first();
        if ($pending?->last_sent_at && $pending->last_sent_at->gt(now()->subSeconds(60))) {
            return response()->json(['message' => 'Un code vient déjà d’être envoyé. Attendez une minute avant de le redemander.'], 429);
        }

        $code = (string) random_int(100000, 999999);
        $pending = PendingRegistration::query()->updateOrCreate(
            ['email' => $email],
            [
                'id' => $pending?->id ?? (string) Str::uuid(),
                'full_name' => trim($validated['name']),
                'phone' => $phone,
                'password' => Hash::make($validated['password']),
                'otp_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(10),
                'last_sent_at' => now(),
                'attempts' => 0,
            ],
        );

        try {
            Mail::to($email)->send(new VerificationCodeMail($code));
            Log::info('Signup OTP accepted by mail transport.', ['email_hash' => hash('sha256', $email)]);
        } catch (Throwable $error) {
            report($error);
            // Keep the pending registration so the customer can retry delivery
            // without re-entering their details. Clear the cooldown because no
            // message was accepted by the transport.
            $pending->forceFill(['last_sent_at' => null])->save();

            return response()->json(['message' => 'Le code n’a pas pu être envoyé. Vérifiez la configuration SMTP du backend puis réessayez.'], 503);
        }

        return response()->json(['message' => 'Si cette adresse peut être inscrite, un code de vérification vient d’être envoyé.'], 202);
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'code' => ['required', 'digits:6'],
        ]);
        $email = Str::lower(trim($validated['email']));

        $result = DB::transaction(function () use ($email, $validated) {
            $pending = PendingRegistration::query()->where('email', $email)->lockForUpdate()->first();
            if (! $pending || $pending->expires_at->isPast() || $pending->attempts >= 5) {
                return ['error' => 'Ce code est invalide ou expiré. Demandez-en un nouveau.'];
            }

            $pending->increment('attempts');
            if (! Hash::check($validated['code'], $pending->otp_hash)) {
                return ['error' => 'Le code saisi est incorrect.'];
            }

            if (User::query()->where('email', $email)->exists()) {
                return ['error' => 'Impossible de finaliser cette inscription. Connectez-vous ou réinitialisez votre mot de passe.'];
            }

            $user = new User([
                'full_name' => $pending->full_name,
                'name' => $pending->full_name,
                'phone' => $pending->phone,
                'email' => $pending->email,
                'password' => $pending->password,
                'email_verified_at' => now(),
            ]);
            // Keep primary-key mass assignment disabled while assigning
            // the server-generated UUID explicitly for this registration.
            $user->id = (string) Str::uuid();
            $user->save();

            DB::table('profiles')->updateOrInsert(
                ['id' => $user->id],
                ['full_name' => $user->full_name, 'phone' => $user->phone ?? '', 'email' => $user->email, 'updated_at' => now(), 'created_at' => now()],
            );

            $pending->delete();

            return ['user' => $user];
        });

        if (isset($result['error'])) {
            throw ValidationException::withMessages(['code' => $result['error']]);
        }
        $user = $result['user'];

        return $this->tokenResponse($user, 'palesso-mobile', 201);
    }

    public function resendSignup(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => ['required', 'email:rfc', 'max:254']]);
        $mailConfigurationError = $this->mailConfigurationError();
        if ($mailConfigurationError) {
            return response()->json(['message' => $mailConfigurationError], 503);
        }

        $email = Str::lower(trim($validated['email']));
        $pending = PendingRegistration::query()->where('email', $email)->first();
        if (! $pending) {
            Log::notice('Signup OTP resend skipped because no pending registration exists.', [
                'email_hash' => hash('sha256', $email),
            ]);

            return response()->json(['message' => 'Si une inscription est en attente, un nouveau code sera envoyé.'], 202);
        }
        if ($pending->last_sent_at && $pending->last_sent_at->gt(now()->subSeconds(60))) {
            return response()->json(['message' => 'Attendez une minute avant de demander un autre code.'], 429);
        }

        $code = (string) random_int(100000, 999999);
        $pending->forceFill(['otp_hash' => Hash::make($code), 'expires_at' => now()->addMinutes(10), 'last_sent_at' => now(), 'attempts' => 0])->save();
        try {
            Mail::to($email)->send(new VerificationCodeMail($code));
            Log::info('Resent signup OTP accepted by mail transport.', ['email_hash' => hash('sha256', $email)]);
        } catch (Throwable $error) {
            report($error);
            $pending->forceFill(['last_sent_at' => null])->save();

            return response()->json(['message' => 'Le nouveau code n’a pas pu être envoyé. Vérifiez le SMTP du backend.'], 503);
        }

        return response()->json(['message' => 'Un nouveau code a été envoyé.'], 202);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'string', 'max:128'],
        ]);
        $email = Str::lower(trim($validated['email']));
        $rateKey = 'login:'.hash('sha256', $email).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($rateKey, 8)) {
            return response()->json(['message' => 'Trop de tentatives. Réessayez plus tard.'], 429);
        }

        $user = User::query()->where('email', $email)->first();
        if (! $user || ! $user->password || ! $user->email_verified_at || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($rateKey, 900);

            return response()->json(['message' => 'E-mail ou mot de passe incorrect, ou adresse non vérifiée.'], 422);
        }

        RateLimiter::clear($rateKey);

        return $this->tokenResponse($user, 'palesso-mobile');
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Session fermée.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => ['required', 'email:rfc', 'max:254']]);
        $mailConfigurationError = $this->mailConfigurationError();
        if ($mailConfigurationError) {
            return response()->json(['message' => $mailConfigurationError], 503);
        }

        $email = Str::lower(trim($validated['email']));
        $user = User::query()->where('email', $email)->whereNotNull('email_verified_at')->first();
        if ($user) {
            $code = (string) random_int(100000, 999999);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($code), 'created_at' => now()],
            );
            try {
                Mail::to($email)->send(new VerificationCodeMail($code, 'reset'));
            } catch (Throwable $error) {
                report($error);

                return response()->json(['message' => 'L’e-mail de récupération n’a pas pu être envoyé. Vérifiez le SMTP du backend.'], 503);
            }
        }

        return response()->json(['message' => 'Si un compte vérifié correspond à cette adresse, un code de récupération a été envoyé.'], 202);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
        ]);
        $email = Str::lower(trim($validated['email']));
        $key = 'password-reset:'.hash('sha256', $email).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Trop de codes incorrects. Demandez un nouveau code.'], 429);
        }

        $reset = DB::table('password_reset_tokens')->where('email', $email)->first();
        if (! $reset || ! $reset->created_at || now()->subMinutes(10)->gt($reset->created_at) || ! Hash::check($validated['code'], $reset->token)) {
            RateLimiter::hit($key, 600);

            return response()->json(['message' => 'Ce code est invalide ou expiré.'], 422);
        }

        User::query()->where('email', $email)->update(['password' => Hash::make($validated['password']), 'updated_at' => now()]);
        $user = User::query()->where('email', $email)->first();
        $user?->tokens()->delete();
        DB::table('password_reset_tokens')->where('email', $email)->delete();
        RateLimiter::clear($key);

        return response()->json(['message' => 'Mot de passe modifié. Vous pouvez vous connecter.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
        ]);
        $user = $request->user();
        if (! $user->password || ! Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'Le mot de passe actuel est incorrect.'], 422);
        }
        $user->password = Hash::make($validated['password']);
        $user->save();

        return response()->json(['message' => 'Mot de passe modifié.']);
    }

    private function normalizeMoroccanPhone(string $phone): string
    {
        $value = preg_replace('/[\s().-]+/', '', trim($phone)) ?? '';
        if (preg_match('/^0([67]\d{8})$/', $value, $match)) {
            $value = '+212'.$match[1];
        } elseif (preg_match('/^212([67]\d{8})$/', $value, $match)) {
            $value = '+212'.$match[1];
        }
        if (! preg_match('/^\+212[67]\d{8}$/', $value)) {
            throw ValidationException::withMessages(['phone' => 'Saisissez un numéro mobile marocain valide.']);
        }

        return $value;
    }

    private function mailConfigurationError(): ?string
    {
        if (config('mail.default') !== 'smtp') {
            return null;
        }

        $smtp = config('mail.mailers.smtp', []);
        $host = strtolower((string) ($smtp['host'] ?? ''));
        $requiresGmailAuthentication = str_contains($host, 'smtp.gmail.com');
        $hasRequiredSettings = filled($host)
            && filled($smtp['port'] ?? null)
            && filled(config('mail.from.address'))
            && (! $requiresGmailAuthentication || (filled($smtp['username'] ?? null) && filled($smtp['password'] ?? null)));

        if ($hasRequiredSettings) {
            return null;
        }

        return 'Le service e-mail n’est pas configuré. Renseignez MAIL_HOST, MAIL_PORT et MAIL_FROM_ADDRESS; pour Gmail, ajoutez aussi MAIL_USERNAME et MAIL_PASSWORD dans backend/.env, puis redémarrez Laravel.';
    }

    private function tokenResponse(User $user, string $tokenName, int $status = 200): JsonResponse
    {
        $token = $user->createToken($tokenName, ['*'], now()->addDays(30))->plainTextToken;

        return response()->json(['token' => $token, 'user' => $this->userPayload($user)], $status);
    }

    private function userPayload(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->full_name ?: $user->name, 'phone' => $user->phone, 'email' => $user->email];
    }
}
