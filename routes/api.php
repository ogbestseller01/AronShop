<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\VerificationController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserSessionController;
use App\Http\Controllers\Api\RolePermissionController;
use App\Http\Controllers\Api\AuditTrailController;
use App\Http\Controllers\Api\OTPController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\FailedLoginAttemptController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ReportController; // ✅ ADD THIS

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/
Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

/*
|--------------------------------------------------------------------------
| v1 – Authentication, Users, Roles, Audit, OTP, Sales (FULL REST)
|--------------------------------------------------------------------------
*/
Route::prefix('v1')->group(function () {

    // ====================== PUBLIC ROUTES ======================
    Route::prefix('auth')->middleware('throttle:auth')->group(function () {
        Route::post('register',             [AuthController::class, 'register']);
        Route::post('login',                [AuthController::class, 'login']);
        Route::post('verify-otp',           [AuthController::class, 'verifyOTP']);
        Route::post('resend-verification',  [AuthController::class, 'resendVerification']);
        Route::post('forgot-password',      [AuthController::class, 'forgotPassword']);
        Route::post('reset-password',       [AuthController::class, 'resetPassword']);
    });

    Route::prefix('verification')->middleware('throttle:auth')->group(function () {
        Route::post('send-otp',     [VerificationController::class, 'sendOTP']);
        Route::post('verify',       [VerificationController::class, 'verifyWithOTP']);
        Route::post('verify-token', [VerificationController::class, 'verifyByToken']);
        Route::post('resend-otp',   [VerificationController::class, 'resendOTP']);
        Route::get('status',        [VerificationController::class, 'checkStatus']);
    });

    // ====================== PROTECTED ROUTES ======================
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {

        // Auth (me, logout, profile, failed logins)
        Route::prefix('auth')->group(function () {
            Route::post('logout',          [AuthController::class, 'logout']);
            Route::get('me',               [AuthController::class, 'me']);
            Route::put('profile',          [AuthController::class, 'updateProfile']);
            Route::post('change-password', [AuthController::class, 'changePassword']);
            Route::get('permissions',      [AuthController::class, 'permissions']);

            Route::get('/',                [FailedLoginAttemptController::class, 'index']);
            Route::delete('/clear',        [FailedLoginAttemptController::class, 'clear']);
            Route::post('/block',          [FailedLoginAttemptController::class, 'block']);
            Route::post('/unblock',        [FailedLoginAttemptController::class, 'unblock']);
        });

        // Sessions
        Route::prefix('sessions')->group(function () {
            Route::get('/',          [UserSessionController::class, 'index']);
            Route::delete('/all',    [UserSessionController::class, 'destroyAll']);
            Route::delete('/others', [UserSessionController::class, 'destroyOthers']);
            Route::delete('/{id}',   [UserSessionController::class, 'destroy']);
        });

        // Users Management
        Route::prefix('users')->group(function () {
            Route::get('/trashed',              [UserController::class, 'trashed']);
            Route::patch('/{id}/restore',       [UserController::class, 'restore']);
            Route::delete('/{id}/force',        [UserController::class, 'forceDelete']);
            Route::get('/dropdown',             [UserController::class, 'Userdropdown']);
            Route::get('/sales-agents/dropdown', [UserController::class, 'salesAgentDropdown']);
            Route::get('/branch-owners',        [UserController::class, 'getBranchOwners']);
            Route::get('/branch-owners/dropdown', [UserController::class, 'getBranchOwnersDropdown']);
            Route::post('/{id}/verify',              [UserController::class, 'verifyUser']);
            Route::get('/{id}/verification-status',  [UserController::class, 'getVerificationStatus']);
            Route::post('/{id}/resend-verification', [UserController::class, 'resendUserVerification']);
            Route::post('/{id}/resend-otp',          [UserController::class, 'resendOtp']);
            Route::get('/',                     [UserController::class, 'index']);
            Route::post('/',                    [UserController::class, 'store']);
            Route::get('/stats',                [UserController::class, 'stats']);
            Route::get('/{id}',                 [UserController::class, 'show']);
            Route::put('/{id}',                 [UserController::class, 'update']);
            Route::delete('/{id}',              [UserController::class, 'destroy']);
            Route::patch('/{id}/activate',      [UserController::class, 'activate']);
            Route::patch('/{id}/deactivate',    [UserController::class, 'deactivate']);
            Route::patch('/{id}/suspend',       [UserController::class, 'suspend']);
            Route::patch('/{id}/role',          [UserController::class, 'assignRole']);
            Route::post('/{id}/reset-password', [UserController::class, 'resetUserPassword']);
        });

        // Roles & Permissions
        Route::prefix('roles')->group(function () {
            Route::get('/',                         [RolePermissionController::class, 'index']);
            Route::post('/',                        [RolePermissionController::class, 'store']);
            Route::get('/dropdown',                 [RolePermissionController::class, 'getRolesDropdown']);
            Route::get('/stats',                    [RolePermissionController::class, 'getStats']);
            Route::get('/{id}',                     [RolePermissionController::class, 'show']);
            Route::put('/{id}',                     [RolePermissionController::class, 'update']);
            Route::delete('/{id}',                  [RolePermissionController::class, 'destroy']);
            Route::get('/{id}/permissions',         [RolePermissionController::class, 'getRolePermissions']);
            Route::post('/{id}/permissions/assign', [RolePermissionController::class, 'assignPermissionsToRole']);
            Route::post('/{id}/permissions/sync',   [RolePermissionController::class, 'syncRolePermissions']);
            Route::post('/{id}/permissions/revoke', [RolePermissionController::class, 'revokePermissionFromRole']);
        });

        // Permissions
        Route::prefix('permissions')->group(function () {
            Route::get('/',        [RolePermissionController::class, 'getPermissions']);
            Route::post('/',       [RolePermissionController::class, 'createPermission']);
            Route::get('/{id}',    [RolePermissionController::class, 'getPermission']);
            Route::put('/{id}',    [RolePermissionController::class, 'updatePermission']);
            Route::delete('/{id}', [RolePermissionController::class, 'deletePermission']);
        });

        // Audit Trails
        Route::prefix('audit-trails')->group(function () {
            Route::get('/',             [AuditTrailController::class, 'index']);
            Route::get('/stats',        [AuditTrailController::class, 'stats']);
            Route::get('/modules',      [AuditTrailController::class, 'getModules']);
            Route::get('/actions',      [AuditTrailController::class, 'getActions']);
            Route::get('/export/csv',   [AuditTrailController::class, 'exportCsv']);
            Route::get('/export/excel', [AuditTrailController::class, 'exportExcel']);
            Route::get('/export/pdf',   [AuditTrailController::class, 'exportPdf']);
        });

        // OTP Management
        Route::prefix('otps')->group(function () {
            Route::get('/',                [OTPController::class, 'index']);
            Route::get('/stats',           [OTPController::class, 'stats']);
            Route::delete('/cleanup',      [OTPController::class, 'cleanup']);
            Route::delete('/cleanup-used', [OTPController::class, 'cleanupUsed']);
        });

        // ✅ SALES – FULL REST API (GET, POST, PUT, DELETE)
        Route::prefix('sales')->group(function () {
            Route::get('/',          [SaleController::class, 'index']);
            Route::get('/stats',     [SaleController::class, 'stats']);
            Route::post('/',         [SaleController::class, 'store']);
            Route::get('/{id}',      [SaleController::class, 'show']);
            Route::put('/{id}',      [SaleController::class, 'update']);
            Route::delete('/{id}',   [SaleController::class, 'destroy']);
        });

    }); // End Protected Routes (v1)

}); // End v1

/*
|--------------------------------------------------------------------------
| Protected Versioned Routes (v2, v3, v5, v18, v19, v20)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {

    // v2 – Product Categories
    Route::prefix('v2')->group(function () {
        Route::prefix('product-categories')->group(function () {
            Route::get('/dropdown', [ProductCategoryController::class, 'productCategoryDropdown']);
            Route::get('/',          [ProductCategoryController::class, 'index']);
            Route::post('/',         [ProductCategoryController::class, 'store']);
            Route::get('/{id}',      [ProductCategoryController::class, 'show']);
            Route::put('/{id}',      [ProductCategoryController::class, 'update']);
            Route::delete('/{id}',   [ProductCategoryController::class, 'destroy']);
            Route::patch('/{id}/activate',   [ProductCategoryController::class, 'activate']);
            Route::patch('/{id}/deactivate', [ProductCategoryController::class, 'deactivate']);
            Route::patch('/{id}/toggle-status', [ProductCategoryController::class, 'toggleStatus']);
        });
    });

    // v3 – Products
    Route::prefix('v3')->group(function () {
        Route::prefix('products')->group(function () {
            Route::get('/dropdown',               [ProductController::class, 'Productdropdown']);   
            Route::get('/purchase-info',          [ProductController::class, 'getPurchaseInfo']);
            Route::get('/scan/imei/{imei}',       [ProductController::class, 'scanByImei']);
            Route::post('/scan/imei',             [ProductController::class, 'scanImeiPost']);
            Route::patch('/{id}/assign-imei',     [ProductController::class, 'assignImei']);
            Route::get('/',                       [ProductController::class, 'index']);
            Route::post('/',                      [ProductController::class, 'store']);
            Route::get('/{id}',                   [ProductController::class, 'show']);
            Route::put('/{id}',                   [ProductController::class, 'update']);
            Route::delete('/{id}',                [ProductController::class, 'destroy']);
            Route::patch('/{id}/restore',         [ProductController::class, 'restore']);
            Route::delete('/{id}/force',          [ProductController::class, 'forceDelete']);
            Route::patch('/{id}/status',          [ProductController::class, 'changeStatus']);
        });
    });

    // v5 – Shops
    Route::prefix('v5')->group(function () {
        Route::prefix('shops')->group(function () {
            Route::get('/dropdown',             [ShopController::class, 'Shopsdropdown']);  
            Route::get('/',                     [ShopController::class, 'index']);
            Route::post('/',                    [ShopController::class, 'store']);
            Route::get('/{id}',                 [ShopController::class, 'show']);
            Route::put('/{id}',                 [ShopController::class, 'update']);
            Route::delete('/{id}',              [ShopController::class, 'destroy']);
            Route::patch('/{id}/restore',       [ShopController::class, 'restore']);
            Route::delete('/{id}/force',        [ShopController::class, 'forceDelete']);
            Route::patch('/{id}/status',        [ShopController::class, 'changeStatus']);
        });
    });

    // v18 – Companies
    Route::prefix('v18')->group(function () {
        Route::prefix('companies')->group(function () {
            Route::get('/trashed', [CompanyController::class, 'trashed']);
            Route::patch('/{id}/restore', [CompanyController::class, 'restore']);
            Route::delete('/{id}/force', [CompanyController::class, 'forceDelete']);
            Route::get('/dropdown', [CompanyController::class, 'companyDropdown']);
            Route::get('/stats', [CompanyController::class, 'stats']);
            Route::patch('/{id}/toggle-status', [CompanyController::class, 'toggleStatus']);
            Route::get('/', [CompanyController::class, 'index']);
            Route::post('/', [CompanyController::class, 'store']);
            Route::get('/{id}', [CompanyController::class, 'show']);
            Route::put('/{id}', [CompanyController::class, 'update']);
            Route::delete('/{id}', [CompanyController::class, 'destroy']);
        });
    });

    // ✅ v19 – Reports
  Route::prefix('v19')->group(function () {
    Route::prefix('reports')->group(function () {
        Route::get('/sales', [ReportController::class, 'sales']);
        Route::get('/stock', [ReportController::class, 'stock']);
        Route::get('/returns', [ReportController::class, 'returns']);
        Route::get('/sales/export', [ReportController::class, 'exportSales']);
        Route::get('/analysis', [ReportController::class, 'analysisOverview']); 
        Route::get('/agents', [ReportController::class, 'agentsWithSales']);
        Route::get('/shops', [ReportController::class, 'shopsWithSales']);
    });
});

    // ✅ v20 – Dashboard
    Route::prefix('v20')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
    });

});