<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\User;
use App\Models\Shop;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Sale;
use App\Models\Role;
use App\Models\OTP;
use App\Models\Permission;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends BaseApiController
{
    public function index(Request $request)
    {
        $user = $request->user();
        $isAdminOrManager = $user->hasRole('ADMINISTRATOR') || $user->hasRole('MANAGER');

        $shopIds = [];
        if (!$isAdminOrManager) {
            $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
            if (empty($shopIds)) {
                return $this->successResponse([
                    'summary' => [],
                    'charts' => [],
                    'trends' => [],
                ], 'No shops assigned to your account.');
            }
        }

        // ============================================================
        // 1. SUMMARY (cards)
        // ============================================================
        $summary = [];

        if ($isAdminOrManager) {
            $summary['total_users'] = User::count();
            $summary['total_shops'] = Shop::count();
            $summary['total_roles'] = Role::count();
            $summary['total_permissions'] = Permission::count();
            $summary['total_companies'] = Company::count();
        } else {
            $summary['total_shops'] = count($shopIds);
        }

        // Total products (all non‑deleted)
        $totalProductsQuery = Product::whereNull('deleted_at');
        if (!$isAdminOrManager) $totalProductsQuery->whereIn('shop_id', $shopIds);
        $summary['total_products'] = $totalProductsQuery->count();

        // Products in stock
        $inStockQuery = Product::where('status', 'active')->where('stock_status', 'in_stock');
        if (!$isAdminOrManager) $inStockQuery->whereIn('shop_id', $shopIds);
        $summary['products_in_stock'] = $inStockQuery->count();

        $summary['total_product_categories'] = ProductCategory::where('status', 'active')->count();

        // Sales count (transactions)
        $saleQuery = Sale::where('status', 'completed');
        if (!$isAdminOrManager) {
            $saleQuery->whereHas('product', fn($q) => $q->whereIn('shop_id', $shopIds));
        }
        $summary['total_sales'] = $saleQuery->count();

        // Returned devices
        $returnedQuery = Product::where('status', 'returned');
        if (!$isAdminOrManager) $returnedQuery->whereIn('shop_id', $shopIds);
        $summary['total_returned'] = $returnedQuery->count();

        // ============================================================
        // 2. CHARTS
        // ============================================================

        // ----- 2a. Products by Category (with status breakdown) -----
        $productsByCategoryQuery = Product::join('product_categories', 'products.category_id', '=', 'product_categories.category_id')
            ->whereNull('products.deleted_at')
            ->select(
                'product_categories.category_id',
                'product_categories.category_name',
                DB::raw("SUM(CASE WHEN products.stock_status = 'in_stock' AND products.status = 'active' THEN 1 ELSE 0 END) as in_stock"),
                DB::raw("SUM(CASE WHEN products.stock_status = 'sold' THEN 1 ELSE 0 END) as sold"),
                DB::raw("SUM(CASE WHEN products.stock_status = 'returned' THEN 1 ELSE 0 END) as returned")
            )
            ->groupBy('product_categories.category_id', 'product_categories.category_name');

        if (!$isAdminOrManager) {
            $productsByCategoryQuery->whereIn('products.shop_id', $shopIds);
        }

        $productsByCategory = $productsByCategoryQuery->get()
            ->map(fn($item) => [
                'category' => $item->category_name,
                'in_stock' => (int) $item->in_stock,
                'sold' => (int) $item->sold,
                'returned' => (int) $item->returned,
            ]);

        // ----- 2b. Products by Status (overall) -----
        $productsByStatus = Product::select('status', DB::raw('count(*) as count'))
            ->whereNotNull('status');
        if (!$isAdminOrManager) $productsByStatus->whereIn('shop_id', $shopIds);
        $productsByStatus = $productsByStatus->groupBy('status')->get()
            ->mapWithKeys(fn($item) => [$item->status => $item->count]);

        // ----- 2c. Sales by Payment Method -----
        $salesByPayment = Sale::select('payment_method', DB::raw('count(*) as count'), DB::raw('sum(total_amount) as total_amount'))
            ->where('status', 'completed');
        if (!$isAdminOrManager) {
            $salesByPayment->whereHas('product', fn($q) => $q->whereIn('shop_id', $shopIds));
        }
        $salesByPayment = $salesByPayment->groupBy('payment_method')->get()
            ->map(fn($item) => [
                'method' => $item->payment_method,
                'count' => $item->count,
                'total_amount' => (float) $item->total_amount,
            ]);

        // ----- 2d. Top 10 Selling Products -----
        $topProducts = Sale::select('product_id', DB::raw('count(*) as sales_count'))
            ->where('status', 'completed');
        if (!$isAdminOrManager) {
            $topProducts->whereHas('product', fn($q) => $q->whereIn('shop_id', $shopIds));
        }
        $topProducts = $topProducts->groupBy('product_id')
            ->orderBy('sales_count', 'desc')
            ->limit(10)
            ->with(['product' => fn($q) => $q->with(['category', 'shop'])])
            ->get()
            ->map(fn($item) => [
                'product_id' => $item->product_id,
                'imei' => $item->product->imei ?? null,
                'sku' => $item->product->sku ?? null,
                'category_name' => $item->product->category->category_name ?? null,
                'model' => $item->product->category->model ?? null,
                'shop_name' => $item->product->shop->name ?? null,
                'shop_location' => $item->product->shop->location ?? null,
                'sales_count' => $item->sales_count,
            ]);

        // ============================================================
        // 3. TRENDS
        // ============================================================
        $startDate = Carbon::now()->subDays(30);
        $salesTrend = Sale::select(DB::raw('DATE(created_at) as date'), DB::raw('sum(total_amount) as total'))
            ->where('status', 'completed')
            ->where('created_at', '>=', $startDate);
        if (!$isAdminOrManager) {
            $salesTrend->whereHas('product', fn($q) => $q->whereIn('shop_id', $shopIds));
        }
        $salesTrend = $salesTrend->groupBy('date')
            ->orderBy('date', 'asc')
            ->get()
            ->map(fn($item) => [
                'date' => $item->date,
                'amount' => (float) $item->total,
            ]);

        $salesByMonth = Sale::select(DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"), DB::raw('sum(total_amount) as total_amount'))
            ->where('status', 'completed')
            ->where('created_at', '>=', Carbon::now()->subMonths(12));
        if (!$isAdminOrManager) {
            $salesByMonth->whereHas('product', fn($q) => $q->whereIn('shop_id', $shopIds));
        }
        $salesByMonth = $salesByMonth->groupBy('month')
            ->orderBy('month', 'asc')
            ->get()
            ->map(fn($item) => [
                'month' => $item->month,
                'total_amount' => (float) $item->total_amount,
            ]);

        // ============================================================
        // 4. RESPONSE
        // ============================================================
        $data = [
            'summary' => $summary,
            'charts' => [
                'products_by_category' => $productsByCategory,  // now contains in_stock, sold, returned
                'products_by_status' => $productsByStatus,
                'sales_by_payment_method' => $salesByPayment,
                'top_selling_products' => $topProducts,
            ],
            'trends' => [
                'sales_trend' => $salesTrend,
                'sales_by_month' => $salesByMonth,
            ],
        ];

        return $this->successResponse($data, 'Dashboard data retrieved');
    }
}