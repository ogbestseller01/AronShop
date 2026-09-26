import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../config/app_theme.dart';
import '../l10n/app_strings.dart';
import '../models/category.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../utils/dialog_helper.dart';
import 'scanner_screen.dart';

class AddProductScreen extends StatefulWidget {
  final String? initialImei;
  final bool isEmbedded;

  const AddProductScreen({
    super.key,
    this.initialImei,
    this.isEmbedded = false,
  });

  @override
  State<AddProductScreen> createState() => _AddProductScreenState();
}

class _AddProductScreenState extends State<AddProductScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _buyingPriceController = TextEditingController();
  final _cashSellingPriceController = TextEditingController();
  final _scrollController = ScrollController();

  String? _selectedCategoryId;
  String? _selectedShopId;
  String? _selectedStatus = 'active';
  String? _selectedSku;

  bool _isLoading = false;
  bool _isLoadingData = true;

  final List<String> _identifiers = [];
  List<CategoryDropdown> _categories = [];
  List<Map<String, dynamic>> _allShops = [];
  List<Map<String, dynamic>> _userShops = [];
  List<String> _skuOptions = [];

  bool get _isAdminOrManager {
    final user = context.read<AuthService>().user;
    return user?.isAdminOrManager ?? false;
  }

  bool get _isShopDisabled => !_isAdminOrManager && _userShops.length == 1;
  bool get _isShopRequired => !_isAdminOrManager && _userShops.length > 1;

  List<Map<String, dynamic>> get _shopOptions {
    if (_isAdminOrManager) return _allShops;
    return _userShops;
  }

  @override
  void initState() {
    super.initState();
    if (widget.initialImei != null && widget.initialImei!.isNotEmpty) {
      _identifiers.add(widget.initialImei!);
    }
    _loadData();
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _buyingPriceController.dispose();
    _cashSellingPriceController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoadingData = true);
    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);
      final user = authService.user;

      final results = await Future.wait([
        api.getCategoryDropdown(),
        api.getShops(perPage: 1000),
      ]);

      if (!mounted) return;

      final categories = results[0] as List<CategoryDropdown>;
      final allShops = results[1] as List<Map<String, dynamic>>;

      List<Map<String, dynamic>> userManaged = [];
      if (user != null) {
        userManaged = allShops
            .where((s) => s['manager_id']?.toString() == user.id)
            .toList();
      }

      String? initialShopId;
      if (!_isAdminOrManager && userManaged.length == 1) {
        initialShopId = userManaged.first['shop_id']?.toString();
      }

      setState(() {
        _categories = categories;
        _allShops = allShops;
        _userShops = userManaged;
        _selectedShopId = initialShopId;
        _isLoadingData = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoadingData = false);
      DialogHelper.showErrorDialog(
        context,
        title: AppLang.error(context),
        message:
        '${AppLang.t(context, 'Failed to load data', 'Imeshindwa kupakia taarifa')}: $e',
      );
    }
  }

  void _onCategoryChanged(String? categoryId) {
    setState(() {
      _selectedCategoryId = categoryId;
      _selectedSku = null;
      final cat = _categories.firstWhere(
            (c) => c.value == categoryId,
        orElse: () => CategoryDropdown(value: '', label: ''),
      );
      _skuOptions = cat.skus ?? [];
      // Auto-select if only one SKU
      if (_skuOptions.length == 1) {
        _selectedSku = _skuOptions.first;
      }
    });
  }

  void _addIdentifier() {
    final value = _identifierController.text.trim();
    if (value.isEmpty) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.t(
          context,
          'Please enter an identifier',
          'Tafadhali weka kitambulisho',
        ),
      );
      return;
    }
    if (_identifiers.contains(value)) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.t(
          context,
          'Identifier already exists',
          'Kitambulisho tayari kipo',
        ),
      );
      return;
    }
    setState(() {
      _identifiers.add(value);
      _identifierController.clear();
    });
  }

  Future<void> _openScanner() async {
    final results = await Navigator.push<List<String>>(
      context,
      MaterialPageRoute(
        builder: (_) => ScannerScreen(
          existingImeis: List.from(_identifiers),
          isBatchMode: true,
        ),
      ),
    );

    if (results != null && results.isNotEmpty) {
      setState(() {
        for (final code in results) {
          if (!_identifiers.contains(code)) {
            _identifiers.add(code);
          }
        }
      });
      if (!mounted) return;
      DialogHelper.showSuccessDialog(
        context,
        title: AppLang.success(context),
        message: AppLang.t(
          context,
          'Added ${results.length} identifier(s)',
          'Vitambulisho ${results.length} vimeongezwa',
        ),
      );
    }
  }

  void _removeIdentifier(int index) {
    setState(() => _identifiers.removeAt(index));
  }

  void _clearAllIdentifiers() {
    setState(() => _identifiers.clear());
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_identifiers.isEmpty) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.t(
          context,
          'Please add at least one identifier',
          'Tafadhali ongeza kitambulisho kimoja',
        ),
      );
      return;
    }

    if (!_isAdminOrManager && _selectedShopId == null) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.selectShop(context),
      );
      return;
    }

    if (_selectedCategoryId == null || _selectedCategoryId!.isEmpty) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.selectCategory(context),
      );
      return;
    }

    if (_selectedSku == null || _selectedSku!.isEmpty) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.t(
          context,
          'Please select a SKU',
          'Tafadhali chagua SKU',
        ),
      );
      return;
    }

    final buyingPrice = double.tryParse(_buyingPriceController.text.trim());
    if (buyingPrice == null || buyingPrice < 0) {
      DialogHelper.showWarningDialog(
        context,
        title: AppLang.notice(context),
        message: AppLang.t(
          context,
          'Please enter a valid buying price',
          'Tafadhali weka bei sahihi ya kununua',
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);

      final data = <String, dynamic>{
        'shop_id': _selectedShopId,
        'category_id': _selectedCategoryId,
        'sku': _selectedSku,
        'imeis': _identifiers.join(','),
        'buying_price': buyingPrice,
        'cash_selling_price':
        double.tryParse(_cashSellingPriceController.text.trim()),
        'status': _selectedStatus ?? 'active',
      };

      data.removeWhere((k, v) => v == null);

      final created = await api.createProduct(data);

      if (!mounted) return;

      final createdSku = _selectedSku;

      DialogHelper.showSuccessDialog(
        context,
        title: AppLang.success(context),
        message: AppLang.t(
          context,
          '${created.length} product(s) created for SKU "$createdSku"',
          'Bidhaa ${created.length} zimeundwa kwa SKU "$createdSku"',
        ),
        onConfirm: () {
          if (!mounted) return;
          if (Navigator.canPop(context)) {
            Navigator.pop(context, true);
          } else {
            setState(() {
              _identifiers.clear();
              _buyingPriceController.clear();
              _cashSellingPriceController.clear();
              _selectedSku = null;
              _selectedCategoryId = null;
              _skuOptions = [];
              if (!_isShopDisabled) _selectedShopId = null;
            });
          }
        },
      );
    } catch (e) {
      if (!mounted) return;

      String errorMsg = e.toString().replaceFirst('Exception: ', '');

      if (errorMsg.contains('{')) {
        final start = errorMsg.indexOf('{');
        final end = errorMsg.lastIndexOf('}');
        if (start != -1 && end != -1) {
          try {
            final errorJson = errorMsg.substring(start, end + 1);
            final errors = jsonDecode(errorJson) as Map<String, dynamic>;
            errorMsg = errors.values
                .expand((list) => (list as List).map((e) => e.toString()))
                .join('\n');
          } catch (_) {}
        }
      }

      DialogHelper.showErrorDialog(
        context,
        title: AppLang.error(context),
        message: errorMsg,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _section({required String title, required Widget child}) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withOpacity(0.35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 16,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({
    String? label,
    String? hint,
    String? prefixText,
  }) {
    // Relies on the app-wide InputDecorationTheme (AppTheme) for
    // border/fill/focus styling instead of overriding it here.
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixText: prefixText,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final media = MediaQuery.of(context);
    final isNarrow = media.size.width < 380;

    return Scaffold(
      appBar: widget.isEmbedded
          ? null
          : AppBar(
        title: Text(AppLang.addProduct(context)),
      ),
      body: _isLoadingData
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
        child: GestureDetector(
          onTap: () => FocusScope.of(context).unfocus(),
          child: SingleChildScrollView(
            controller: _scrollController,
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              media.viewInsets.bottom + 24,
            ),
            keyboardDismissBehavior:
            ScrollViewKeyboardDismissBehavior.onDrag,
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // BASIC INFORMATION
                  _section(
                    title: AppLang.basicInfo(context),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DropdownButtonFormField<String>(
                          value: _selectedShopId,
                          isExpanded: true,
                          decoration: _inputDecoration(
                            label: _isShopRequired
                                ? AppLang.shopRequired(context)
                                : AppLang.shop(context),
                          ),
                          items: [
                            if (!_isShopRequired && !_isShopDisabled)
                              DropdownMenuItem<String>(
                                value: null,
                                child: Text(AppLang.selectShop(context)),
                              ),
                            ..._shopOptions.map((shop) {
                              final id = shop['shop_id']?.toString();
                              final name = shop['name'] ?? 'Shop';
                              final loc = shop['location'] ?? '';
                              return DropdownMenuItem<String>(
                                value: id,
                                child: Text(
                                  loc.isNotEmpty
                                      ? '$name — $loc'
                                      : name,
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              );
                            }),
                          ],
                          onChanged: _isShopDisabled
                              ? null
                              : (v) => setState(
                                  () => _selectedShopId = v),
                          validator: (v) {
                            if (_isShopRequired &&
                                (v == null || v.isEmpty)) {
                              return AppLang.selectShop(context);
                            }
                            return null;
                          },
                        ),
                        if (_isShopDisabled)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              AppLang.autoSelectedShop(context),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppTheme.success,
                              ),
                            ),
                          ),
                        if (_isShopRequired)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              AppLang.multiShopHint(context),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppTheme.warning,
                              ),
                            ),
                          ),
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          value: _selectedCategoryId,
                          isExpanded: true,
                          decoration: _inputDecoration(
                            label: AppLang.category(context),
                          ),
                          items: _categories.map((c) {
                            return DropdownMenuItem(
                              value: c.value,
                              child: Text(
                                c.label,
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            );
                          }).toList(),
                          onChanged: _onCategoryChanged,
                          validator: (v) => (v == null || v.isEmpty)
                              ? AppLang.selectCategory(context)
                              : null,
                        ),
                      ],
                    ),
                  ),

                  // SKU
                  _section(
                    title: AppLang.sku(context),
                    child: _selectedCategoryId == null
                        ? Text(
                      AppLang.selectCategoryFirst(context),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppTheme.warning,
                      ),
                    )
                        : _skuOptions.isEmpty
                        ? Text(
                      AppLang.noSkus(context),
                      style:
                      theme.textTheme.bodyMedium?.copyWith(
                        color: AppTheme.warning,
                      ),
                    )
                        : DropdownButtonFormField<String>(
                      value: _selectedSku,
                      isExpanded: true,
                      decoration: _inputDecoration(
                        label: AppLang.selectSku(context),
                      ),
                      items: _skuOptions.map((s) {
                        return DropdownMenuItem(
                          value: s,
                          child: Text(
                            s,
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (v) =>
                          setState(() => _selectedSku = v),
                      validator: (v) =>
                      (v == null || v.isEmpty)
                          ? AppLang.selectSku(context)
                          : null,
                    ),
                  ),

                  // PRICING
                  _section(
                    title: AppLang.pricing(context),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        if (constraints.maxWidth < 320) {
                          return Column(
                            children: [
                              TextFormField(
                                controller: _buyingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label: AppLang.buyingPrice(context),
                                  prefixText: 'TSh ',
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty) {
                                    return AppLang.t(
                                        context, 'Required', 'Inahitajika');
                                  }
                                  if (double.tryParse(v) == null) {
                                    return AppLang.t(
                                        context, 'Invalid', 'Si sahihi');
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller:
                                _cashSellingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label:
                                  AppLang.cashSellingPrice(context),
                                  prefixText: 'TSh ',
                                ),
                              ),
                            ],
                          );
                        }
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _buyingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label: AppLang.buyingPrice(context),
                                  prefixText: 'TSh ',
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty) {
                                    return AppLang.t(
                                        context, 'Required', 'Inahitajika');
                                  }
                                  if (double.tryParse(v) == null) {
                                    return AppLang.t(
                                        context, 'Invalid', 'Si sahihi');
                                  }
                                  return null;
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller:
                                _cashSellingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label:
                                  AppLang.cashSellingPrice(context),
                                  prefixText: 'TSh ',
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),

                  // IDENTIFIER LIST
                  _section(
                    title: AppLang.identifierList(context),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (isNarrow) ...[
                          TextFormField(
                            controller: _identifierController,
                            decoration: _inputDecoration(
                              hint: AppLang.enterIdentifier(context),
                            ),
                            onFieldSubmitted: (_) => _addIdentifier(),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: _addIdentifier,
                                  child:
                                  Text(AppLang.addLabel(context)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _openScanner,
                                  icon: const Icon(
                                    Icons.qr_code_scanner,
                                    size: 18,
                                  ),
                                  label:
                                  Text(AppLang.scan(context)),
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
                          Row(
                            crossAxisAlignment:
                            CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _identifierController,
                                  decoration: _inputDecoration(
                                    hint: AppLang.enterIdentifier(
                                        context),
                                  ),
                                  onFieldSubmitted: (_) =>
                                      _addIdentifier(),
                                ),
                              ),
                              const SizedBox(width: 8),
                              SizedBox(
                                height: 48,
                                child: ElevatedButton(
                                  onPressed: _addIdentifier,
                                  style: ElevatedButton.styleFrom(
                                    // Overrides the app-wide
                                    // full-width (Size.fromHeight)
                                    // button default: a Row child
                                    // gets unbounded max width, so
                                    // an infinite minimumSize here
                                    // crashes layout.
                                    minimumSize: const Size(64, 48),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                    ),
                                  ),
                                  child:
                                  Text(AppLang.addLabel(context)),
                                ),
                              ),
                              const SizedBox(width: 8),
                              SizedBox(
                                height: 48,
                                child: OutlinedButton.icon(
                                  onPressed: _openScanner,
                                  style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(64, 48),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                    ),
                                  ),
                                  icon: const Icon(
                                    Icons.qr_code_scanner,
                                    size: 18,
                                  ),
                                  label:
                                  Text(AppLang.scan(context)),
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (_identifiers.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Text(
                                AppLang.identifiersCount(
                                    context, _identifiers.length),
                                style:
                                theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurface
                                      .withOpacity(0.6),
                                ),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: _clearAllIdentifiers,
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                                  foregroundColor: theme.colorScheme.error,
                                ),
                                child: Text(AppLang.clearAll(context)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...List.generate(_identifiers.length, (i) {
                            return Container(
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.surface,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: theme.colorScheme.outlineVariant,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    '${i + 1}.',
                                    style: theme.textTheme.bodySmall
                                        ?.copyWith(
                                      color: theme.colorScheme.onSurface
                                          .withOpacity(0.5),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _identifiers[i],
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                        fontFamily: 'monospace',
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  IconButton(
                                    icon: Icon(
                                      Icons.delete_outline,
                                      size: 20,
                                      color: theme.colorScheme.error,
                                    ),
                                    onPressed: () =>
                                        _removeIdentifier(i),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(
                                      minWidth: 32,
                                      minHeight: 32,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 8),

                  // CREATE / CANCEL
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                          ),
                          child: _isLoading
                              ? SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              color: theme.colorScheme.onPrimary,
                              strokeWidth: 2,
                            ),
                          )
                              : Text(
                            AppLang.create(context),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      if (!widget.isEmbedded) ...[
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(50),
                            ),
                            child: Text(AppLang.cancel(context)),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}