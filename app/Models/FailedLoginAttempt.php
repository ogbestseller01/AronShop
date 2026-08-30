<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Carbon\Carbon;

class FailedLoginAttempt extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $table = 'failed_login_attempts';

    protected $fillable = ['id', 'email', 'ip_address', 'attempt_count', 'last_attempt_at'];

    protected $casts = [
        'last_attempt_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->attempt_count)) {
                $model->attempt_count = 1;
            }
            if (empty($model->last_attempt_at)) {
                $model->last_attempt_at = Carbon::now();
            }
        });
    }

    /**
     * Record a failed login attempt.
     */
    public static function record(string $email, string $ip): self
    {
        $record = self::where('email', $email)->where('ip_address', $ip)->first();

        if ($record) {
            $record->increment('attempt_count');
            $record->update(['last_attempt_at' => Carbon::now()]);
            return $record;
        }

        return self::create([
            'email'          => $email,
            'ip_address'     => $ip,
            'attempt_count'  => 1,
            'last_attempt_at' => Carbon::now(),
        ]);
    }

    /**
     * Clear attempts for a given email/IP.
     */
    public static function clear(string $email, ?string $ip = null): void
    {
        $query = self::where('email', $email);
        if ($ip) {
            $query->where('ip_address', $ip);
        }
        $query->delete();
    }

    /**
     * Check if an IP is blocked (>= 10 failed attempts in last 24 hours).
     */
    public static function isIpBlocked(string $ip): bool
    {
        $count = self::where('ip_address', $ip)
            ->where('last_attempt_at', '>', Carbon::now()->subDay())
            ->sum('attempt_count');

        return $count >= 10;
    }

    /**
     * Get the number of attempts for an email/IP in the last 24h.
     */
    public static function getRecentAttempts(string $email, string $ip): int
    {
        return self::where('email', $email)
            ->where('ip_address', $ip)
            ->where('last_attempt_at', '>', Carbon::now()->subDay())
            ->sum('attempt_count');
    }
}