class AppConfig {
  static const String appName = 'Product Scanner';
  static const String baseUrl = 'https://aronshop.ogonegroup.co.tz/api';

  static const String loginEndpoint = '/v1/auth/login';
  static const String meEndpoint = '/v1/auth/me';
  static const String logoutEndpoint = '/v1/auth/logout';
  static const String productsEndpoint = '/v3/products';
  static const String categoriesEndpoint = '/v2/product-categories/dropdown';
  static const String shopsDropdownEndpoint = '/v5/shops/dropdown';
  static const String shopsIndexEndpoint = '/v5/shops';
}