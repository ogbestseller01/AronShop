import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_theme.dart';
import '../main.dart';
import '../models/category.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/dialog_helper.dart';

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

  String t(String en, String sw) =>
      context.read<ThemeController>().isSw ? sw : en;

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
      DialogHelper.showErrorDialog(
        context,
        message: t('Failed to load options', 'Imeshindwa kupakia chaguo'),
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
      DialogHelper.showWarningDialog(
        context,
        message: t(
          'You do not have permission to edit products',
          'Huna ruhusa ya kuhariri bidhaa',
        ),
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

      DialogHelper.showSuccessDialog(
        context,
        message: t('Product updated successfully', 'Bidhaa imesasishwa'),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      DialogHelper.showErrorDialog(
        context,
        message: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _changeStatus(String newStatus) async {
    if (!_canChangeStatus) {
      DialogHelper.showWarningDialog(
        context,
        message: t(
          'You do not have permission to change status',
          'Huna ruhusa ya kubadilisha hali',
        ),
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

      DialogHelper.showSuccessDialog(
        context,
        message: t(
          'Status updated to $newStatus',
          'Hali imebadilishwa kuwa $newStatus',
        ),
      );
    } catch (e) {
      if (!mounted) return;
      DialogHelper.showErrorDialog(
        context,
        message: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _deleteProduct() async {
    if (!_canDelete) {
      DialogHelper.showWarningDialog(
        context,
        message: t(
          'You do not have permission to delete products',
          'Huna ruhusa ya kufuta bidhaa',
        ),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(t('Delete Product', 'Futa Bidhaa')),
        content: Text(
          t(
            'Are you sure you want to delete this product? This action can be undone.',
            'Una uhakika unataka kufuta bidhaa hii? Kitendo hiki kinaweza kutenduliwa.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(t('Cancel', 'Ghairi')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
            ),
            child: Text(t('Delete', 'Futa')),
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
      await DialogHelper.showSuccessDialog(
        context,
        message: t('Product deleted successfully', 'Bidhaa imefutwa'),
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isDeleting = false);
      DialogHelper.showErrorDialog(
        context,
        message: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  void _toggleEdit() {
    if (!_canEdit) {
      DialogHelper.showWarningDialog(
        context,
        message: t(
          'You do not have permission to edit products',
          'Huna ruhusa ya kuhariri bidhaa',
        ),
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
    context.watch<ThemeController>();

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          _isEditing
              ? t('Edit Product', 'Hariri Bidhaa')
              : t('Product Details', 'Maelezo ya Bidhaa'),
        ),
        actions: [
          if (!_isLoading && _product != null) ...[
            IconButton(
              icon: Icon(
                _isEditing ? Icons.close : Icons.edit_outlined,
                color: _canEdit || _isEditing
                    ? Colors.white
                    : Colors.white.withOpacity(0.35),
              ),
              onPressed: _canEdit || _isEditing ? _toggleEdit : null,
              tooltip: _isEditing
                  ? t('Cancel', 'Ghairi')
                  : (_canEdit
                  ? t('Edit', 'Hariri')
                  : t('No permission to edit', 'Huna ruhusa ya kuhariri')),
            ),
            if (!_isEditing)
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert),
                onSelected: (value) {
                  if (value == 'delete') _deleteProduct();
                  if (value == 'refresh') _loadProduct();
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'refresh',
                    child: Row(
                      children: [
                        const Icon(Icons.refresh, size: 20),
                        const SizedBox(width: 8),
                        Text(t('Refresh', 'Onyesha upya')),
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
                          color: _canDelete ? AppTheme.error : Colors.grey,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          t('Delete', 'Futa'),
                          style: TextStyle(
                            color: _canDelete ? AppTheme.error : Colors.grey,
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
            ? Center(
          child: Text(
            t('Product not found', 'Bidhaa haijapatikana'),
          ),
        )
            : _isEditing
            ? _buildEditForm()
            : _buildProductDetails(),
      ),
    );
  }

  Widget _buildErrorWidget() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
            ),
            const SizedBox(height: 16),
            Text(
              _error ?? t('Something went wrong', 'Kuna hitilafu'),
              style: TextStyle(
                color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
                fontSize: 15,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadProduct,
              icon: const Icon(Icons.refresh),
              label: Text(t('Retry', 'Jaribu tena')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductDetails() {
    final product = _product!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppTheme.primary,
                  AppTheme.primary.withOpacity(0.85),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withOpacity(0.25),
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
                            product.categoryName ??
                                t('No Category', 'Hakuna Kategoria'),
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
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: isDark
                ? AppTheme.darkCardDecoration(radius: 12)
                : AppTheme.cardDecoration(radius: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('Change Status', 'Badilisha Hali'),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _canChangeStatus
                        ? (isDark ? Colors.white : AppTheme.primary)
                        : (isDark
                        ? AppTheme.darkTextSecondary
                        : AppTheme.greyText),
                  ),
                ),
                if (!_canChangeStatus)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      t(
                        'No permission to change status',
                        'Huna ruhusa ya kubadilisha hali',
                      ),
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark
                            ? AppTheme.darkTextSecondary
                            : AppTheme.greyText,
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildStatusButton('active', AppTheme.success),
                    _buildStatusButton('inactive', AppTheme.greyText),
                    _buildStatusButton('sold', AppTheme.accent),
                    _buildStatusButton('returned', AppTheme.warning),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: isDark
                ? AppTheme.darkCardDecoration(radius: 12)
                : AppTheme.cardDecoration(radius: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t('Product Information', 'Taarifa za Bidhaa'),
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : AppTheme.primary,
                  ),
                ),
                const Divider(height: 20),
                _buildDetailRow(
                  t('Category', 'Kategoria'),
                  product.categoryName ?? t('Not set', 'Haijawekwa'),
                  icon: Icons.category,
                ),
                _buildDetailRow(
                  t('Shop', 'Duka'),
                  product.shopName ?? t('Not assigned', 'Haijapewa'),
                  icon: Icons.store,
                ),
                _buildDetailRow(
                  t('Buying Price', 'Bei ya Kununua'),
                  product.buyingPrice != null
                      ? 'TSh ${product.buyingPrice!.toStringAsFixed(2)}'
                      : t('Not set', 'Haijawekwa'),
                  icon: Icons.shopping_cart,
                ),
                _buildDetailRow(
                  t('Cash Selling Price', 'Bei ya Kuuzia Taslimu'),
                  product.cashSellingPrice != null
                      ? 'TSh ${product.cashSellingPrice!.toStringAsFixed(2)}'
                      : t('Not set', 'Haijawekwa'),
                  icon: Icons.attach_money,
                ),
                _buildDetailRow(
                  t('Stock Status', 'Hali ya Hifadhi'),
                  product.stockStatus.toUpperCase(),
                  icon: Icons.inventory_2,
                  valueColor: _getStockStatusColor(product.stockStatus),
                ),
                _buildDetailRow(
                  t('Created At', 'Imeundwa'),
                  _formatDate(product.createdAt),
                  icon: Icons.calendar_today,
                ),
                if (product.updatedAt != null)
                  _buildDetailRow(
                    t('Last Updated', 'Ilisasishwa'),
                    _formatDate(product.updatedAt!),
                    icon: Icons.update,
                  ),
                if (product.loanSellingPrice != null &&
                    product.loanSellingPrice!.isNotEmpty) ...[
                  const Divider(height: 20),
                  Text(
                    t('Loan Prices by Company', 'Bei za Mikopo kwa Kampuni'),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : AppTheme.primary,
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
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _canEdit ? _toggleEdit : null,
                  icon: Icon(
                    Icons.edit_outlined,
                    size: 18,
                    color: _canEdit
                        ? null
                        : (isDark
                        ? AppTheme.darkTextSecondary
                        : AppTheme.greyText),
                  ),
                  label: Text(
                    t('Edit', 'Hariri'),
                    style: TextStyle(
                      color: _canEdit
                          ? null
                          : (isDark
                          ? AppTheme.darkTextSecondary
                          : AppTheme.greyText),
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
                    color: _canDelete
                        ? AppTheme.error
                        : (isDark
                        ? AppTheme.darkTextSecondary
                        : AppTheme.greyText),
                  ),
                  label: Text(
                    t('Delete', 'Futa'),
                    style: TextStyle(
                      color: _canDelete
                          ? AppTheme.error
                          : (isDark
                          ? AppTheme.darkTextSecondary
                          : AppTheme.greyText),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: _canDelete
                          ? AppTheme.error
                          : (isDark
                          ? AppTheme.darkBorder
                          : AppTheme.borderLight),
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
              decoration: InputDecoration(
                labelText: 'IMEI *',
                hintText: t('Enter IMEI number', 'Weka nambari ya IMEI'),
                prefixIcon: const Icon(Icons.qr_code),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return t('Please enter IMEI', 'Tafadhali weka IMEI');
                }
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
              decoration: InputDecoration(
                labelText: t('Category *', 'Kategoria *'),
                prefixIcon: const Icon(Icons.category),
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
              validator: (v) => (v == null || v.isEmpty)
                  ? t('Select category', 'Chagua kategoria')
                  : null,
            ),
            const SizedBox(height: 14),
            _isLoadingDropdowns
                ? const SizedBox.shrink()
                : _skuOptions.isEmpty
                ? TextFormField(
              controller: _skuController,
              decoration: InputDecoration(
                labelText: 'SKU *',
                hintText: t('Enter SKU', 'Weka SKU'),
                prefixIcon: const Icon(Icons.inventory),
              ),
              onChanged: (v) => _selectedSku = v,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return t('Please enter SKU', 'Tafadhali weka SKU');
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
              validator: (v) => (v == null || v.isEmpty)
                  ? t('Select SKU', 'Chagua SKU')
                  : null,
            ),
            const SizedBox(height: 14),
            _isLoadingDropdowns
                ? const SizedBox.shrink()
                : DropdownButtonFormField<String>(
              value: _selectedShopId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: t('Shop (Optional)', 'Duka (Si lazima)'),
                prefixIcon: const Icon(Icons.store),
              ),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(t('None', 'Hakuna')),
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
              decoration: InputDecoration(
                labelText: t('Buying Price *', 'Bei ya Kununua *'),
                prefixText: 'TSh ',
                prefixIcon: const Icon(Icons.shopping_cart),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return t('Required', 'Inahitajika');
                }
                if (double.tryParse(value) == null) {
                  return t('Invalid number', 'Nambari si sahihi');
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _cashSellingPriceController,
              keyboardType:
              const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText:
                t('Cash Selling Price', 'Bei ya Kuuzia Taslimu'),
                prefixText: 'TSh ',
                prefixIcon: const Icon(Icons.attach_money),
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _selectedStatus,
              decoration: InputDecoration(
                labelText: t('Status', 'Hali'),
                prefixIcon: const Icon(Icons.toggle_on),
              ),
              items: [
                DropdownMenuItem(
                    value: 'active', child: Text(t('Active', 'Hai'))),
                DropdownMenuItem(
                    value: 'inactive',
                    child: Text(t('Inactive', 'Haifanyi kazi'))),
                DropdownMenuItem(
                    value: 'sold', child: Text(t('Sold', 'Imeuzwa'))),
                DropdownMenuItem(
                    value: 'returned',
                    child: Text(t('Returned', 'Imerudishwa'))),
              ],
              onChanged: (v) => setState(() => _selectedStatus = v),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSaving ? null : _toggleEdit,
                    child: Text(t('Cancel', 'Ghairi')),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isSaving ? null : _saveProduct,
                    child: _isSaving
                        ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                        : Text(
                      t('Save Changes', 'Hifadhi Mabadiliko'),
                      style: const TextStyle(fontWeight: FontWeight.w600),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 18,
              color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(
                color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                color: valueColor ??
                    (isDark ? Colors.white : AppTheme.primary),
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
          Icon(
            Icons.business,
            size: 16,
            color: Theme.of(context).brightness == Brightness.dark
                ? AppTheme.darkTextSecondary
                : AppTheme.greyText,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${t('Company', 'Kampuni')}: ${loan.companyId}',
              style: const TextStyle(fontSize: 13),
            ),
          ),
          Text(
            'TSh ${loan.price.toStringAsFixed(2)}',
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: AppTheme.secondary,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return OutlinedButton(
      onPressed: enabled ? () => _changeStatus(status) : null,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        backgroundColor:
        isSelected && enabled ? color.withOpacity(0.12) : Colors.transparent,
        side: BorderSide(
          color: !enabled
              ? (isDark ? AppTheme.darkBorder : AppTheme.borderLight)
              : (isSelected
              ? color
              : (isDark ? AppTheme.darkBorder : AppTheme.borderLight)),
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
              ? (isDark ? AppTheme.darkTextSecondary : AppTheme.greyText)
              : (isSelected
              ? color
              : (isDark ? AppTheme.darkTextSecondary : AppTheme.greyText)),
          fontWeight:
          isSelected && enabled ? FontWeight.w600 : FontWeight.w400,
          fontSize: 11,
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'active':
        return AppTheme.success;
      case 'inactive':
        return AppTheme.greyText;
      case 'sold':
        return AppTheme.accent;
      case 'returned':
        return AppTheme.warning;
      default:
        return AppTheme.greyText;
    }
  }

  Color _getStockStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'in_stock':
        return AppTheme.success;
      case 'out_of_stock':
        return AppTheme.error;
      case 'low_stock':
        return AppTheme.warning;
      default:
        return AppTheme.greyText;
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} '
        '${date.hour.toString().padLeft(2, '0')}:'
        '${date.minute.toString().padLeft(2, '0')}';
  }
}