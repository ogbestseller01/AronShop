import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'config/app_config.dart';
import 'config/app_theme.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(MyApp(prefs: prefs));
}

class ThemeController extends ChangeNotifier {
  ThemeController(this._prefs) {
    _isDark = _prefs.getBool('is_dark') ?? false;
    _langCode = _prefs.getString('locale') ?? 'en';
  }

  final SharedPreferences _prefs;
  bool _isDark = false;
  String _langCode = 'en';

  bool get isDark => _isDark;
  String get langCode => _langCode;
  bool get isSw => _langCode == 'sw';

  /// Kept for compatibility; do NOT pass this to MaterialApp.locale when 'sw'.
  Locale get locale => Locale(_langCode);

  Future<void> toggleTheme() async {
    _isDark = !_isDark;
    await _prefs.setBool('is_dark', _isDark);
    notifyListeners();
  }

  Future<void> setLocale(String code) async {
    _langCode = code;
    await _prefs.setString('locale', code);
    notifyListeners();
  }
}

class MyApp extends StatelessWidget {
  final SharedPreferences prefs;

  const MyApp({super.key, required this.prefs});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<SharedPreferences>.value(value: prefs),
        ChangeNotifierProvider(create: (_) => AuthService(prefs)),
        ChangeNotifierProvider(create: (_) => ThemeController(prefs)),
        ProxyProvider<AuthService, ApiService>(
          update: (_, auth, __) => ApiService(auth),
        ),
      ],
      child: Consumer<ThemeController>(
        builder: (context, themeCtrl, _) {
          return MaterialApp(
            title: AppConfig.appName,
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeCtrl.isDark ? ThemeMode.dark : ThemeMode.light,

            // Always English for Material (TextField, buttons, etc.)
            locale: const Locale('en'),
            supportedLocales: const [Locale('en')],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],

            home: const SplashScreen(),
            routes: {
              '/gate': (_) => const AuthGateScreen(),
              '/home': (_) => const HomeScreen(),
              '/login': (_) => const LoginScreen(),
            },
          );
        },
      ),
    );
  }
}

class AuthGateScreen extends StatelessWidget {
  const AuthGateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (auth.isLoading) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (auth.isAuthenticated) return const HomeScreen();
    return const LoginScreen();
  }
}