import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../models/category.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
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
      Fluttertoast.showToast(
        msg: 'Failed to load data: $e',
        backgroundColor: Colors.red,
        textColor: Colors.white,
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
      Fluttertoast.showToast(msg: 'Please enter an identifier');
      return;
    }
    if (_identifiers.contains(value)) {
      Fluttertoast.showToast(msg: 'Identifier already exists');
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
      Fluttertoast.showToast(
        msg: 'Added ${results.length} identifier(s)',
        backgroundColor: Colors.green,
        textColor: Colors.white,
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
      Fluttertoast.showToast(
        msg: 'Please add at least one identifier',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    if (!_isAdminOrManager && _selectedShopId == null) {
      Fluttertoast.showToast(
        msg: 'Please select a shop',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    if (_selectedCategoryId == null || _selectedCategoryId!.isEmpty) {
      Fluttertoast.showToast(
        msg: 'Please select a category',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    if (_selectedSku == null || _selectedSku!.isEmpty) {
      Fluttertoast.showToast(
        msg: 'Please select a SKU',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
      );
      return;
    }

    final buyingPrice = double.tryParse(_buyingPriceController.text.trim());
    if (buyingPrice == null || buyingPrice < 0) {
      Fluttertoast.showToast(
        msg: 'Please enter a valid buying price',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
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

      Fluttertoast.showToast(
        msg: '${created.length} product(s) created for SKU "$_selectedSku"',
        backgroundColor: Colors.green,
        textColor: Colors.white,
      );

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

      Fluttertoast.showToast(
        msg: errorMsg,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        toastLength: Toast.LENGTH_LONG,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _section({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
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
                  color: AppConfig.primaryColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF374151),
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
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixText: prefixText,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide:
        const BorderSide(color: AppConfig.primaryColor, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.red),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final isNarrow = media.size.width < 380;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: widget.isEmbedded
          ? null
          : AppBar(
        title: const Text('Add Product'),
        backgroundColor: AppConfig.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
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
                    title: 'Basic Information',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DropdownButtonFormField<String>(
                          value: _selectedShopId,
                          isExpanded: true,
                          decoration: _inputDecoration(
                            label:
                            _isShopRequired ? 'Shop *' : 'Shop',
                          ),
                          items: [
                            if (!_isShopRequired && !_isShopDisabled)
                              const DropdownMenuItem<String>(
                                value: null,
                                child: Text('Select shop'),
                              ),
                            ..._shopOptions.map((shop) {
                              final id =
                              shop['shop_id']?.toString();
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
                              return 'Please select a shop';
                            }
                            return null;
                          },
                        ),
                        if (_isShopDisabled)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              'Auto-selected from your assigned shop.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.green,
                              ),
                            ),
                          ),
                        if (_isShopRequired)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              'You manage multiple shops – please select one.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.orange,
                              ),
                            ),
                          ),
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          value: _selectedCategoryId,
                          isExpanded: true,
                          decoration: _inputDecoration(
                            label: 'Category *',
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
                          validator: (v) =>
                          (v == null || v.isEmpty)
                              ? 'Please select a category'
                              : null,
                        ),
                      ],
                    ),
                  ),

                  // SKU
                  _section(
                    title: 'SKU',
                    child: _selectedCategoryId == null
                        ? const Text(
                      'Please select a category first',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.orange,
                      ),
                    )
                        : _skuOptions.isEmpty
                        ? const Text(
                      'No SKUs for this category',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.orange,
                      ),
                    )
                        : DropdownButtonFormField<String>(
                      value: _selectedSku,
                      isExpanded: true,
                      decoration: _inputDecoration(
                        label: 'Select SKU *',
                      ),
                      items: _skuOptions.map((s) {
                        return DropdownMenuItem(
                          value: s,
                          child: Text(
                            s,
                            overflow:
                            TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (v) => setState(
                              () => _selectedSku = v),
                      validator: (v) =>
                      (v == null || v.isEmpty)
                          ? 'Please select a SKU'
                          : null,
                    ),
                  ),

                  // PRICING
                  _section(
                    title: 'Pricing',
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        if (constraints.maxWidth < 320) {
                          return Column(
                            children: [
                              TextFormField(
                                controller: _buyingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(
                                    decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label: 'Buying Price *',
                                  prefixText: 'TSh ',
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty) {
                                    return 'Required';
                                  }
                                  if (double.tryParse(v) == null) {
                                    return 'Invalid';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller:
                                _cashSellingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(
                                    decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label: 'Cash Selling Price',
                                  prefixText: 'TSh ',
                                ),
                              ),
                            ],
                          );
                        }
                        return Row(
                          crossAxisAlignment:
                          CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _buyingPriceController,
                                keyboardType: const TextInputType
                                    .numberWithOptions(
                                    decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label: 'Buying Price *',
                                  prefixText: 'TSh ',
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty) {
                                    return 'Required';
                                  }
                                  if (double.tryParse(v) == null) {
                                    return 'Invalid';
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
                                    .numberWithOptions(
                                    decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'[\d.]')),
                                ],
                                decoration: _inputDecoration(
                                  label: 'Cash Selling Price',
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
                    title: 'Identifier List',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (isNarrow) ...[
                          TextFormField(
                            controller: _identifierController,
                            decoration: _inputDecoration(
                              hint:
                              'Enter identifier (IMEI, serial, etc.)',
                            ),
                            onFieldSubmitted: (_) =>
                                _addIdentifier(),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: _addIdentifier,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor:
                                    AppConfig.primaryColor,
                                    foregroundColor: Colors.white,
                                    padding:
                                    const EdgeInsets.symmetric(
                                        vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                      BorderRadius.circular(10),
                                    ),
                                  ),
                                  child: const Text('Add'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _openScanner,
                                  icon: const Icon(
                                    Icons.qr_code_scanner,
                                    size: 18,
                                  ),
                                  label: const Text('Scan'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blue,
                                    foregroundColor: Colors.white,
                                    padding:
                                    const EdgeInsets.symmetric(
                                        vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                      BorderRadius.circular(10),
                                    ),
                                  ),
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
                                    hint:
                                    'Enter identifier (IMEI, serial, etc.)',
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
                                    backgroundColor:
                                    AppConfig.primaryColor,
                                    foregroundColor: Colors.white,
                                    padding:
                                    const EdgeInsets.symmetric(
                                        horizontal: 16),
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                      BorderRadius.circular(10),
                                    ),
                                  ),
                                  child: const Text('Add'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              SizedBox(
                                height: 48,
                                child: ElevatedButton.icon(
                                  onPressed: _openScanner,
                                  icon: const Icon(
                                    Icons.qr_code_scanner,
                                    size: 18,
                                  ),
                                  label: const Text('Scan'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blue,
                                    foregroundColor: Colors.white,
                                    padding:
                                    const EdgeInsets.symmetric(
                                        horizontal: 12),
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                      BorderRadius.circular(10),
                                    ),
                                  ),
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
                                '${_identifiers.length} identifier(s)',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: _clearAllIdentifiers,
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                  MaterialTapTargetSize
                                      .shrinkWrap,
                                ),
                                child: const Text(
                                  'Clear All',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ...List.generate(_identifiers.length,
                                  (i) {
                                return Container(
                                  margin:
                                  const EdgeInsets.only(bottom: 6),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius:
                                    BorderRadius.circular(8),
                                    border: Border.all(
                                      color: Colors.grey.shade200,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Text(
                                        '${i + 1}.',
                                        style: TextStyle(
                                          color: Colors.grey.shade500,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _identifiers[i],
                                          style: const TextStyle(
                                            fontFamily: 'monospace',
                                            fontSize: 14,
                                          ),
                                          overflow:
                                          TextOverflow.ellipsis,
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(
                                          Icons.delete_outline,
                                          size: 20,
                                          color: Colors.red,
                                        ),
                                        onPressed: () =>
                                            _removeIdentifier(i),
                                        padding: EdgeInsets.zero,
                                        constraints:
                                        const BoxConstraints(
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
                          onPressed:
                          _isLoading ? null : _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor:
                            AppConfig.primaryColor,
                            foregroundColor: Colors.white,
                            minimumSize:
                            const Size.fromHeight(50),
                            shape: RoundedRectangleBorder(
                              borderRadius:
                              BorderRadius.circular(10),
                            ),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                            height: 22,
                            width: 22,
                            child:
                            CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                              : const Text(
                            'Create',
                            style: TextStyle(
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
                            onPressed: () =>
                                Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              minimumSize:
                              const Size.fromHeight(50),
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                BorderRadius.circular(10),
                              ),
                            ),
                            child: const Text('Cancel'),
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