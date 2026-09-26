import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_theme.dart';
import '../l10n/app_strings.dart';
import '../main.dart';
import '../services/auth_service.dart';
import '../utils/dialog_helper.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() => _errorMessage = null);
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    final error = await context.read<AuthService>().login(
      _emailController.text.trim(),
      _passwordController.text,
    );
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _errorMessage = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final themeCtrl = context.watch<ThemeController>();
    final size = MediaQuery.of(context).size;
    final isSw = themeCtrl.isSw;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Theme + Language dropdown
                Align(
                  alignment: Alignment.centerRight,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: AppLang.t(context, 'Theme', 'Mandhari'),
                        onPressed: () => themeCtrl.toggleTheme(),
                        icon: Icon(
                          isDark
                              ? Icons.light_mode_outlined
                              : Icons.dark_mode_outlined,
                          color: AppTheme.primary,
                        ),
                      ),
                      const SizedBox(width: 4),
                      // Language dropdown
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
                                  const Icon(Icons.check,
                                      size: 18, color: AppTheme.primary),
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
                                  const Icon(Icons.check,
                                      size: 18, color: AppTheme.primary),
                                ],
                              ],
                            ),
                          ),
                        ],
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: AppTheme.primary.withOpacity(0.4),
                            ),
                            color: AppTheme.primary.withOpacity(0.08),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isSw ? '🇹🇿' : '🇬🇧',
                                style: const TextStyle(fontSize: 16),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isSw ? 'SW' : 'EN',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.primary,
                                ),
                              ),
                              const SizedBox(width: 2),
                              const Icon(
                                Icons.arrow_drop_down,
                                size: 18,
                                color: AppTheme.primary,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),

                // Login image
                Center(
                  child: Image.asset(
                    'assets/images/app_img.png',
                    height: size.height * 0.26,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Icon(
                      Icons.inventory_2,
                      size: 96,
                      color: AppTheme.primary.withOpacity(0.45),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                Text(
                  AppLang.t(context, 'Welcome Back', 'Karibu Tena'),
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  AppLang.t(
                    context,
                    'Sign in to manage your products',
                    'Ingia kudhibiti bidhaa zako',
                  ),
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: isDark
                        ? AppTheme.darkTextSecondary
                        : AppTheme.greyText,
                  ),
                ),
                const SizedBox(height: 20),

                if (_errorMessage != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.error.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: AppTheme.error.withOpacity(0.35),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: AppTheme.error,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: AppTheme.error,
                              fontSize: 14,
                              height: 1.35,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _errorMessage = null),
                          child: Icon(
                            Icons.close,
                            size: 18,
                            color: AppTheme.error.withOpacity(0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) {
                    if (_errorMessage != null) {
                      setState(() => _errorMessage = null);
                    }
                  },
                  decoration: InputDecoration(
                    labelText: AppLang.email(context),
                    prefixIcon: const Icon(Icons.email_outlined),
                    hintText: AppLang.t(
                      context,
                      'Enter your email',
                      'Weka barua pepe yako',
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return AppLang.t(
                        context,
                        'Please enter your email',
                        'Tafadhali weka barua pepe',
                      );
                    }
                    if (!RegExp(r'^[\w\-\.]+@([\w\-]+\.)+[\w\-]{2,4}$')
                        .hasMatch(v)) {
                      return AppLang.t(
                        context,
                        'Please enter a valid email',
                        'Weka barua pepe sahihi',
                      );
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _handleLogin(),
                  onChanged: (_) {
                    if (_errorMessage != null) {
                      setState(() => _errorMessage = null);
                    }
                  },
                  decoration: InputDecoration(
                    labelText: AppLang.t(context, 'Password', 'Nenosiri'),
                    prefixIcon: const Icon(Icons.lock_outline),
                    hintText: AppLang.t(
                      context,
                      'Enter your password',
                      'Weka nenosiri lako',
                    ),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                      ),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return AppLang.t(
                        context,
                        'Please enter your password',
                        'Tafadhali weka nenosiri',
                      );
                    }
                    if (v.length < 8) {
                      return AppLang.t(
                        context,
                        'Password must be at least 8 characters',
                        'Nenosiri liwe angalau herufi 8',
                      );
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),

                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      DialogHelper.showInfoDialog(
                        context,
                        title: AppLang.t(
                          context,
                          'Forgot Password',
                          'Umesahau Nenosiri',
                        ),
                        message: AppLang.t(
                          context,
                          'Forgot password is coming soon.',
                          'Umesahau nenosiri inakuja hivi karibuni.',
                        ),
                      );
                    },
                    child: Text(
                      AppLang.t(
                        context,
                        'Forgot Password?',
                        'Umesahau Nenosiri?',
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    child: _isLoading
                        ? const SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                        : Text(
                      AppLang.t(context, 'Sign In', 'Ingia'),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                Center(
                  child: Text(
                    'Product Scanner v0.0.1',
                    style: TextStyle(
                      color: isDark
                          ? AppTheme.darkTextSecondary
                          : AppTheme.greyText,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}