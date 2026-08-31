import 'package:flutter/material.dart';

class AppConfig {
  static const String appName = 'Product Scanner';
  static const String baseUrl = 'https://aronshop.ogonegroup.co.tz/api';
  static const Color primaryColor = Color(0xFFF97316);
  static const Color secondaryColor = Color(0xFF3B82F6);
  static const Color successColor = Color(0xFF22C55E);
  static const Color dangerColor = Color(0xFFEF4444);
  static const Color warningColor = Color(0xFFF59E0B);

  static const String loginEndpoint = '/v1/auth/login';
  static const String meEndpoint = '/v1/auth/me';
  static const String logoutEndpoint = '/v1/auth/logout';
  static const String productsEndpoint = '/v3/products';
  static const String categoriesEndpoint = '/v2/product-categories/dropdown';
  static const String shopsDropdownEndpoint = '/v5/shops/dropdown';
  static const String shopsIndexEndpoint = '/v5/shops'; // needed for manager_id
}