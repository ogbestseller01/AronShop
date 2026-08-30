<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Shop;
use App\Traits\Auditable;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends BaseApiController
{
    use Auditable;

    /**
     * Check if the user is allowed to manage products.
     * Only Administrator, Manager, Stock Controller, and Branch Owner have access.
     */
    protected function isAllowedToManageProducts(): bool
    {
        return $this->hasAnyRole(['ADMINISTRATOR', 'MANAGER', 'STOCK_CONTROLLER', 'BRANCH_OWNER']);
    }

    /**
     * List products with filters
     * Permission: products.view
     * ✅ Role‑based filtering – non‑admin/manager see products from ALL their shops.
     */
    public function index(Request $request)
    {
        $perm = $this->checkPermission('products.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $query = Product::with('category', 'shop');

            // For ADMIN and MANAGER: show all products (no shop filter)
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                // Get ALL shops managed by this user (Branch Owner or Stock Controller)
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();

                if (!empty($shopIds)) {
                    $query->whereIn('shop_id', $shopIds);
                } else {
                    // No shop assigned – return empty with a clear message
                    return $this->successResponse(
                        ['data' => [], 'current_page' => 1, 'total' => 0],
                        'No shop assigned to your account – contact your administrator.'
                    );
                }
            }

            // Additional filters
            if ($request->filled('category_id')) {
                $query->where('category_id', $request->category_id);
            }
            if ($request->filled('shop_id')) {
                $query->where('shop_id', $request->shop_id);
            }
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('imei', 'LIKE', "%{$search}%")
                      ->orWhere('sku', 'LIKE', "%{$search}%");
                });
            }
            $products = $query->orderBy('created_at', 'desc')
                             ->paginate($request->get('per_page', 15));

            $this->logAudit('view_products', 'product', null, 'Viewed products list');
            return $this->successResponse($products, 'Products retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch products');
        }
    }

    /**
     * Show single product
     * Permission: products.view
     */
    public function show($id)
    {
        $perm = $this->checkPermission('products.view');
        if ($perm) return $perm;

        try {
            $product = Product::with('category', 'shop')->findOrFail($id);
            $this->logAudit('view_product', 'product', $product->product_id, "Viewed product IMEI: {$product->imei}");
            return $this->successResponse($product, 'Product retrieved');
        } catch (\Exception $e) {
            return $this->notFound('Product not found');
        }
    }

    /**
     * Bulk create products with company loan prices
     * ✅ Automatically sets shop_id for Stock Controllers and Branch Owners.
     *    If the user has multiple shops, they must provide shop_id.
     * Permission: products.create
     */
    public function store(Request $request)
    {
        if (!$this->isAllowedToManageProducts()) {
            return $this->forbidden('Only Administrators, Managers, Stock Controllers, and Branch Owners can create products.');
        }

        $perm = $this->checkPermission('products.create');
        if ($perm) return $perm;

        try {
            $request->validate([
                'category_id' => 'required|string|exists:product_categories,category_id',
                'sku'         => 'required|string|max:255',
                'imeis'       => 'required|string',
                'buying_price' => 'sometimes|numeric|min:0|nullable',
                'cash_selling_price' => 'sometimes|numeric|min:0|nullable',
                'loan_selling_price' => 'nullable|array',
                'loan_selling_price.*.company_id' => 'required_with:loan_selling_price|string|exists:companies,id',
                'loan_selling_price.*.price' => 'required_with:loan_selling_price|numeric|min:0',
                'status' => 'sometimes|in:active,inactive,sold,returned',
            ]);

            $category = ProductCategory::find($request->category_id);
            if (!$category) {
                return $this->validationError(['category_id' => ['Category not found']]);
            }
            $validSkus = $category->sku ?? [];
            if (!in_array($request->sku, $validSkus)) {
                return $this->validationError(['sku' => ["SKU '{$request->sku}' is not valid for this category"]]);
            }

            $imeis = preg_split('/[\s,]+/', trim($request->imeis));
            $imeis = array_filter($imeis, fn($imei) => !empty($imei));
            if (empty($imeis)) {
                return $this->validationError(['imeis' => ['At least one IMEI is required']]);
            }

            $uniqueImeis = array_unique($imeis);
            if (count($imeis) !== count($uniqueImeis)) {
                return $this->validationError(['imeis' => ['Duplicate IMEIs in the list']]);
            }

            $existing = Product::whereIn('imei', $uniqueImeis)->pluck('imei')->toArray();
            if (!empty($existing)) {
                return $this->validationError(['imeis' => ['IMEIs already exist: ' . implode(', ', $existing)]]);
            }

            $buyingPrice = $request->buying_price;
            if (empty($buyingPrice) || $buyingPrice === null) {
                return $this->validationError(['buying_price' => ['Buying price is required']]);
            }

            // ---------- DETERMINE SHOP ID ----------
            $user = $request->user();
            $shopId = null;

            if ($user->isStockController() || $user->isBranchOwner()) {
                // Get all shops managed by this user
                $managedShops = Shop::where('manager_id', $user->id)->get();

                if ($managedShops->isEmpty()) {
                    return $this->badRequest('No shop assigned to your account. Please contact administrator.');
                }

                if ($managedShops->count() === 1) {
                    // Only one shop – auto‑assign
                    $shopId = $managedShops->first()->shop_id;
                } else {
                    // Multiple shops – require shop_id in the request
                    $request->validate([
                        'shop_id' => 'required|string|exists:shops,shop_id',
                    ]);

                    // Ensure the provided shop_id belongs to the user
                    if (!$managedShops->pluck('shop_id')->contains($request->shop_id)) {
                        return $this->forbidden('You are not the manager of the specified shop.');
                    }

                    $shopId = $request->shop_id;
                }
            } elseif ($user->hasRole('ADMINISTRATOR') || $user->hasRole('MANAGER')) {
                // Admin/Manager: may pass shop_id, or leave NULL
                if ($request->has('shop_id') && $request->shop_id) {
                    $request->validate(['shop_id' => 'string|exists:shops,shop_id']);
                    $shopId = $request->shop_id;
                }
                // If no shop_id provided, we let it remain NULL
            } else {
                // This should not happen due to permission check, but fallback
                return $this->forbidden('You are not allowed to create products without a shop.');
            }

            // Format loan prices
            $loanPrices = [];
            if ($request->has('loan_selling_price') && is_array($request->loan_selling_price)) {
                foreach ($request->loan_selling_price as $lp) {
                    if (isset($lp['company_id']) && isset($lp['price'])) {
                        $loanPrices[] = [
                            'company_id' => $lp['company_id'],
                            'price' => (float) $lp['price']
                        ];
                    }
                }
            }

            DB::beginTransaction();
            $created = [];
            foreach ($uniqueImeis as $imei) {
                $product = Product::create([
                    'category_id' => $request->category_id,
                    'sku'         => $request->sku,
                    'imei'        => $imei,
                    'buying_price' => $buyingPrice,
                    'cash_selling_price' => $request->cash_selling_price ?? null,
                    'loan_selling_price' => !empty($loanPrices) ? $loanPrices : null,
                    'status'      => $request->input('status', 'active'),
                    'stock_status' => 'in_stock',
                    'shop_id'     => $shopId,
                ]);
                $created[] = $product;
            }
            DB::commit();

            $this->logAudit('create_products', 'product', null,
                "Bulk created " . count($created) . " products" .
                ($shopId ? " for shop ID: {$shopId}" : " without a shop (admin)"));

            return $this->created($created, count($created) . ' products created successfully');
        } catch (ValidationException $e) {
            DB::rollBack();
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create products: ' . $e->getMessage());
        }
    }

    /**
     * Update a product
     * Permission: products.edit
     * Only Administrator, Manager, Stock Controller, and Branch Owner allowed.
     */
    public function update(Request $request, $id)
    {
        if (!$this->isAllowedToManageProducts()) {
            return $this->forbidden('Only Administrators, Managers, Stock Controllers, and Branch Owners can update products.');
        }

        $perm = $this->checkPermission('products.edit');
        if ($perm) return $perm;

        try {
            $product = Product::findOrFail($id);

            $request->validate([
                'category_id' => 'sometimes|string|exists:product_categories,category_id',
                'sku'         => 'nullable|string|max:255',
                'imei'        => 'nullable|string|max:255|unique:products,imei,' . $product->product_id . ',product_id',
                'buying_price' => 'sometimes|numeric|min:0',
                'cash_selling_price' => 'sometimes|numeric|min:0|nullable',
                'loan_selling_price' => 'nullable|array',
                'loan_selling_price.*.company_id' => 'required_with:loan_selling_price|string|exists:companies,id',
                'loan_selling_price.*.price' => 'required_with:loan_selling_price|numeric|min:0',
                'status' => 'sometimes|in:active,inactive,sold,returned',
                'shop_id' => 'sometimes|nullable|string|exists:shops,shop_id',
            ]);

            $data = $request->only(['category_id', 'sku', 'imei', 'buying_price', 'cash_selling_price', 'status', 'shop_id']);

            // Process loan_selling_price
            if ($request->has('loan_selling_price') && is_array($request->loan_selling_price)) {
                $loanPrices = [];
                foreach ($request->loan_selling_price as $lp) {
                    if (isset($lp['company_id']) && isset($lp['price'])) {
                        $loanPrices[] = [
                            'company_id' => $lp['company_id'],
                            'price' => (float) $lp['price']
                        ];
                    }
                }
                $data['loan_selling_price'] = !empty($loanPrices) ? $loanPrices : null;
            } else {
                if ($request->has('loan_selling_price') && $request->loan_selling_price === []) {
                    $data['loan_selling_price'] = null;
                }
            }

            // Prevent Stock Controllers and Branch Owners from changing shop_id
            if ($request->user()->isStockController() || $request->user()->isBranchOwner()) {
                unset($data['shop_id']);
            }

            // Validate SKU against category if changed
            if (($request->has('category_id') && $request->category_id != $product->category_id) ||
                ($request->has('sku') && $request->sku != $product->sku)) {
                $catId = $request->category_id ?? $product->category_id;
                $sku = $request->sku ?? $product->sku;
                $category = ProductCategory::find($catId);
                if (!$category) {
                    return $this->validationError(['category_id' => ['Category not found']]);
                }
                $validSkus = $category->sku ?? [];
                if (!in_array($sku, $validSkus)) {
                    return $this->validationError(['sku' => ["SKU '{$sku}' is not valid for this category"]]);
                }
            }

            $product->update($data);

            $this->logAudit('update_product', 'product', $product->product_id,
                "Updated product IMEI: {$product->imei}");

            return $this->successResponse($product->load('category', 'shop'), 'Product updated');
        } catch (ValidationException $e) {
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            return $this->serverError('Failed to update product: ' . $e->getMessage());
        }
    }

    /**
     * Soft delete a product
     * Permission: products.delete
     */
    public function destroy($id, Request $request)
    {
        $perm = $this->checkPermission('products.delete');
        if ($perm) return $perm;

        try {
            $product = Product::findOrFail($id);
            $imei = $product->imei;
            $product->delete();
            $this->logAudit('delete_product', 'product', $id, "Soft-deleted product IMEI: {$imei}");
            return $this->successResponse(null, 'Product deleted (soft delete)');
        } catch (\Exception $e) {
            return $this->serverError('Failed to delete product');
        }
    }

    /**
     * Restore soft-deleted product
     * Permission: products.restore
     */
    public function restore($id, Request $request)
    {
        $perm = $this->checkPermission('products.restore');
        if ($perm) return $perm;

        try {
            $product = Product::withTrashed()->findOrFail($id);
            $product->restore();
            $this->logAudit('restore_product', 'product', $id, "Restored product IMEI: {$product->imei}");
            return $this->successResponse($product->load('category', 'shop'), 'Product restored');
        } catch (\Exception $e) {
            return $this->serverError('Failed to restore product');
        }
    }

    /**
     * Force delete product permanently
     * Permission: products.force_delete
     */
    public function forceDelete($id, Request $request)
    {
        $perm = $this->checkPermission('products.force_delete');
        if ($perm) return $perm;

        try {
            $product = Product::withTrashed()->findOrFail($id);
            $product->forceDelete();
            $this->logAudit('force_delete_product', 'product', $id, "Permanently deleted product ID: {$id}");
            return $this->successResponse(null, 'Product permanently deleted');
        } catch (\Exception $e) {
            return $this->serverError('Failed to permanently delete product');
        }
    }

    /**
     * Change product status
     * Permission: products.change_status
     */
    public function changeStatus(Request $request, $id)
    {
        $perm = $this->checkPermission('products.change_status');
        if ($perm) return $perm;

        try {
            $request->validate([
                'status' => 'required|in:active,inactive,sold,returned',
            ]);
            $product = Product::findOrFail($id);
            $oldStatus = $product->status;
            $product->setStatus($request->status);
            $this->logAudit('change_product_status', 'product', $product->product_id,
                "Changed status from {$oldStatus} to {$request->status} for product IMEI: {$product->imei}");
            return $this->successResponse($product, 'Product status updated');
        } catch (\Exception $e) {
            return $this->serverError('Failed to change product status');
        }
    }

    // -------------------------------------------------------------------------
    // SCANNER ENDPOINTS
    // -------------------------------------------------------------------------

    public function scanByImei($imei)
    {
        $perm = $this->checkPermission('products.scan');
        if ($perm) return $perm;

        try {
            $product = Product::with('category', 'shop')->where('imei', $imei)->first();
            if (!$product) {
                return $this->notFound('Product with this IMEI not found');
            }
            $this->logAudit('scan_imei', 'product', $product->product_id, "Scanned IMEI: {$imei}");
            return $this->successResponse($product, 'Product found');
        } catch (\Exception $e) {
            return $this->serverError('Failed to scan IMEI');
        }
    }

    public function scanImeiPost(Request $request)
    {
        $perm = $this->checkPermission('products.scan');
        if ($perm) return $perm;

        try {
            $request->validate(['imei' => 'required|string']);
            $imei = $request->imei;
            $product = Product::with('category', 'shop')->where('imei', $imei)->first();
            if (!$product) {
                return $this->notFound('Product with this IMEI not found');
            }
            $this->logAudit('scan_imei', 'product', $product->product_id, "Scanned IMEI: {$imei}");
            return $this->successResponse($product, 'Product found');
        } catch (ValidationException $e) {
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            return $this->serverError('Failed to scan IMEI');
        }
    }

    public function assignImei(Request $request, $id)
    {
        $perm = $this->checkPermission('products.assign_imei');
        if ($perm) return $perm;

        try {
            $product = Product::findOrFail($id);
            $request->validate([
                'imei' => 'required|string|max:255|unique:products,imei,' . $product->product_id . ',product_id',
            ]);

            $oldImei = $product->imei;
            $product->imei = $request->imei;
            $product->save();

            $this->logAudit('assign_imei', 'product', $product->product_id, "Assigned IMEI: {$oldImei} → {$product->imei}");
            return $this->successResponse($product, 'IMEI assigned successfully');
        } catch (ValidationException $e) {
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            return $this->serverError('Failed to assign IMEI');
        }
    }

    // -------------------------------------------------------------------------
    // DROPDOWN ENDPOINTS
    // -------------------------------------------------------------------------

    public function Productdropdown(Request $request)
    {
        $perm = $this->checkPermission('products.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $query = Product::select('product_id', 'imei', 'sku', 'category_id', 'cash_selling_price', 'loan_selling_price')
                ->with(['category' => fn($q) => $q->select('category_id', 'category_name', 'model')])
                ->where('status', 'active')
                ->where('stock_status', 'in_stock')
                ->whereNull('deleted_at');

            // Apply shop filter if not admin/manager
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
                if (!empty($shopIds)) {
                    $query->whereIn('shop_id', $shopIds);
                } else {
                    // No shops – return empty
                    return $this->successResponse([], 'No shops assigned to your account.');
                }
            }

            if ($request->filled('category_id')) {
                $query->where('category_id', $request->category_id);
            }
            if ($request->filled('search')) {
                $s = $request->search;
                $query->where(fn($q) => $q->where('imei', 'LIKE', "%{$s}%")
                                          ->orWhere('sku', 'LIKE', "%{$s}%"));
            }

            $products = $query->orderBy('imei')
                ->get()
                ->map(fn($p) => [
                    'id'    => $p->product_id,
                    'label' => ($p->category?->category_name ?? 'No Category') . ' | ' .
                               ($p->category?->model ?? 'No Model') . ' | ' .
                               ($p->sku ?? 'No SKU') . ' | IMEI: ' . ($p->imei ?? ''),
                    'cash_selling_price'  => $p->cash_selling_price,
                    'loan_selling_price'  => $p->loan_selling_price,
                ]);

            return $this->successResponse($products, 'Products available for addition retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch available products: ' . $e->getMessage());
        }
    }
}