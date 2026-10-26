<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerificationCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly string $code, public readonly string $purpose = 'signup') {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->purpose === 'reset' ? 'Réinitialisation du mot de passe Palesso' : 'Votre code de vérification Palesso');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.verification-code', with: ['code' => $this->code, 'purpose' => $this->purpose]);
    }
}
