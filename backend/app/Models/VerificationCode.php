<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerificationCode extends Model
{
    public const PURPOSE_REGISTER = 'register';
    public const PURPOSE_RESET    = 'reset';

    /** Wrong guesses allowed before the code is destroyed. */
    public const MAX_ATTEMPTS = 5;

    protected $table = 'verification_codes';

    protected $fillable = ['email', 'code', 'purpose', 'expires_at'];

    protected $hidden = ['code'];

    protected $casts = ['expires_at' => 'datetime'];

    /** Replaces any pending code for this email + purpose and returns the new one. */
    public static function issue(string $email, string $purpose): string
    {
        $code = (string) random_int(100000, 999999);

        static::where('email', $email)->where('purpose', $purpose)->delete();
        static::create([
            'email'      => $email,
            'code'       => $code,
            'purpose'    => $purpose,
            'expires_at' => now()->addMinutes(10),
        ]);

        return $code;
    }

    /**
     * Checks and consumes a code. A wrong guess counts against the pending
     * code, which is deleted after MAX_ATTEMPTS failures.
     */
    public static function consume(string $email, string $purpose, string $code): bool
    {
        $record = static::where('email', $email)
            ->where('purpose', $purpose)
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();

        if (!$record) {
            return false;
        }

        if (!hash_equals($record->code, $code)) {
            $record->increment('attempts');
            if ($record->attempts >= self::MAX_ATTEMPTS) {
                $record->delete();
            }
            return false;
        }

        $record->delete();
        return true;
    }
}
