import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_theme.dart';
import '../main.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../widgets/loading_widget.dart';
import '../widgets/product_card.dart';
import 'add_product_screen.dart';
import 'product_detail_screen.dart';

class ProductListScreen extends StatefulWidget {
  const ProductListScreen({super.key});

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Product> _products = [];
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;
  bool _hasMore = true;
  bool _isLoadingMore = false;
  String? _selectedStatus;

  final List<String> _statusOptions = [
    'all',
    'active',
    'inactive',
    'sold',
    'returned',
  ];

  String t(String en, String sw) {
    return context.read<ThemeController>().isSw ? sw : en;
  }

  bool get _canCreate {
    final user = context.read<AuthService>().user;
    final role = user?.role?.toUpperCase() ?? '';
    return role == 'ADMINISTRATOR' ||
        role == 'MANAGER' ||
        role == 'STOCK_CONTROLLER' ||
        role == 'BRANCH_OWNER' ||
        role == 'ADMIN';
  }

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _currentPage = 1;
    _products = [];
    _loadProducts();
  }

  Future<void> _loadProducts({bool loadMore = false}) async {
    if (loadMore) {
      if (_isLoadingMore || !_hasMore) return;
      setState(() => _isLoadingMore = true);
    } else {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }

    try {
      final authService = context.read<AuthService>();
      final api = ApiService(authService);

      final searchQuery = _searchController.text.trim();
      final status = (_selectedStatus == null || _selectedStatus == 'all')
          ? null
          : _selectedStatus;

      final result = await api.getProducts(
        search: searchQuery.isEmpty ? null : searchQuery,
        status: status,
        page: _currentPage,
      );

      if (!mounted) return;

      setState(() {
        if (_currentPage == 1) {
          _products = result.data;
        } else {
          _products.addAll(result.data);
        }
        _totalPages = result.lastPage;
        _hasMore = _currentPage < _totalPages;
        _isLoading = false;
        _isLoadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  void _onRefresh() {
    _currentPage = 1;
    _products = [];
    _loadProducts();
  }

  void _loadMore() {
    if (_hasMore && !_isLoadingMore) {
      _currentPage++;
      _loadProducts(loadMore: true);
    }
  }

  Future<void> _navigateToAddProduct() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const AddProductScreen()),
    );
    if (result == true) _onRefresh();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<ThemeController>(); // rebuild on language change
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      floatingActionButton: _canCreate
          ? FloatingActionButton(
        onPressed: _navigateToAddProduct,
        child: const Icon(Icons.add),
      )
          : null,
      body: Column(
        children: [
          Container(
            color: isDark ? AppTheme.darkSurface : Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: t(
                        'Search by IMEI or SKU...',
                        'Tafuta kwa IMEI au SKU...',
                      ),
                      prefixIcon: const Icon(Icons.search, size: 22),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: () => _searchController.clear(),
                      )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String>(
                  icon: Icon(
                    Icons.filter_list,
                    color: isDark
                        ? AppTheme.darkTextSecondary
                        : AppTheme.greyText,
                  ),
                  onSelected: (value) {
                    setState(() {
                      _selectedStatus = value == 'all' ? null : value;
                    });
                    _onRefresh();
                  },
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: 'all',
                      child: Text(t('All Products', 'Bidhaa Zote')),
                    ),
                    ..._statusOptions.where((s) => s != 'all').map(
                          (status) => PopupMenuItem(
                        value: status,
                        child: Text(
                          status.toUpperCase(),
                          style: TextStyle(
                            color: _getStatusColor(status),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading && _products.isEmpty
                ? const LoadingWidget()
                : _error != null
                ? _buildErrorWidget()
                : _products.isEmpty
                ? _buildEmptyWidget()
                : RefreshIndicator(
              onRefresh: () async => _onRefresh(),
              color: AppTheme.primary,
              child: NotificationListener<ScrollNotification>(
                onNotification: (scroll) {
                  if (scroll.metrics.pixels >=
                      scroll.metrics.maxScrollExtent - 200) {
                    _loadMore();
                  }
                  return false;
                },
                child: ListView.builder(
                  padding: const EdgeInsets.only(
                    top: 8,
                    bottom: 80,
                  ),
                  itemCount:
                  _products.length + (_hasMore ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == _products.length) {
                      return const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }

                    final product = _products[index];
                    return ProductCard(
                      product: product,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ProductDetailScreen(
                              productId: product.id,
                            ),
                          ),
                        ).then((_) => _onRefresh());
                      },
                    );
                  },
                ),
              ),
            ),
          ),
        ],
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
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _onRefresh,
              child: Text(t('Retry', 'Jaribu tena')),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inventory_2_outlined,
            size: 64,
            color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
          ),
          const SizedBox(height: 16),
          Text(
            t('No products found', 'Hakuna bidhaa'),
            style: TextStyle(
              fontSize: 18,
              color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _searchController.text.isNotEmpty
                ? t('Try a different search term', 'Jaribu neno lingine')
                : t('Add your first product', 'Ongeza bidhaa yako ya kwanza'),
            style: TextStyle(
              color: isDark ? AppTheme.darkTextSecondary : AppTheme.greyText,
            ),
          ),
          if (_canCreate) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _navigateToAddProduct,
              icon: const Icon(Icons.add),
              label: Text(t('Add Product', 'Ongeza Bidhaa')),
            ),
          ],
        ],
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
}