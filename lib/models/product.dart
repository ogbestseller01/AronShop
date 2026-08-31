import 'dart:convert';

class Product {
  final String id;
  final String categoryId;
  final String? categoryName;
  final String sku;
  final String imei;
  final String? shopId;
  final String? shopName;
  final double? buyingPrice;
  final double? cashSellingPrice;
  final List<LoanPrice>? loanSellingPrice;
  final String status;
  final String stockStatus;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Product({
    required this.id,
    required this.categoryId,
    this.categoryName,
    required this.sku,
    required this.imei,
    this.shopId,
    this.shopName,
    this.buyingPrice,
    this.cashSellingPrice,
    this.loanSellingPrice,
    required this.status,
    required this.stockStatus,
    required this.createdAt,
    this.updatedAt,
  });

  /// Safe number parser – handles both num and String from API
  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static int _toInt(dynamic value, {int fallback = 0}) {
    if (value == null) return fallback;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    // Handle loan prices safely
    List<LoanPrice>? loans;
    final rawLoan = json['loan_selling_price'];
    if (rawLoan != null) {
      if (rawLoan is List) {
        loans = rawLoan
            .map((e) => LoanPrice.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      } else if (rawLoan is String && rawLoan.isNotEmpty) {
        try {
          final decoded = jsonDecode(rawLoan) as List;
          loans = decoded
              .map((e) => LoanPrice.fromJson(Map<String, dynamic>.from(e)))
              .toList();
        } catch (_) {
          loans = null;
        }
      }
    }

    return Product(
      id: json['product_id']?.toString() ?? json['id']?.toString() ?? '',
      categoryId: json['category_id']?.toString() ?? '',
      categoryName: json['category']?['category_name'] ??
          json['category_name']?.toString(),
      sku: json['sku']?.toString() ?? '',
      imei: json['imei']?.toString() ?? '',
      shopId: json['shop_id']?.toString() ??
          json['shop']?['shop_id']?.toString(),
      shopName: json['shop']?['name']?.toString() ??
          json['shop']?['shop_name']?.toString(),
      buyingPrice: _toDouble(json['buying_price']),
      cashSellingPrice: _toDouble(json['cash_selling_price']),
      loanSellingPrice: loans,
      status: json['status']?.toString() ?? 'active',
      stockStatus: json['stock_status']?.toString() ?? 'in_stock',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': id,
      'category_id': categoryId,
      'sku': sku,
      'imei': imei,
      'shop_id': shopId,
      'buying_price': buyingPrice,
      'cash_selling_price': cashSellingPrice,
      'loan_selling_price': loanSellingPrice?.map((e) => e.toJson()).toList(),
      'status': status,
      'stock_status': stockStatus,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  Product copyWith({
    String? id,
    String? categoryId,
    String? categoryName,
    String? sku,
    String? imei,
    String? shopId,
    String? shopName,
    double? buyingPrice,
    double? cashSellingPrice,
    List<LoanPrice>? loanSellingPrice,
    String? status,
    String? stockStatus,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Product(
      id: id ?? this.id,
      categoryId: categoryId ?? this.categoryId,
      categoryName: categoryName ?? this.categoryName,
      sku: sku ?? this.sku,
      imei: imei ?? this.imei,
      shopId: shopId ?? this.shopId,
      shopName: shopName ?? this.shopName,
      buyingPrice: buyingPrice ?? this.buyingPrice,
      cashSellingPrice: cashSellingPrice ?? this.cashSellingPrice,
      loanSellingPrice: loanSellingPrice ?? this.loanSellingPrice,
      status: status ?? this.status,
      stockStatus: stockStatus ?? this.stockStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class LoanPrice {
  final String companyId;
  final double price;

  LoanPrice({
    required this.companyId,
    required this.price,
  });

  factory LoanPrice.fromJson(Map<String, dynamic> json) {
    return LoanPrice(
      companyId: json['company_id']?.toString() ?? '',
      price: Product._toDouble(json['price']) ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'company_id': companyId,
      'price': price,
    };
  }
}

class PaginatedProducts {
  final List<Product> data;
  final int currentPage;
  final int lastPage;
  final int total;

  PaginatedProducts({
    required this.data,
    required this.currentPage,
    required this.lastPage,
    required this.total,
  });

  factory PaginatedProducts.fromJson(Map<String, dynamic> json) {
    final dataList = json['data'] as List? ?? [];
    return PaginatedProducts(
      data: dataList
          .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      currentPage: Product._toInt(json['current_page'], fallback: 1),
      lastPage: Product._toInt(json['last_page'], fallback: 1),
      total: Product._toInt(json['total'], fallback: 0),
    );
  }
}