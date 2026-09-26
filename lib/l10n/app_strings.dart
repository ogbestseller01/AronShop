import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../main.dart';

/// App language (en / sw). Material widgets stay on English.
class AppLang {
  AppLang._();

  static bool isSw(BuildContext context) {
    return context.watch<ThemeController>().isSw;
  }

  static String t(BuildContext context, String en, String sw) {
    return context.read<ThemeController>().isSw ? sw : en;
  }

  // --- Common ---
  static String ok(BuildContext c) => t(c, 'OK', 'Sawa');
  static String cancel(BuildContext c) => t(c, 'Cancel', 'Ghairi');
  static String save(BuildContext c) => t(c, 'Save', 'Hifadhi');
  static String delete(BuildContext c) => t(c, 'Delete', 'Futa');
  static String edit(BuildContext c) => t(c, 'Edit', 'Hariri');
  static String retry(BuildContext c) => t(c, 'Retry', 'Jaribu tena');
  static String close(BuildContext c) => t(c, 'Close', 'Funga');
  static String logout(BuildContext c) => t(c, 'Logout', 'Toka');
  static String error(BuildContext c) => t(c, 'Error', 'Hitilafu');
  static String success(BuildContext c) => t(c, 'Success', 'Imefanikiwa');
  static String notice(BuildContext c) => t(c, 'Notice', 'Taarifa');

  // --- Nav / Home ---
  static String products(BuildContext c) => t(c, 'Products', 'Bidhaa');
  static String scan(BuildContext c) => t(c, 'Scan', 'Changanua');
  static String add(BuildContext c) => t(c, 'Add', 'Ongeza');
  static String scanBarcode(BuildContext c) =>
      t(c, 'Scan Barcode', 'Changanua Msimbo');
  static String addProduct(BuildContext c) =>
      t(c, 'Add Product', 'Ongeza Bidhaa');
  static String userAccount(BuildContext c) =>
      t(c, 'User Account', 'Akaunti ya Mtumiaji');
  static String name(BuildContext c) => t(c, 'Name', 'Jina');
  static String email(BuildContext c) => t(c, 'Email', 'Barua pepe');
  static String status(BuildContext c) => t(c, 'Status', 'Hali');
  static String role(BuildContext c) => t(c, 'Role', 'Wadhifa');

  // --- Product list ---
  static String searchHint(BuildContext c) =>
      t(c, 'Search by IMEI or SKU...', 'Tafuta kwa IMEI au SKU...');
  static String allProducts(BuildContext c) =>
      t(c, 'All Products', 'Bidhaa Zote');
  static String noProducts(BuildContext c) =>
      t(c, 'No products found', 'Hakuna bidhaa');
  static String tryDifferentSearch(BuildContext c) =>
      t(c, 'Try a different search term', 'Jaribu neno lingine');
  static String addFirstProduct(BuildContext c) =>
      t(c, 'Add your first product', 'Ongeza bidhaa yako ya kwanza');

  // --- Add product ---
  static String basicInfo(BuildContext c) =>
      t(c, 'Basic Information', 'Taarifa za Msingi');
  static String shop(BuildContext c) => t(c, 'Shop', 'Duka');
  static String shopRequired(BuildContext c) => t(c, 'Shop *', 'Duka *');
  static String selectShop(BuildContext c) =>
      t(c, 'Select shop', 'Chagua duka');
  static String category(BuildContext c) => t(c, 'Category *', 'Kategoria *');
  static String selectCategory(BuildContext c) =>
      t(c, 'Please select a category', 'Tafadhali chagua kategoria');
  static String sku(BuildContext c) => t(c, 'SKU', 'SKU');
  static String selectSku(BuildContext c) =>
      t(c, 'Select SKU *', 'Chagua SKU *');
  static String selectCategoryFirst(BuildContext c) =>
      t(c, 'Please select a category first', 'Chagua kategoria kwanza');
  static String noSkus(BuildContext c) =>
      t(c, 'No SKUs for this category', 'Hakuna SKU kwa kategoria hii');
  static String pricing(BuildContext c) => t(c, 'Pricing', 'Bei');
  static String buyingPrice(BuildContext c) =>
      t(c, 'Buying Price *', 'Bei ya Kununua *');
  static String cashSellingPrice(BuildContext c) =>
      t(c, 'Cash Selling Price', 'Bei ya Kuuzia Taslimu');
  static String identifierList(BuildContext c) =>
      t(c, 'Identifier List', 'Orodha ya Vitambulisho');
  static String enterIdentifier(BuildContext c) => t(
    c,
    'Enter identifier (IMEI, serial, etc.)',
    'Weka kitambulisho (IMEI, serial, n.k.)',
  );
  static String addLabel(BuildContext c) => t(c, 'Add', 'Ongeza');
  static String clearAll(BuildContext c) => t(c, 'Clear All', 'Futa Zote');
  static String create(BuildContext c) => t(c, 'Create', 'Unda');
  static String identifiersCount(BuildContext c, int n) =>
      t(c, '$n identifier(s)', 'Vitambulisho $n');
  static String autoSelectedShop(BuildContext c) => t(
    c,
    'Auto-selected from your assigned shop.',
    'Imechaguliwa kiotomatiki kutoka duka lako.',
  );
  static String multiShopHint(BuildContext c) => t(
    c,
    'You manage multiple shops – please select one.',
    'Unasimamia maduka mengi – tafadhali chagua moja.',
  );

  // --- Scanner ---
  static String scanIdentifiers(BuildContext c) =>
      t(c, 'Scan Identifiers', 'Changanua Vitambulisho');
  static String scanProduct(BuildContext c) =>
      t(c, 'Scan Product', 'Changanua Bidhaa');
  static String alignBarcode(BuildContext c) => t(
    c,
    'Align barcode inside the rectangle',
    'Weka msimbo ndani ya mstatili',
  );
  static String confirmCode(BuildContext c) =>
      t(c, 'Confirm this code', 'Thibitisha msimbo huu');
  static String detected(BuildContext c) => t(c, 'Detected', 'Imegunduliwa');
  static String skip(BuildContext c) => t(c, 'Skip', 'Ruka');
  static String done(BuildContext c, int n) =>
      t(c, 'Done ($n)', 'Maliza ($n)');
  static String addedCount(BuildContext c, int n) =>
      t(c, '$n added', '$n zimeongezwa');
  static String clear(BuildContext c) => t(c, 'Clear', 'Futa');

  // --- Detail ---
  static String productDetails(BuildContext c) =>
      t(c, 'Product Details', 'Maelezo ya Bidhaa');
  static String editProduct(BuildContext c) =>
      t(c, 'Edit Product', 'Hariri Bidhaa');
  static String changeStatus(BuildContext c) =>
      t(c, 'Change Status', 'Badilisha Hali');
  static String productInfo(BuildContext c) =>
      t(c, 'Product Information', 'Taarifa za Bidhaa');
  static String saveChanges(BuildContext c) =>
      t(c, 'Save Changes', 'Hifadhi Mabadiliko');
  static String deleteProduct(BuildContext c) =>
      t(c, 'Delete Product', 'Futa Bidhaa');
  static String deleteConfirm(BuildContext c) => t(
    c,
    'Are you sure you want to delete this product? This action can be undone.',
    'Una uhakika unataka kufuta bidhaa hii? Kitendo hiki kinaweza kutenduliwa.',
  );
}