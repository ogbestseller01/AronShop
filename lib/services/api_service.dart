import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../models/auth.dart';
import '../models/category.dart';
import '../models/product.dart';
import 'auth_service.dart';

class ApiService {
  final AuthService _authService;
  late final Dio _dio;

  ApiService(this._authService) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // NOTE: accepting all certs (including invalid/self-signed) is fine for
    // local dev but is a security risk in production. Consider restricting
    // this to debug builds only (kDebugMode) before shipping.
    (_dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
      final client = HttpClient();
      client.badCertificateCallback =
          (X509Certificate cert, String host, int port) => true;
      return client;
    };

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = _authService.token;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // Only clear session on 401 for authenticated routes (NOT login)
        final path = error.requestOptions.path;
        final isLogin = path.contains('auth/login');
        if (error.response?.statusCode == 401 && !isLogin) {
          await _authService.clearSessionLocally();
        }
        return handler.next(error);
      },
    ));
  }

  /// Maps a failed-login response to a consistent, user-friendly message.
  /// Known status codes get fixed wording (so the UI never shows raw
  /// backend text for these); anything unexpected falls back to whatever
  /// message the backend sent, if any.
  String _messageForResponse(Response response) {
    final data = response.data;

    switch (response.statusCode) {
      case 401:
        return 'Invalid email or password';

      case 403:
        return 'Your account is not active. Contact administrator.';

      case 422:
      // Validation error — surface the first field-level error if present.
        if (data is Map && data['errors'] is Map) {
          final errors = Map<String, dynamic>.from(data['errors'] as Map);
          final firstError = errors.values.isNotEmpty
              ? errors.values.first
              : null;
          if (firstError is List && firstError.isNotEmpty) {
            return firstError.first.toString();
          }
        }
        if (data is Map && data['message'] != null) {
          return data['message'].toString();
        }
        return 'Please check your input and try again.';

      case 429:
        final retryAfter = response.headers.value('retry-after');
        final seconds = int.tryParse(retryAfter ?? '');
        if (seconds != null && seconds > 0) {
          return 'Too many attempts. Please try again in $seconds seconds.';
        }
        return 'Too many attempts. Please wait a moment and try again.';

      default:
        if (data is Map && data['message'] != null) {
          return data['message'].toString();
        }
        return 'Login failed';
    }
  }

  // ==================== AUTH ====================
  Future<AuthResponse> login(String email, String password) async {
    try {
      final response = await _dio.post(
        AppConfig.loginEndpoint,
        data: {'email': email, 'password': password},
      );
      return AuthResponse.fromJson(response.data);
    } on DioException catch (e) {
      String message = 'Login failed';

      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        message = 'Connection timed out. Please try again.';
      } else if (e.type == DioExceptionType.connectionError) {
        message = 'Network error. Please check your internet connection.';
      } else if (e.response != null) {
        message = _messageForResponse(e.response!);
      }

      return AuthResponse(success: false, message: message);
    } catch (_) {
      return AuthResponse(
        success: false,
        message: 'Something went wrong. Please try again.',
      );
    }
  }

  Future<AuthResponse> getMe() async {
    try {
      final response = await _dio.get(AppConfig.meEndpoint);
      return AuthResponse.fromJson(response.data);
    } on DioException catch (e) {
      return AuthResponse(
        success: false,
        message: e.response?.data?['message'] ?? 'Failed to get user data',
      );
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post(AppConfig.logoutEndpoint);
    } on DioException catch (e) {
      debugPrint('Logout error: ${e.message}');
    }
  }

  // ==================== PRODUCTS ====================
  Future<PaginatedProducts> getProducts({
    String? search,
    String? categoryId,
    String? shopId,
    String? status,
    int page = 1,
    int perPage = 15,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'per_page': perPage,
        if (search != null && search.isNotEmpty) 'search': search,
        if (categoryId != null && categoryId.isNotEmpty)
          'category_id': categoryId,
        if (shopId != null && shopId.isNotEmpty) 'shop_id': shopId,
        if (status != null && status.isNotEmpty) 'status': status,
      };

      final response = await _dio.get(
        AppConfig.productsEndpoint,
        queryParameters: queryParams,
      );

      final raw = response.data['data'] ?? response.data;
      return PaginatedProducts.fromJson(
        raw is Map<String, dynamic> ? raw : <String, dynamic>{},
      );
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to fetch products',
      );
    }
  }

  Future<Product> getProduct(String id) async {
    try {
      final response = await _dio.get('${AppConfig.productsEndpoint}/$id');
      final data = response.data['data'] ?? response.data;
      return Product.fromJson(Map<String, dynamic>.from(data));
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to fetch product',
      );
    }
  }

  Future<List<Product>> createProduct(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(
        AppConfig.productsEndpoint,
        data: data,
      );

      final raw = response.data['data'] ?? response.data;

      if (raw is List) {
        return raw
            .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      if (raw is Map) {
        return [Product.fromJson(Map<String, dynamic>.from(raw))];
      }
      return [];
    } on DioException catch (e) {
      final message =
          e.response?.data?['message'] ?? 'Failed to create product';
      final errors = e.response?.data?['errors'];
      if (errors != null) {
        throw Exception('$message: ${jsonEncode(errors)}');
      }
      throw Exception(message);
    }
  }

  Future<Product> updateProduct(String id, Map<String, dynamic> data) async {
    try {
      final response = await _dio.put(
        '${AppConfig.productsEndpoint}/$id',
        data: data,
      );
      final productData = response.data['data'] ?? response.data;
      return Product.fromJson(Map<String, dynamic>.from(productData));
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to update product',
      );
    }
  }

  Future<void> deleteProduct(String id) async {
    try {
      await _dio.delete('${AppConfig.productsEndpoint}/$id');
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to delete product',
      );
    }
  }

  Future<Product> restoreProduct(String id) async {
    try {
      final response =
      await _dio.patch('${AppConfig.productsEndpoint}/$id/restore');
      final data = response.data['data'] ?? response.data;
      return Product.fromJson(Map<String, dynamic>.from(data));
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to restore product',
      );
    }
  }

  Future<void> forceDeleteProduct(String id) async {
    try {
      await _dio.delete('${AppConfig.productsEndpoint}/$id/force');
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to permanently delete product',
      );
    }
  }

  Future<void> changeProductStatus(String id, String status) async {
    try {
      await _dio.patch(
        '${AppConfig.productsEndpoint}/$id/status',
        data: {'status': status},
      );
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to change status',
      );
    }
  }

  // ==================== CATEGORIES ====================
  Future<List<CategoryDropdown>> getCategoryDropdown() async {
    try {
      final response = await _dio.get(AppConfig.categoriesEndpoint);
      final data = response.data['data'] ?? [];
      return (data as List)
          .map((e) => CategoryDropdown.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to fetch categories',
      );
    }
  }

  // ==================== SHOPS ====================
  Future<List<Map<String, dynamic>>> getShopDropdown() async {
    try {
      final response = await _dio.get(AppConfig.shopsDropdownEndpoint);
      final data = response.data['data'] ?? [];
      return (data as List).map((e) => Map<String, dynamic>.from(e)).toList();
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to fetch shops',
      );
    }
  }

  Future<List<Map<String, dynamic>>> getShops({int perPage = 1000}) async {
    try {
      final response = await _dio.get(
        AppConfig.shopsIndexEndpoint,
        queryParameters: {'per_page': perPage},
      );

      final raw = response.data['data'];
      List list;
      if (raw is Map && raw['data'] is List) {
        list = raw['data'];
      } else if (raw is List) {
        list = raw;
      } else {
        list = [];
      }

      return list.map((e) {
        final m = Map<String, dynamic>.from(e);
        m['shop_id'] = m['shop_id'] ?? m['id'];
        m['name'] =
            m['name'] ?? m['shop_name'] ?? m['label'] ?? 'Unknown Shop';
        m['location'] = m['location'] ?? '';
        m['manager_id'] = m['manager_id']?.toString();
        return m;
      }).toList();
    } on DioException catch (e) {
      throw Exception(
        e.response?.data?['message'] ?? 'Failed to fetch shops',
      );
    }
  }
}