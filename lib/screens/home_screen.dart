import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_theme.dart';
import '../l10n/app_strings.dart';
import '../main.dart';
import '../services/auth_service.dart';
import 'add_product_screen.dart';
import 'product_list_screen.dart';
import 'scanner_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    ProductListScreen(),
    ScannerScreen(isTab: true),
    AddProductScreen(isEmbedded: true),
  ];

  @override
  Widget build(BuildContext context) {
    // Watch the controller to rebuild UI when theme or language changes
    final themeCtrl = context.watch<ThemeController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isSw = themeCtrl.isSw;

    final titles = [
      AppLang.products(context),
      AppLang.scanBarcode(context),
      AppLang.addProduct(context),
    ];

    return Scaffold(
      appBar: _currentIndex == 1
          ? null // Hide AppBar on Scanner tab (if it has its own UI)
          : AppBar(
        title: Text(
          titles[_currentIndex],
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          // --- THEME TOGGLE ---
          IconButton(
            tooltip: AppLang.t(context, 'Theme', 'Mandhari'),
            onPressed: () => themeCtrl.toggleTheme(),
            icon: Icon(
              isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
              color: Colors.white, // Ensure visibility on AppBar
            ),
          ),

          // --- LANGUAGE DROPDOWN ---
          PopupMenuButton<String>(
            tooltip: AppLang.t(context, 'Language', 'Lugha'),
            offset: const Offset(0, 40),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            onSelected: (code) => themeCtrl.setLocale(code),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'en',
                child: Row(
                  children: [
                    const Text('🇬🇧', style: TextStyle(fontSize: 18)),
                    const SizedBox(width: 10),
                    const Text('English'),
                    if (!isSw) ...[
                      const Spacer(),
                      const Icon(Icons.check, size: 18, color: AppTheme.primary),
                    ],
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'sw',
                child: Row(
                  children: [
                    const Text('🇹🇿', style: TextStyle(fontSize: 18)),
                    const SizedBox(width: 10),
                    const Text('Kiswahili'),
                    if (isSw) ...[
                      const Spacer(),
                      const Icon(Icons.check, size: 18, color: AppTheme.primary),
                    ],
                  ],
                ),
              ),
            ],
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: Colors.white.withOpacity(0.3),
                ),
                color: Colors.white.withOpacity(0.1),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    isSw ? '🇹🇿' : '🇬🇧',
                    style: const TextStyle(fontSize: 14),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isSw ? 'SW' : 'EN',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.arrow_drop_down,
                    size: 18,
                    color: Colors.white,
                  ),
                ],
              ),
            ),
          ),

          // --- PROFILE ---
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: _showProfileDialog,
          ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: KeyedSubtree(
          key: ValueKey(_currentIndex),
          child: _screens[_currentIndex],
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.3 : 0.08),
              blurRadius: 8,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          items: [
            BottomNavigationBarItem(
              icon: const Icon(Icons.inventory_2_outlined),
              activeIcon: const Icon(Icons.inventory_2),
              label: AppLang.products(context),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.qr_code_scanner_outlined),
              activeIcon: const Icon(Icons.qr_code_scanner),
              label: AppLang.scan(context),
            ),
            BottomNavigationBarItem(
              icon: const Icon(Icons.add_box_outlined),
              activeIcon: const Icon(Icons.add_box),
              label: AppLang.add(context),
            ),
          ],
        ),
      ),
    );
  }

  void _showProfileDialog() {
    final auth = context.read<AuthService>();
    final user = auth.user;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(AppLang.userAccount(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.person, color: AppTheme.primary),
              title: Text(
                user?.name ?? AppLang.t(context, 'User', 'Mtumiaji'),
              ),
              subtitle: Text(AppLang.name(context)),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.email, color: AppTheme.primary),
              title: Text(user?.email ?? 'N/A'),
              subtitle: Text(AppLang.email(context)),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.badge, color: AppTheme.primary),
              title: Text(user?.status?.toUpperCase() ?? 'ACTIVE'),
              subtitle: Text(AppLang.status(context)),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.work, color: AppTheme.primary),
              title: Text(user?.role?.toUpperCase() ?? 'USER'),
              subtitle: Text(AppLang.role(context)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppLang.close(context)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await auth.logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
            ),
            child: Text(AppLang.logout(context)),
          ),
        ],
      ),
    );
  }
}