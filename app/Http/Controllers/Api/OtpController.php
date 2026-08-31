<?php

namespace App\Http\Controllers\Api;

use App\Models\OTP;
use App\Traits\Auditable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class OTPController extends BaseApiController
{
    use Auditable;

    /**
     * List OTP records with filters and statistics
     * Permission: otp.view
     */
    public function index(Request $request)
    {
        $perm = $this->checkPermission('otp.view');
        if ($perm) return $perm;

        try {
            $query = OTP::query()->orderBy('created_at', 'desc');

            // Apply filters
            if ($request->filled('email')) {
                $query->where('email', 'LIKE', "%{$request->email}%");
            }

            if ($request->filled('type')) {
                $query->where('type', $request->type);
            }

            if ($request->has('is_used')) {
                $query->where('is_used', filter_var($request->is_used, FILTER_VALIDATE_BOOLEAN));
            }

            if ($request->filled('start_date')) {
                $query->whereDate('created_at', '>=', $request->start_date);
            }

            if ($request->filled('end_date')) {
                $query->whereDate('created_at', '<=', $request->end_date);
            }

            if ($request->get('expired') === 'true') {
                $query->where('expires_at', '<', Carbon::now())->where('is_used', false);
            }

            $otps = $query->paginate($request->get('per_page', 20));
            $stats = $this->getStats();

            return $this->successResponse([
                'data' => $otps,
                'stats' => $stats,
            ], 'OTP records retrieved successfully');

        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch OTP records');
        }
    }

    /**
     * Resend OTP (public endpoint – no permission check needed)
     * Validates email exists and rate-limits to 60 seconds.
     */
    public function resend(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email|exists:users,email'
            ]);

            $latestOtp = OTP::where('email', $request->email)
                ->where('is_used', false)
                ->latest()
                ->first();

            if ($latestOtp && $latestOtp->created_at->diffInSeconds(now()) < 60) {
                return $this->tooManyRequests('Please wait before requesting a new OTP');
            }

            // Generate and send new OTP
            $otp = OTP::create([
                'email' => $request->email,
                'type' => OTP::TYPE_LOGIN, // or appropriate type
                'expires_at' => Carbon::now()->addMinutes(10),
            ]);

            // @todo: Send OTP via email/SMS here
            // Mail::to($otp->email)->send(new OtpMail($otp));

            return $this->successResponse(null, 'OTP has been sent successfully');

        } catch (\Exception $e) {
            return $this->serverError('Failed to resend OTP');
        }
    }

    /**
     * Clean up expired (unused) OTP records
     * Permission: otp.cleanup
     */
    public function cleanup(Request $request)
    {
        $perm = $this->checkPermission('otp.cleanup');
        if ($perm) return $perm;

        try {
            $deleted = OTP::where('expires_at', '<', Carbon::now())
                ->where('is_used', false)
                ->delete();

            $this->logAudit('cleanup_expired_otps', 'otp', null, "Cleaned up {$deleted} expired OTP records");

            return $this->successResponse(
                ['deleted_count' => $deleted],
                "Cleaned up {$deleted} expired OTP records"
            );

        } catch (\Exception $e) {
            return $this->serverError('Failed to cleanup OTPs');
        }
    }

    /**
     * Clean up used OTP records older than 30 days
     * Permission: otp.cleanup
     */
    public function cleanupUsed(Request $request)
    {
        $perm = $this->checkPermission('otp.cleanup');
        if ($perm) return $perm;

        try {
            $deleted = OTP::where('is_used', true)
                ->where('created_at', '<', Carbon::now()->subDays(30))
                ->delete();

            $this->logAudit('cleanup_used_otps', 'otp', null, "Cleaned up {$deleted} used OTP records older than 30 days");

            return $this->successResponse(
                ['deleted_count' => $deleted],
                "Cleaned up {$deleted} used OTP records older than 30 days"
            );

        } catch (\Exception $e) {
            return $this->serverError('Failed to cleanup used OTPs');
        }
    }

    /**
     * Get OTP statistics
     * Permission: otp.view
     */
    public function stats(Request $request)
    {
        $perm = $this->checkPermission('otp.view');
        if ($perm) return $perm;

        try {
            return $this->successResponse($this->getStats(), 'Stats retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverError('Failed to retrieve stats');
        }
    }

    /**
     * Get OTP statistics helper method
     */
    private function getStats(): array
    {
        return [
            'total' => OTP::count(),
            'used' => OTP::where('is_used', true)->count(),
            'unused' => OTP::where('is_used', false)->count(),
            'expired' => OTP::where('expires_at', '<', Carbon::now())
                ->where('is_used', false)
                ->count(),
            'by_type' => OTP::select('type', DB::raw('count(*) as count'))
                ->groupBy('type')
                ->get(),
        ];
    }

    /**
     * Verify OTP token
     */
    public function verify(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'otp' => 'required|string|size:6',
            ]);

            $otp = OTP::where('email', $request->email)
                ->where('otp', $request->otp)
                ->valid()
                ->first();

            if (!$otp) {
                // Record invalid attempt
                $existingOtp = OTP::where('email', $request->email)
                    ->where('otp', $request->otp)
                    ->first();

                if ($existingOtp) {
                    $existingOtp->incrementAttempts();
                }

                return $this->errorResponse('Invalid or expired OTP', 422);
            }

            // Check max attempts
            if ($otp->isMaxAttemptsReached()) {
                return $this->errorResponse('Maximum attempts reached. Please request a new OTP.', 422);
            }

            // Mark as used
            $otp->markAsUsed();

            return $this->successResponse([
                'verified' => true,
                'email' => $otp->email,
                'type' => $otp->type,
            ], 'OTP verified successfully');

        } catch (\Exception $e) {
            return $this->serverError('Failed to verify OTP');
        }
    }

    /**
     * Get OTP status for a specific email
     */
    public function status(Request $request)
    {
        try {
            $request->validate(['email' => 'required|email']);

            $otp = OTP::where('email', $request->email)
                ->where('is_used', false)
                ->latest()
                ->first();

            if (!$otp) {
                return $this->successResponse([
                    'has_valid_otp' => false,
                    'message' => 'No valid OTP found',
                ], 'OTP status retrieved');
            }

            return $this->successResponse([
                'has_valid_otp' => $otp->isValid(),
                'remaining_seconds' => $otp->getRemainingSeconds(),
                'formatted_time' => $otp->getFormattedRemainingTime(),
                'attempts' => $otp->attempts,
                'max_attempts_reached' => $otp->isMaxAttemptsReached(),
                'type' => $otp->type,
            ], 'OTP status retrieved');

        } catch (\Exception $e) {
            return $this->serverError('Failed to get OTP status');
        }
    }
}