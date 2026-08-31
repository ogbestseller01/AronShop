import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_config.dart';
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

  // Simple permission helpers (same idea as web)
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
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Products Inventory'),
        centerTitle: true,
        backgroundColor: AppConfig.primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _onRefresh,
          ),
        ],
      ),
      floatingActionButton: _canCreate
          ? FloatingActionButton(
        onPressed: _navigateToAddProduct,
        backgroundColor: AppConfig.primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      )
          : null,
      body: Column(
        children: [
          // Search + Filter
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by IMEI or SKU...',
                      prefixIcon: const Icon(Icons.search, size: 22),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                        icon: const Icon(Icons.clear, size: 20),
                        onPressed: () => _searchController.clear(),
                      )
                          : null,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String>(
                  icon: Icon(Icons.filter_list, color: Colors.grey.shade700),
                  onSelected: (value) {
                    setState(() {
                      _selectedStatus = value == 'all' ? null : value;
                    });
                    _onRefresh();
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'all',
                      child: Text('All Products'),
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

          // List
          Expanded(
            child: _isLoading && _products.isEmpty
                ? const LoadingWidget()
                : _error != null
                ? _buildErrorWidget()
                : _products.isEmpty
                ? _buildEmptyWidget()
                : RefreshIndicator(
              onRefresh: () async => _onRefresh(),
              color: AppConfig.primaryColor,
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
              style: TextStyle(color: Colors.grey.shade600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _onRefresh,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConfig.primaryColor,
                foregroundColor: Colors.white,
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inventory_2_outlined,
            size: 64,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            'No products found',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _searchController.text.isNotEmpty
                ? 'Try a different search term'
                : 'Add your first product',
            style: TextStyle(color: Colors.grey.shade500),
          ),
          if (_canCreate) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _navigateToAddProduct,
              icon: const Icon(Icons.add),
              label: const Text('Add Product'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppConfig.primaryColor,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ],
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
}