import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fluttertoast/fluttertoast.dart';

import '../config/app_config.dart';
import '../models/category.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class ProductDetailScreen extends StatefulWidget {
  final String productId;

  const ProductDetailScreen({
    super.key,
    required this.productId,
  });

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen>
    with SingleTickerProviderStateMixin {
  Product? _product;
  bool _isLoading = true;
  bool _isEditing = false;
  bool _isSaving = false;
  bool _isDeleting = false;
  String? _error;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  final _formKey = GlobalKey<FormState>();
  final _skuController = TextEditingController();
  final _imeiController = TextEditingController();
  final _buyingPriceController = TextEditingController();
  final _cashSellingPriceController = TextEditingController();

  String? _selectedCategoryId;
  String? _selectedShopId;
  String? _selectedStatus;
  String? _selectedSku;

  List<CategoryDropdown> _categories = [];
  List<Map<String, dynamic>> _shops = [];
  List<String> _skuOptions = [];
  bool _isLoadingDropdowns = false;

  // ===== PERMISSIONS (same idea as web) =====
  String get _role {
    final user = context.read<AuthService>().user;
    return (user?.role ?? '').toUpperCase();
  }

  bool get _canManage =>
      _role == 'ADMINISTRATOR' ||
          _role == 'ADMIN' ||
          _role == 'MANAGER' ||
          _role == 'STOCK_CONTROLLER' ||
          _role == 'BRANCH_OWNER';

  bool get _canEdit => _canManage;
  bool get _canDelete => _canManage;
  bool get _canChangeStatus => _canManage;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    );
    _loadProduct();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _skuController.dispose();
    _imeiController.dispose();
    _buyingPriceController.dispose();
    _cashSellingPriceController.dispose();
    super.dispose();
  }

  Future<void> _loadProduct() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);
      final product = await api.getProduct(widget.productId);

      if (!mounted) return;
      setState(() {
        _product = product;
        _isLoading = false;
        _populateControllers();
      });
      _animationController.forward();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  void _populateControllers() {
    if (_product == null) return;
    _imeiController.text = _product!.imei;
    _skuController.text = _product!.sku;
    _selectedSku = _product!.sku;
    _buyingPriceController.text =
        _product!.buyingPrice?.toStringAsFixed(2) ?? '';
    _cashSellingPriceController.text =
        _product!.cashSellingPrice?.toStringAsFixed(2) ?? '';
    _selectedCategoryId = _product!.categoryId;
    _selectedShopId = _product!.shopId;
    _selectedStatus = _product!.status;
  }

  Future<void> _loadDropdowns() async {
    setState(() => _isLoadingDropdowns = true);
    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);
      final results = await Future.wait([
        api.getCategoryDropdown(),
        api.getShopDropdown(),
      ]);

      if (!mounted) return;

      final categories = results[0] as List<CategoryDropdown>;
      final shops = results[1] as List<Map<String, dynamic>>;

      List<String> skus = [];
      if (_selectedCategoryId != null) {
        final cat = categories.firstWhere(
              (c) => c.value == _selectedCategoryId,
          orElse: () => CategoryDropdown(value: '', label: ''),
        );
        skus = List<String>.from(cat.skus ?? []);
      }

      if (_selectedSku != null &&
          _selectedSku!.isNotEmpty &&
          !skus.contains(_selectedSku)) {
        skus = [...skus, _selectedSku!];
      }

      setState(() {
        _categories = categories;
        _shops = shops;
        _skuOptions = skus;
        _isLoadingDropdowns = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoadingDropdowns = false);
      Fluttertoast.showToast(
        msg: 'Failed to load options',
        backgroundColor: Colors.red,
        textColor: Colors.white,
      );
    }
  }

  void _onCategoryChanged(String? categoryId) {
    setState(() {
      _selectedCategoryId = categoryId;
      _selectedSku = null;
      _skuController.clear();

      final cat = _categories.firstWhere(
            (c) => c.value == categoryId,
        orElse: () => CategoryDropdown(value: '', label: ''),
      );
      _skuOptions = cat.skus ?? [];

      if (_skuOptions.length == 1) {
        _selectedSku = _skuOptions.first;
        _skuController.text = _skuOptions.first;
      }
    });
  }

  Future<void> _saveProduct() async {
    if (!_canEdit) {
      Fluttertoast.showToast(
        msg: 'You do not have permission to edit products',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);

      final data = <String, dynamic>{
        'sku': _selectedSku ?? _skuController.text.trim(),
        'imei': _imeiController.text.trim(),
        'category_id': _selectedCategoryId,
        'buying_price': double.tryParse(_buyingPriceController.text) ?? 0,
        'cash_selling_price':
        double.tryParse(_cashSellingPriceController.text),
        'status': _selectedStatus,
        if (_selectedShopId != null) 'shop_id': _selectedShopId,
      };

      data.removeWhere((k, v) => v == null);

      final updatedProduct = await api.updateProduct(widget.productId, data);

      if (!mounted) return;
      setState(() {
        _product = updatedProduct;
        _isEditing = false;
        _isSaving = false;
        _populateControllers();
      });

      Fluttertoast.showToast(
        msg: 'Product updated successfully',
        backgroundColor: Colors.green,
        textColor: Colors.white,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      Fluttertoast.showToast(
        msg: e.toString().replaceFirst('Exception: ', ''),
        backgroundColor: Colors.red,
        textColor: Colors.white,
        toastLength: Toast.LENGTH_LONG,
      );
    }
  }

  Future<void> _changeStatus(String newStatus) async {
    if (!_canChangeStatus) {
      Fluttertoast.showToast(
        msg: 'You do not have permission to change status',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);
      await api.changeProductStatus(widget.productId, newStatus);

      if (!mounted) return;
      setState(() {
        _product = _product!.copyWith(status: newStatus);
        _selectedStatus = newStatus;
      });

      Fluttertoast.showToast(
        msg: 'Status updated to $newStatus',
        backgroundColor: Colors.green,
        textColor: Colors.white,
      );
    } catch (e) {
      Fluttertoast.showToast(
        msg: e.toString().replaceFirst('Exception: ', ''),
        backgroundColor: Colors.red,
        textColor: Colors.white,
      );
    }
  }

  Future<void> _deleteProduct() async {
    if (!_canDelete) {
      Fluttertoast.showToast(
        msg: 'You do not have permission to delete products',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Product'),
        content: const Text(
          'Are you sure you want to delete this product? This action can be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isDeleting = true);

    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);
      await api.deleteProduct(widget.productId);

      if (!mounted) return;
      Fluttertoast.showToast(
        msg: 'Product deleted successfully',
        backgroundColor: Colors.green,
        textColor: Colors.white,
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isDeleting = false);
      Fluttertoast.showToast(
        msg: e.toString().replaceFirst('Exception: ', ''),
        backgroundColor: Colors.red,
        textColor: Colors.white,
      );
    }
  }

  void _toggleEdit() {
    if (!_canEdit) {
      Fluttertoast.showToast(
        msg: 'You do not have permission to edit products',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    if (_isEditing) {
      setState(() {
        _isEditing = false;
        _populateControllers();
      });
    } else {
      _loadDropdowns();
      setState(() => _isEditing = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit Product' : 'Product Details'),
        elevation: 0,
        backgroundColor: AppConfig.primaryColor,
        foregroundColor: Colors.white,
        actions: [
          if (!_isLoading && _product != null) ...[
            // Edit icon – fainted if no permission
            IconButton(
              icon: Icon(
                _isEditing ? Icons.close : Icons.edit_outlined,
                color: _canEdit || _isEditing
                    ? Colors.white
                    : Colors.white.withOpacity(0.35),
              ),
              onPressed: _canEdit || _isEditing ? _toggleEdit : null,
              tooltip: _isEditing
                  ? 'Cancel'
                  : (_canEdit ? 'Edit' : 'No permission to edit'),
            ),
            if (!_isEditing)
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert),
                onSelected: (value) {
                  if (value == 'delete') _deleteProduct();
                  if (value == 'refresh') _loadProduct();
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'refresh',
                    child: Row(
                      children: [
                        Icon(Icons.refresh, size: 20),
                        SizedBox(width: 8),
                        Text('Refresh'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'delete',
                    enabled: _canDelete,
                    child: Row(
                      children: [
                        Icon(
                          Icons.delete_outline,
                          size: 20,
                          color: _canDelete ? Colors.red : Colors.grey,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Delete',
                          style: TextStyle(
                            color: _canDelete ? Colors.red : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
          ],
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _buildErrorWidget()
          : FadeTransition(
        opacity: _fadeAnimation,
        child: _product == null
            ? const Center(child: Text('Product not found'))
            : _isEditing
            ? _buildEditForm()
            : _buildProductDetails(),
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              _error ?? 'Something went wrong',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 15),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadProduct,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConfig.primaryColor,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductDetails() {
    final product = _product!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppConfig.primaryColor,
                  AppConfig.primaryColor.withOpacity(0.85),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppConfig.primaryColor.withOpacity(0.25),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.devices,
                        color: Colors.white,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            product.categoryName ?? 'No Category',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'IMEI: ${product.imei}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'SKU: ${product.sku}',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _buildStatusBadge(product.status),
                    const Spacer(),
                    if (product.cashSellingPrice != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'TSh ${product.cashSellingPrice!.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Change Status – only interactive if permitted
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Change Status',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _canChangeStatus
                        ? Colors.black87
                        : Colors.grey.shade400,
                  ),
                ),
                if (!_canChangeStatus)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'No permission to change status',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade400,
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildStatusButton('active', Colors.green),
                    _buildStatusButton('inactive', Colors.grey),
                    _buildStatusButton('sold', Colors.blue),
                    _buildStatusButton('returned', Colors.orange),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Product Information
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Product Information',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Divider(height: 20),
                _buildDetailRow(
                  'Category',
                  product.categoryName ?? 'Not set',
                  icon: Icons.category,
                ),
                _buildDetailRow(
                  'Shop',
                  product.shopName ?? 'Not assigned',
                  icon: Icons.store,
                ),
                _buildDetailRow(
                  'Buying Price',
                  product.buyingPrice != null
                      ? 'TSh ${product.buyingPrice!.toStringAsFixed(2)}'
                      : 'Not set',
                  icon: Icons.shopping_cart,
                ),
                _buildDetailRow(
                  'Cash Selling Price',
                  product.cashSellingPrice != null
                      ? 'TSh ${product.cashSellingPrice!.toStringAsFixed(2)}'
                      : 'Not set',
                  icon: Icons.attach_money,
                ),
                _buildDetailRow(
                  'Stock Status',
                  product.stockStatus.toUpperCase(),
                  icon: Icons.inventory_2,
                  valueColor: _getStockStatusColor(product.stockStatus),
                ),
                _buildDetailRow(
                  'Created At',
                  _formatDate(product.createdAt),
                  icon: Icons.calendar_today,
                ),
                if (product.updatedAt != null)
                  _buildDetailRow(
                    'Last Updated',
                    _formatDate(product.updatedAt!),
                    icon: Icons.update,
                  ),
                if (product.loanSellingPrice != null &&
                    product.loanSellingPrice!.isNotEmpty) ...[
                  const Divider(height: 20),
                  const Text(
                    'Loan Prices by Company',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...product.loanSellingPrice!
                      .map((loan) => _buildLoanPriceTile(loan)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Actions – fainted when no permission
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _canEdit ? _toggleEdit : null,
                  icon: Icon(
                    Icons.edit_outlined,
                    size: 18,
                    color: _canEdit ? null : Colors.grey.shade400,
                  ),
                  label: Text(
                    'Edit',
                    style: TextStyle(
                      color: _canEdit ? null : Colors.grey.shade400,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    side: BorderSide(
                      color: _canEdit
                          ? Colors.grey.shade400
                          : Colors.grey.shade300,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed:
                  (_canDelete && !_isDeleting) ? _deleteProduct : null,
                  icon: _isDeleting
                      ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                      : Icon(
                    Icons.delete_outline,
                    size: 18,
                    color: _canDelete ? Colors.red : Colors.grey.shade400,
                  ),
                  label: Text(
                    'Delete',
                    style: TextStyle(
                      color: _canDelete ? Colors.red : Colors.grey.shade400,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    side: BorderSide(
                      color: _canDelete ? Colors.red : Colors.grey.shade300,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildEditForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            TextFormField(
              controller: _imeiController,
              decoration: const InputDecoration(
                labelText: 'IMEI *',
                hintText: 'Enter IMEI number',
                prefixIcon: Icon(Icons.qr_code),
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) return 'Please enter IMEI';
                return null;
              },
            ),
            const SizedBox(height: 14),
            _isLoadingDropdowns
                ? const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            )
                : DropdownButtonFormField<String>(
              value: _selectedCategoryId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Category *',
                prefixIcon: Icon(Icons.category),
                border: OutlineInputBorder(),
              ),
              items: _categories.map((cat) {
                return DropdownMenuItem(
                  value: cat.value,
                  child: Text(
                    cat.label,
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
              onChanged: _onCategoryChanged,
              validator: (v) =>
              (v == null || v.isEmpty) ? 'Select category' : null,
            ),
            const SizedBox(height: 14),
            _isLoadingDropdowns
                ? const SizedBox.shrink()
                : _skuOptions.isEmpty
                ? TextFormField(
              controller: _skuController,
              decoration: const InputDecoration(
                labelText: 'SKU *',
                hintText: 'Enter SKU',
                prefixIcon: Icon(Icons.inventory),
                border: OutlineInputBorder(),
              ),
              onChanged: (v) => _selectedSku = v,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter SKU';
                }
                return null;
              },
            )
                : DropdownButtonFormField<String>(
              value: _selectedSku,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'SKU *',
                prefixIcon: Icon(Icons.inventory),
                border: OutlineInputBorder(),
              ),
              items: _skuOptions.map((s) {
                return DropdownMenuItem(
                  value: s,
                  child: Text(s, overflow: TextOverflow.ellipsis),
                );
              }).toList(),
              onChanged: (v) {
                setState(() {
                  _selectedSku = v;
                  _skuController.text = v ?? '';
                });
              },
              validator: (v) =>
              (v == null || v.isEmpty) ? 'Select SKU' : null,
            ),
            const SizedBox(height: 14),
            _isLoadingDropdowns
                ? const SizedBox.shrink()
                : DropdownButtonFormField<String>(
              value: _selectedShopId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Shop (Optional)',
                prefixIcon: Icon(Icons.store),
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('None'),
                ),
                ..._shops.map((shop) {
                  return DropdownMenuItem(
                    value: shop['id']?.toString() ??
                        shop['shop_id']?.toString(),
                    child: Text(
                      shop['label'] ?? shop['name'] ?? '',
                      overflow: TextOverflow.ellipsis,
                    ),
                  );
                }),
              ],
              onChanged: (v) => setState(() => _selectedShopId = v),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _buyingPriceController,
              keyboardType:
              const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Buying Price *',
                prefixText: 'TSh ',
                prefixIcon: Icon(Icons.shopping_cart),
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) return 'Required';
                if (double.tryParse(value) == null) return 'Invalid number';
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _cashSellingPriceController,
              keyboardType:
              const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Cash Selling Price',
                prefixText: 'TSh ',
                prefixIcon: Icon(Icons.attach_money),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _selectedStatus,
              decoration: const InputDecoration(
                labelText: 'Status',
                prefixIcon: Icon(Icons.toggle_on),
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'active', child: Text('Active')),
                DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                DropdownMenuItem(value: 'sold', child: Text('Sold')),
                DropdownMenuItem(value: 'returned', child: Text('Returned')),
              ],
              onChanged: (v) => setState(() => _selectedStatus = v),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSaving ? null : _toggleEdit,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveProduct,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppConfig.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isSaving
                        ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                        : const Text(
                      'Save Changes',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
      String label,
      String value, {
        IconData? icon,
        Color? valueColor,
      }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: Colors.grey.shade500),
            const SizedBox(width: 10),
          ],
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                color: valueColor ?? Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoanPriceTile(LoanPrice loan) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const Icon(Icons.business, size: 16, color: Colors.grey),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Company: ${loan.companyId}',
              style: const TextStyle(fontSize: 13),
            ),
          ),
          Text(
            'TSh ${loan.price.toStringAsFixed(2)}',
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: AppConfig.secondaryColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            status.toUpperCase(),
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusButton(String status, Color color) {
    final isSelected = _product?.status == status;
    final enabled = _canChangeStatus;

    return OutlinedButton(
      onPressed: enabled ? () => _changeStatus(status) : null,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        backgroundColor: isSelected && enabled
            ? color.withOpacity(0.12)
            : Colors.transparent,
        side: BorderSide(
          color: !enabled
              ? Colors.grey.shade300
              : (isSelected ? color : Colors.grey.shade300),
          width: isSelected && enabled ? 1.5 : 1,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: !enabled
              ? Colors.grey.shade400
              : (isSelected ? color : Colors.grey.shade600),
          fontWeight: isSelected && enabled ? FontWeight.w600 : FontWeight.w400,
          fontSize: 11,
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return Colors.green;
      case 'inactive':
        return Colors.grey;
      case 'sold':
        return Colors.blue;
      case 'returned':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  Color _getStockStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'in_stock':
        return Colors.green;
      case 'out_of_stock':
        return Colors.red;
      case 'low_stock':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} '
        '${date.hour.toString().padLeft(2, '0')}:'
        '${date.minute.toString().padLeft(2, '0')}';
  }
}