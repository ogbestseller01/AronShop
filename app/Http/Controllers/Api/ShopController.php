<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\BaseApiController;
use App\Models\Shop;
use App\Models\User;
use App\Traits\Auditable;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class ShopController extends BaseApiController
{
    use Auditable;

    /**
     * List shops
     * Permission: warehouses.view
     * ✅ Admin/Manager see all shops. Other users see only their assigned shops.
     */
    public function index(Request $request)
    {
        $perm = $this->checkPermission('warehouses.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $query = Shop::with('manager');

            // ✅ If user is NOT Administrator or Manager, filter by manager_id
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                $query->where('manager_id', $user->id);
            }

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }
            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('location', 'LIKE', "%{$search}%");
                });
            }
            $shops = $query->orderBy('created_at', 'desc')
                           ->paginate($request->get('per_page', 15));
            $this->logAudit('view_shops', 'shop', null, 'Viewed shops list');
            return $this->successResponse($shops, 'Shops retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch shops');
        }
    }

    /**
     * Get shops as dropdown (id + name)
     * Permission: warehouses.view
     * ✅ Admin/Manager see all active shops. Other users see only their assigned shops.
     */
    public function Shopsdropdown(Request $request)
    {
        $perm = $this->checkPermission('warehouses.view');
        if ($perm) return $perm;

        try {
            $user = $request->user();
            $query = Shop::select('shop_id', 'name', 'location', 'status')
                ->where('status', 'active')
                ->whereNull('deleted_at');

            // ✅ If user is NOT Administrator or Manager, filter by manager_id
            if (!$user->hasRole('ADMINISTRATOR') && !$user->hasRole('MANAGER')) {
                $query->where('manager_id', $user->id);
            }

            $shops = $query->orderBy('name')
                ->get()
                ->map(function ($shop) {
                    return [
                        'id'    => $shop->shop_id,
                        'label' => $shop->name . ($shop->location ? ' — ' . $shop->location : ''),
                    ];
                });

            return $this->successResponse($shops, 'Shops dropdown retrieved');
        } catch (\Exception $e) {
            return $this->serverError('Failed to fetch shops dropdown: ' . $e->getMessage());
        }
    }

    /**
     * Show single shop
     * Permission: warehouses.view
     */
    public function show($id)
    {
        $perm = $this->checkPermission('warehouses.view');
        if ($perm) return $perm;

        try {
            $shop = Shop::with('manager')->findOrFail($id);
            $this->logAudit('view_shop', 'shop', $shop->shop_id, "Viewed shop: {$shop->name}");
            return $this->successResponse($shop, 'Shop retrieved');
        } catch (\Exception $e) {
            return $this->notFound('Shop not found');
        }
    }

    /**
     * Create a new shop
     * Permission: warehouses.create
     */
    public function store(Request $request)
    {
        $perm = $this->checkPermission('warehouses.create');
        if ($perm) return $perm;

        try {
            $request->validate([
                'name'        => 'required|string|max:255|unique:shops,name',
                'location'    => 'nullable|string',
                'manager_id'  => 'nullable|string|exists:users,id',
                'status'      => 'sometimes|in:active,inactive,maintenance',
            ]);

            DB::beginTransaction();

            $data = $request->only(['name', 'location', 'manager_id']);
            $data['status'] = $request->input('status', 'active');

            $shop = Shop::create($data);
            DB::commit();

            $this->logAudit('create_shop', 'shop', $shop->shop_id,
                "Created shop: {$shop->name} (status: {$shop->status})");

            return $this->created($shop->load('manager'), 'Shop created successfully');
        } catch (ValidationException $e) {
            DB::rollBack();
            return $this->validationError($e->errors());
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create shop: ' . $e->getMessage());
        }
    }

    /**
     * Update shop
     * Permission: warehouses.edit
     */
    public function update(Request $request, $id)
    {
        $perm = $this->checkPermission('warehouses.edit');
        if ($perm) return $perm;

        try {
            $shop = Shop::findOrFail($id);
            $request->validate([
                'name'        => 'sometimes|string|max:255|unique:shops,name,' . $shop->shop_id . ',shop_id',
                'location'    => 'nullable|string',
                'manager_id'  => 'nullable|string|exists:users,id',
                'status'      => 'sometimes|in:active,inactive,maintenance',
            ]);

            $oldName = $shop->name;
            $data = $request->only(['name', 'location', 'manager_id', 'status']);
            $shop->update($data);

            $this->logAudit('update_shop', 'shop', $shop->shop_id,
                "Updated shop from '{$oldName}' to '{$shop->name}'");

            return $this->successResponse($shop->load('manager'), 'Shop updated');
        } catch (\Exception $e) {
            return $this->serverError('Failed to update shop');
        }
    }

    /**
     * Soft delete shop
     * Permission: warehouses.delete
     */
    public function destroy($id, Request $request)
    {
        $perm = $this->checkPermission('warehouses.delete');
        if ($perm) return $perm;

        try {
            $shop = Shop::findOrFail($id);
            $name = $shop->name;
            $shop->delete();

            $this->logAudit('delete_shop', 'shop', $id, "Soft-deleted shop: {$name}");
            return $this->successResponse(null, 'Shop deleted (soft delete)');
        } catch (\Exception $e) {
            return $this->serverError('Failed to delete shop');
        }
    }

    /**
     * Restore soft-deleted shop
     * Permission: warehouses.restore
     */
    public function restore($id, Request $request)
    {
        $perm = $this->checkPermission('warehouses.restore');
        if ($perm) return $perm;

        try {
            $shop = Shop::withTrashed()->findOrFail($id);
            $shop->restore();

            $this->logAudit('restore_shop', 'shop', $id, "Restored shop: {$shop->name}");
            return $this->successResponse($shop->load('manager'), 'Shop restored');
        } catch (\Exception $e) {
            return $this->serverError('Failed to restore shop');
        }
    }

    /**
     * Force delete shop permanently
     * Permission: warehouses.force_delete
     */
    public function forceDelete($id, Request $request)
    {
        $perm = $this->checkPermission('warehouses.force_delete');
        if ($perm) return $perm;

        try {
            $shop = Shop::withTrashed()->findOrFail($id);
            $name = $shop->name;
            $shop->forceDelete();

            $this->logAudit('force_delete_shop', 'shop', $id, "Permanently deleted shop: {$name}");
            return $this->successResponse(null, 'Shop permanently deleted');
        } catch (\Exception $e) {
            return $this->serverError('Failed to permanently delete shop');
        }
    }

    /**
     * Change shop status
     * Permission: warehouses.edit
     * ✅ Direct update (no missing method)
     */
    public function changeStatus(Request $request, $id)
    {
        $perm = $this->checkPermission('warehouses.edit');
        if ($perm) return $perm;

        try {
            $request->validate([
                'status' => 'required|in:active,inactive,maintenance',
            ]);

            $shop = Shop::findOrFail($id);
            $oldStatus = $shop->status;
            
            // ✅ Direct update
            $shop->status = $request->status;
            $shop->save();

            $this->logAudit('change_shop_status', 'shop', $shop->shop_id,
                "Changed status from {$oldStatus} to {$request->status} for shop {$shop->name}");

            return $this->successResponse($shop, 'Shop status updated');
        } catch (\Exception $e) {
            return $this->serverError('Failed to change shop status');
        }
    }
}