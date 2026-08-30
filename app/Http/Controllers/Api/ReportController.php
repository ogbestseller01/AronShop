<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Sale;
use App\Models\Product;
use App\Models\Shop;
use App\Models\OTP;
use App\Models\ProductCategory;
use App\Traits\Auditable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportController extends BaseApiController
{
    use Auditable;

    /**
     * Sales report with filters (date range, shop, agent, status)
     * Permission: reports.sales.view
     */
    public function sales(Request $request)
    {
        $perm = $this->checkPermission('reports.sales.view');
        if ($perm) return $perm;

        try {
            $query = Sale::with(['agent', 'product.category', 'product.shop', 'company'])
                ->where('sales.status', 'completed');

            if ($request->filled('from_date')) {
                $query->whereDate('sales.created_at', '>=', $request->from_date);
            }
            if ($request->filled('to_date')) {
                $query->whereDate('sales.created_at', '<=', $request->to_date);
            }
            if ($request->filled('shop_id')) {
                $query->whereHas('product', fn($q) => $q->where('shop_id', $request->shop_id));
            }
            if ($request->filled('agent_id')) {
                $query->where('sales.agent_id', $request->agent_id);
            }
            if ($request->filled('status')) {
                $query->where('sales.status', $request->status);
            }

            $profitQuery = clone $query;
            $totalProfit = (float) $profitQuery->join('products', 'sales.product_id', '=', 'products.product_id')
                ->sum(DB::raw('sales.total_amount - products.buying_price'));

            $sales = $query->orderBy('sales.created_at', 'desc')
                ->paginate($request->get('per_page', 15));

            $summary = [
                'total_sales'   => $query->count(),
                'total_revenue' => (float) $query->sum('sales.total_amount'),
                'total_profit'  => $totalProfit,
                'by_payment_method' => Sale::select('payment_method', DB::raw('count(*) as count'))
                    ->whereIn('sale_id', $query->pluck('sale_id'))
                    ->groupBy('payment_method')
                    ->pluck('count', 'payment_method')
                    ->toArray(),
            ];

            $this->logAudit('view_sales_report', 'report', null, 'Viewed sales report');
            return $this->successResponse([
                'data' => $sales,
                'summary' => $summary,
            ], 'Sales report retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to generate sales report: ' . $e->getMessage());
        }
    }

    /**
     * Stock report – current stock levels
     * Permission: reports.stock.view
     */
    public function stock(Request $request)
    {
        $perm = $this->checkPermission('reports.stock.view');
        if ($perm) return $perm;

        try {
            $query = Product::with(['category', 'shop'])->whereNull('deleted_at');

            if ($request->filled('shop_id')) {
                $query->where('shop_id', $request->shop_id);
            }
            if ($request->filled('category_id')) {
                $query->where('category_id', $request->category_id);
            }
            if ($request->filled('stock_status')) {
                $query->where('stock_status', $request->stock_status);
            }
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('sku', 'LIKE', "%{$search}%")
                      ->orWhere('imei', 'LIKE', "%{$search}%");
                });
            }

            $products = $query->orderBy('created_at', 'desc')
                ->paginate($request->get('per_page', 15));

            $summary = [
                'total_products' => Product::whereNull('deleted_at')->count(),
                'in_stock' => Product::where('stock_status', 'in_stock')->whereNull('deleted_at')->count(),
                'sold' => Product::where('stock_status', 'sold')->whereNull('deleted_at')->count(),
                'returned' => Product::where('stock_status', 'returned')->whereNull('deleted_at')->count(),
                'by_category' => ProductCategory::select('category_name', DB::raw('count(products.product_id) as count'))
                    ->leftJoin('products', 'product_categories.category_id', '=', 'products.category_id')
                    ->whereNull('products.deleted_at')
                    ->groupBy('category_name')
                    ->pluck('count', 'category_name')
                    ->toArray(),
            ];

            $this->logAudit('view_stock_report', 'report', null, 'Viewed stock report');
            return $this->successResponse([
                'data' => $products,
                'summary' => $summary,
            ], 'Stock report retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to generate stock report: ' . $e->getMessage());
        }
    }

    /**
     * Returns report – removed entirely per requirement
     */
    // public function returns(Request $request) { ... } // removed

    /**
     * Get agents who have made sales
     * Permission: reports.sales.view
     */
    public function agentsWithSales(Request $request)
    {
        $perm = $this->checkPermission('reports.sales.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $isAdminOrManager = $user->hasRole('ADMINISTRATOR') || $user->hasRole('MANAGER');

            $query = Sale::where('sales.status', 'completed')
                ->join('users', 'sales.agent_id', '=', 'users.id')
                ->select('users.id', 'users.name')
                ->distinct();

            if (!$isAdminOrManager) {
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
                if (!empty($shopIds)) {
                    $query->whereHas('product', fn($q) => $q->whereIn('shop_id', $shopIds));
                } else {
                    return $this->successResponse([], 'No agents with sales in your shops');
                }
            }

            $agents = $query->orderBy('users.name')->get();

            return $this->successResponse($agents, 'Agents with sales retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch agents: ' . $e->getMessage());
        }
    }

    /**
     * Get shops that have sales
     * Permission: reports.sales.view
     */
    public function shopsWithSales(Request $request)
    {
        $perm = $this->checkPermission('reports.sales.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $isAdminOrManager = $user->hasRole('ADMINISTRATOR') || $user->hasRole('MANAGER');

            $query = Sale::where('sales.status', 'completed')
                ->join('products', 'sales.product_id', '=', 'products.product_id')
                ->join('shops', 'products.shop_id', '=', 'shops.shop_id')
                ->select('shops.shop_id', 'shops.name', 'shops.location')
                ->distinct();

            if (!$isAdminOrManager) {
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
                if (!empty($shopIds)) {
                    $query->whereIn('products.shop_id', $shopIds);
                } else {
                    return $this->successResponse([], 'No shops with sales in your assigned shops');
                }
            }

            $shops = $query->orderBy('shops.name')->get();

            return $this->successResponse($shops, 'Shops with sales retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch shops: ' . $e->getMessage());
        }
    }

    /**
     * Export sales report as CSV
     * Permission: reports.sales.view
     */
    public function exportSales(Request $request)
    {
        $perm = $this->checkPermission('reports.sales.view');
        if ($perm) return $perm;

        return $this->successResponse([], 'Export not yet implemented');
    }

    /**
     * Analysis overview – comprehensive metrics
     * Permission: reports.sales.view
     */
    public function analysisOverview(Request $request)
    {
        $perm = $this->checkPermission('reports.sales.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $isAdminOrManager = $user->hasRole('ADMINISTRATOR') || $user->hasRole('MANAGER');

            $shopIds = [];
            if (!$isAdminOrManager) {
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
            }
            $shopFilter = fn($q) => $isAdminOrManager ? $q : $q->whereIn('shop_id', $shopIds);

            // Sales Overview
            $salesQuery = Sale::where('sales.status', 'completed');
            if (!$isAdminOrManager) $salesQuery->whereHas('product', $shopFilter);
            $totalSales = $salesQuery->count();
            $totalRevenue = (float) $salesQuery->sum('sales.total_amount');

            // Total Profit
            $profitQuery = Sale::where('sales.status', 'completed')
                ->join('products', 'sales.product_id', '=', 'products.product_id');
            if (!$isAdminOrManager) $profitQuery->whereIn('products.shop_id', $shopIds);
            $totalProfit = (float) $profitQuery->sum(DB::raw('sales.total_amount - products.buying_price'));

            // Total Stock Cost – ALL products (not just in_stock)
            $stockQuery = Product::whereNull('deleted_at');
            if (!$isAdminOrManager) $stockQuery->whereIn('shop_id', $shopIds);
            $totalStockCost = (float) $stockQuery->sum('buying_price');

            // Payment method breakdown
            $paymentMethodData = Sale::where('sales.status', 'completed')
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->select('payment_method', DB::raw('count(*) as count'), DB::raw('sum(total_amount) as total'))
                ->groupBy('payment_method')
                ->get()
                ->map(fn($item) => [
                    'method' => $item->payment_method,
                    'count' => $item->count,
                    'total' => (float) $item->total,
                ]);

            // Sales by category
            $categorySales = Sale::where('sales.status', 'completed')
                ->join('products', 'sales.product_id', '=', 'products.product_id')
                ->join('product_categories', 'products.category_id', '=', 'product_categories.category_id')
                ->when(!$isAdminOrManager, fn($q) => $q->whereIn('products.shop_id', $shopIds))
                ->select('product_categories.category_name', DB::raw('count(*) as sales'), DB::raw('sum(sales.total_amount) as revenue'))
                ->groupBy('product_categories.category_name')
                ->get()
                ->map(fn($item) => [
                    'category' => $item->category_name,
                    'sales' => $item->sales,
                    'revenue' => (float) $item->revenue,
                ]);

            // Daily trend (30 days)
            $dailyTrend = Sale::where('sales.status', 'completed')
                ->where('sales.created_at', '>=', Carbon::now()->subDays(30))
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->select(DB::raw('DATE(sales.created_at) as date'), DB::raw('sum(sales.total_amount) as total'))
                ->groupBy('date')
                ->orderBy('date', 'asc')
                ->get()
                ->map(fn($item) => ['date' => $item->date, 'total' => (float) $item->total]);

            // Weekly trend (8 weeks)
            $weeklyTrend = Sale::where('sales.status', 'completed')
                ->where('sales.created_at', '>=', Carbon::now()->subWeeks(8))
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->select(DB::raw('YEARWEEK(sales.created_at) as week'), DB::raw('sum(sales.total_amount) as total'))
                ->groupBy('week')
                ->orderBy('week', 'asc')
                ->get()
                ->map(fn($item) => ['week' => $item->week, 'total' => (float) $item->total]);

            // Monthly trend (12 months)
            $monthlyTrend = Sale::where('sales.status', 'completed')
                ->where('sales.created_at', '>=', Carbon::now()->subMonths(12))
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->select(DB::raw("DATE_FORMAT(sales.created_at, '%Y-%m') as month"), DB::raw('sum(sales.total_amount) as total'))
                ->groupBy('month')
                ->orderBy('month', 'asc')
                ->get()
                ->map(fn($item) => ['month' => $item->month, 'total' => (float) $item->total]);

            // Agent performance (top 10)
            $agentPerformance = Sale::where('sales.status', 'completed')
                ->with('agent')
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->get()
                ->groupBy('agent_id')
                ->map(fn($sales) => [
                    'agent_name' => $sales->first()->agent?->name ?? 'Unknown',
                    'total_sales' => $sales->count(),
                    'total_revenue' => (float) $sales->sum('total_amount'),
                ])
                ->sortByDesc('total_revenue')
                ->values()
                ->take(10);

            // Shop performance (top 10)
            $shopPerformance = Sale::where('sales.status', 'completed')
                ->with('product.shop')
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->get()
                ->groupBy('product.shop_id')
                ->map(fn($sales) => [
                    'shop_name' => $sales->first()->product?->shop?->name ?? 'Unknown',
                    'shop_location' => $sales->first()->product?->shop?->location ?? '',
                    'total_sales' => $sales->count(),
                    'total_revenue' => (float) $sales->sum('total_amount'),
                ])
                ->sortByDesc('total_revenue')
                ->values()
                ->take(10);

            // Product performance – aggregated by sku, model, category
            $productPerformance = Sale::where('sales.status', 'completed')
                ->join('products', 'sales.product_id', '=', 'products.product_id')
                ->join('product_categories', 'products.category_id', '=', 'product_categories.category_id')
                ->when(!$isAdminOrManager, fn($q) => $q->whereIn('products.shop_id', $shopIds))
                ->select(
                    'products.sku',
                    'product_categories.model',
                    'product_categories.category_name as category',
                    DB::raw('count(*) as total_sales'),
                    DB::raw('sum(sales.total_amount) as total_revenue')
                )
                ->groupBy('products.sku', 'product_categories.model', 'product_categories.category_name')
                ->orderBy('total_revenue', 'desc')
                ->limit(10)
                ->get()
                ->map(fn($item) => [
                    'sku' => $item->sku,
                    'model' => $item->model,
                    'category' => $item->category,
                    'total_sales' => $item->total_sales,
                    'total_revenue' => (float) $item->total_revenue,
                ]);

            // Model sales (top 10)
            $modelSales = Sale::where('sales.status', 'completed')
                ->join('products', 'sales.product_id', '=', 'products.product_id')
                ->join('product_categories', 'products.category_id', '=', 'product_categories.category_id')
                ->when(!$isAdminOrManager, fn($q) => $q->whereIn('products.shop_id', $shopIds))
                ->select('product_categories.model', DB::raw('count(*) as sales'), DB::raw('sum(sales.total_amount) as revenue'))
                ->groupBy('product_categories.model')
                ->orderBy('revenue', 'desc')
                ->limit(10)
                ->get()
                ->map(fn($item) => ['model' => $item->model, 'sales' => $item->sales, 'revenue' => (float) $item->revenue]);

            // Interest metrics (loan)
            $interestQuery = Sale::join('products', 'sales.product_id', '=', 'products.product_id')
                ->where('sales.status', 'completed')
                ->where('sales.payment_method', 'loan');
            if (!$isAdminOrManager) {
                $interestQuery->whereIn('products.shop_id', $shopIds);
            }
            $interestEarned = (float) $interestQuery->sum(DB::raw('sales.total_amount - products.buying_price'));

            $loanSalesQuery = Sale::where('sales.status', 'completed')->where('sales.payment_method', 'loan');
            if (!$isAdminOrManager) {
                $loanSalesQuery->whereHas('product', $shopFilter);
            }
            $totalLoanSales = $loanSalesQuery->count();
            $totalLoanRevenue = (float) $loanSalesQuery->sum('sales.total_amount');

            // Cash metrics
            $cashSalesQuery = Sale::where('sales.status', 'completed')->where('sales.payment_method', 'cash');
            if (!$isAdminOrManager) {
                $cashSalesQuery->whereHas('product', $shopFilter);
            }
            $totalCashSales = $cashSalesQuery->count();
            $totalCashRevenue = (float) $cashSalesQuery->sum('sales.total_amount');

            // ---- PROFIT TRENDS (replaces interest_trends) ----
            $profitTrends = Sale::join('products', 'sales.product_id', '=', 'products.product_id')
                ->where('sales.status', 'completed')
                ->when(!$isAdminOrManager, fn($q) => $q->whereIn('products.shop_id', $shopIds))
                ->select(DB::raw("DATE_FORMAT(sales.created_at, '%Y-%m') as month"), DB::raw('sum(sales.total_amount - products.buying_price) as profit'))
                ->groupBy('month')
                ->orderBy('month', 'asc')
                ->get()
                ->map(fn($item) => ['month' => $item->month, 'profit' => (float) $item->profit]);

            // Stock summary (removed damaged)
            $stockSummary = [
                'total_products' => Product::whereNull('deleted_at')->count(),
                'in_stock' => Product::where('stock_status', 'in_stock')->whereNull('deleted_at')->count(),
                'sold' => Product::where('stock_status', 'sold')->whereNull('deleted_at')->count(),
                'returned' => Product::where('stock_status', 'returned')->whereNull('deleted_at')->count(),
                'total_stock_cost' => $totalStockCost, // now ALL products
            ];

            // Agent ranking by sales
            $agentRankingBySales = Sale::where('sales.status', 'completed')
                ->with('agent')
                ->when(!$isAdminOrManager, fn($q) => $q->whereHas('product', $shopFilter))
                ->get()
                ->groupBy('agent_id')
                ->map(fn($sales) => [
                    'agent_name' => $sales->first()->agent?->name ?? 'Unknown',
                    'total_sales' => $sales->count(),
                ])
                ->sortByDesc('total_sales')
                ->values()
                ->take(10);

            return $this->successResponse([
                'sales_overview' => [
                    'total_sales' => $totalSales,
                    'total_revenue' => $totalRevenue,
                    'total_profit' => $totalProfit,
                ],
                'payment_method_breakdown' => $paymentMethodData,
                'category_sales' => $categorySales,
                'daily_trend' => $dailyTrend,
                'weekly_trend' => $weeklyTrend,
                'monthly_trend' => $monthlyTrend,
                'agent_performance' => $agentPerformance,
                'shop_performance' => $shopPerformance,
                'product_performance' => $productPerformance,
                'model_sales' => $modelSales,
                'interest_summary' => [
                    'total_loan_sales' => $totalLoanSales,
                    'total_loan_revenue' => $totalLoanRevenue,
                    'interest_earned' => $interestEarned,
                    'total_cash_sales' => $totalCashSales,
                    'total_cash_revenue' => $totalCashRevenue,
                ],
                'profit_trends' => $profitTrends,       // new
                'stock_summary' => $stockSummary,
                'agent_ranking_by_sales' => $agentRankingBySales,
            ], 'Comprehensive analysis data');
        } catch (\Exception $e) {
            return $this->serverError('Failed to generate analysis: ' . $e->getMessage());
        }
    }
}