<?php

namespace App\Http\Controllers\Api;

use App\Models\Sale;
use App\Models\Product;
use App\Models\Shop;
use App\Traits\Auditable;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SaleController extends BaseApiController
{
    use Auditable;

    /**
     * List sales – filtered by user role
     * Permission: sales.view
     */
    public function index(Request $request)
    {
        $perm = $this->checkPermission('sales.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $query = Sale::with(['agent', 'product.category', 'product.shop', 'company']);

            // If user is NOT Administrator or Manager, restrict by assigned shops
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();

                if (!empty($shopIds)) {
                    $query->whereHas('product', function ($q) use ($shopIds) {
                        $q->whereIn('shop_id', $shopIds);
                    });
                } else {
                    // If user manages no shops, fallback to their own sales
                    $query->where('agent_id', $user->id);
                }
            }

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('agent_id')) {
                $query->where('agent_id', $request->agent_id);
            }
            if ($request->filled('from_date')) {
                $query->whereDate('created_at', '>=', $request->from_date);
            }
            if ($request->filled('to_date')) {
                $query->whereDate('created_at', '<=', $request->to_date);
            }
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->whereHas('agent', function ($q) use ($search) {
                        $q->where('name', 'LIKE', "%{$search}%");
                    })->orWhereHas('product', function ($q) use ($search) {
                        $q->where('imei', 'LIKE', "%{$search}%")
                          ->orWhere('sku', 'LIKE', "%{$search}%");
                    })->orWhere('sale_id', 'LIKE', "%{$search}%");
                });
            }

            $sales = $query->orderBy('created_at', 'desc')
                           ->paginate($request->get('per_page', 15));

            $this->logAudit('view_sales', 'sale', null, 'Viewed sales list');
            return $this->successResponse($sales, 'Sales retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch sales: ' . $e->getMessage());
        }
    }

    public function show($id, Request $request)
    {
        $perm = $this->checkPermission('sales.view');
        if ($perm) return $perm;

        try {
            $sale = Sale::with(['agent', 'product.category', 'company'])->findOrFail($id);
            
            $user = $request->user();
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                if ($sale->agent_id !== $user->id) {
                    return $this->forbidden('You do not have permission to view this sale');
                }
            }
            
            return $this->successResponse($sale, 'Sale retrieved successfully');
        } catch (\Exception $e) {
            return $this->notFound('Sale not found');
        }
    }

    /**
     * Create a new sale
     * Permission: sales.create
     */
    public function store(Request $request)
    {
        $perm = $this->checkPermission('sales.create');
        if ($perm) return $perm;

        try {
            $request->validate([
                'product_id'     => 'required|string|exists:products,product_id',
                'total_amount'   => 'required|numeric|min:0',
                'payment_method' => 'required|in:cash,loan,mpesa,bank',
                'company_id'     => 'required_if:payment_method,loan|nullable|exists:companies,id',
                'status'         => 'sometimes|in:pending,completed,cancelled,refunded',
                'notes'          => 'nullable|string',
            ]);

            $user = $request->user();
            $product = Product::with('shop')->findOrFail($request->product_id);

            if ($product->status === 'sold') {
                return $this->badRequest('This product has already been sold');
            }
            if ($product->stock_status !== 'in_stock') {
                return $this->badRequest('This product is not in stock');
            }

            $sale = Sale::create([
                'agent_id'       => $user->id,
                'product_id'     => $request->product_id,
                'total_amount'   => $request->total_amount,
                'payment_method' => $request->payment_method,
                'company_id'     => $request->company_id,
                'status'         => $request->status ?? 'pending',
                'notes'          => $request->notes,
            ]);

            $product->status = 'sold';
            $product->stock_status = 'sold';
            $product->save();

            $this->logAudit('create_sale', 'sale', $sale->sale_id, "Created sale for product: {$product->imei}");
            return $this->successResponse($sale->load('agent', 'product', 'company'), 'Sale created successfully');
        } catch (ValidationException $e) {
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            return $this->serverError('Failed to create sale: ' . $e->getMessage());
        }
    }

    /**
     * Update a sale
     * Permission: sales.edit
     * 
     * ✅ Prevents restoring a cancelled sale if the product has already been sold again.
     * Non‑admin/manager users can update only if the sale's product belongs to one of their assigned shops.
     */
    public function update(Request $request, $id)
    {
        $perm = $this->checkPermission('sales.edit');
        if ($perm) return $perm;

        try {
            $sale = Sale::findOrFail($id);
            $user = $request->user();

            // If not admin/manager, check shop ownership
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                $product = $sale->product;
                if (!$product) {
                    return $this->badRequest('Product not found for this sale');
                }
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
                if (!in_array($product->shop_id, $shopIds)) {
                    return $this->forbidden('You do not have permission to update this sale');
                }
            }

            $rules = [
                'total_amount'   => 'sometimes|numeric|min:0',
                'payment_method' => 'sometimes|in:cash,loan,mpesa,bank',
                'status'         => 'sometimes|in:pending,completed,cancelled,refunded',
                'notes'          => 'nullable|string',
            ];

            if ($request->has('status') && $request->status === 'cancelled') {
                $rules['cancellation_reason'] = 'required|string|min:3';
            }

            // ✅ Prevent restoring a cancelled sale if the product is already sold via another completed sale
            if ($request->has('status') && $request->status === 'completed' && $sale->status === 'cancelled') {
                $product = $sale->product;
                if ($product && $product->status === 'sold') {
                    $otherSale = Sale::where('product_id', $product->product_id)
                                     ->where('status', 'completed')
                                     ->where('sale_id', '!=', $sale->sale_id)
                                     ->exists();
                    if ($otherSale) {
                        return $this->badRequest('Cannot restore this sale – product has already been sold again.');
                    }
                }
            }

            $request->validate($rules);

            $oldStatus = $sale->status;

            $updateData = $request->only(['total_amount', 'payment_method', 'status', 'notes']);
            if ($request->has('cancellation_reason')) {
                $updateData['cancellation_reason'] = $request->cancellation_reason;
            }

            $sale->update($updateData);

            // Sync product status only if status changed
            if ($request->has('status') && $request->status !== $oldStatus) {
                $product = $sale->product;
                if ($product) {
                    switch ($request->status) {
                        case 'cancelled':
                            $product->status = 'active';
                            $product->stock_status = 'in_stock';
                            $product->save();
                            break;

                        case 'completed':
                            // Only set product to sold if it's not already sold by another sale (we already blocked the restore, but this is a safeguard)
                            // However, if we're completing a pending sale, it's fine.
                            $product->status = 'sold';
                            $product->stock_status = 'sold';
                            $product->save();
                            break;
                    }
                }
            }

            $this->logAudit('update_sale', 'sale', $sale->sale_id, "Updated sale");
            return $this->successResponse($sale->load('agent', 'product', 'company'), 'Sale updated successfully');

        } catch (ValidationException $e) {
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            return $this->serverError('Failed to update sale: ' . $e->getMessage());
        }
    }

    public function destroy($id, Request $request)
    {
        $perm = $this->checkPermission('sales.delete');
        if ($perm) return $perm;

        try {
            $sale = Sale::findOrFail($id);
            $user = $request->user();

            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                return $this->forbidden('Only administrators and managers can delete sales');
            }

            $product = $sale->product;
            if ($product) {
                $product->status = 'active';
                $product->stock_status = 'in_stock';
                $product->save();
            }

            $sale->delete();

            $this->logAudit('delete_sale', 'sale', $id, "Deleted sale");
            return $this->successResponse(null, 'Sale deleted successfully');
        } catch (\Exception $e) {
            return $this->serverError('Failed to delete sale: ' . $e->getMessage());
        }
    }

    public function stats(Request $request)
    {
        $perm = $this->checkPermission('sales.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $query = Sale::query();

            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                $shopIds = Shop::where('manager_id', $user->id)->pluck('shop_id')->toArray();
                if (!empty($shopIds)) {
                    $query->whereHas('product', function ($q) use ($shopIds) {
                        $q->whereIn('shop_id', $shopIds);
                    });
                } else {
                    $query->where('agent_id', $user->id);
                }
            }

            $total = $query->count();
            $totalAmount = $query->sum('total_amount');

            $byStatus = $query->select('status', \DB::raw('count(*) as count'))
                             ->groupBy('status')
                             ->pluck('count', 'status')
                             ->toArray();

            $byPaymentMethod = $query->select('payment_method', \DB::raw('count(*) as count'))
                                    ->groupBy('payment_method')
                                    ->pluck('count', 'payment_method')
                                    ->toArray();

            return $this->successResponse([
                'total' => $total,
                'total_amount' => $totalAmount,
                'by_status' => $byStatus,
                'by_payment_method' => $byPaymentMethod,
            ], 'Sales stats retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to get stats: ' . $e->getMessage());
        }
    }
}