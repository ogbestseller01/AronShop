import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final SharedPreferences _prefs;
  late final ApiService _api = ApiService(this);

  User? _user;
  String? _token;

  // Only reflects the initial app bootstrap (reading prefs + /me call).
  // Do NOT toggle this during login()/logout() — if a parent widget
  // switches screens based on this flag, doing so would tear down
  // LoginScreen's local state (including its error message) mid-call.
  bool _isLoading = true;
  bool _isAuthenticated = false;

  AuthService(this._prefs) {
    _initAuth();
  }

  User? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;

  Future<void> _initAuth() async {
    _token = _prefs.getString('auth_token');
    _isAuthenticated = _token != null && _token!.isNotEmpty;

    final userJson = _prefs.getString('user_data');
    if (userJson != null && userJson.isNotEmpty) {
      try {
        final data = Map<String, dynamic>.from(jsonDecode(userJson) as Map);
        _user = User.fromJson(data);
      } catch (e) {
        debugPrint('Error loading user data: $e');
      }
    }

    if (_isAuthenticated) {
      await fetchUserInternal();
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> fetchUserInternal() async {
    try {
      final response = await _api.getMe();
      if (response.success && response.user != null) {
        _user = response.user;
        _saveUserData(_user!);
        notifyListeners();
      } else {
        await clearSessionLocally();
      }
    } catch (e) {
      debugPrint('Error fetching user: $e');
    }
  }

  void _saveAuthData(String token, User user) {
    _token = token;
    _user = user;
    _isAuthenticated = true;
    _prefs.setString('auth_token', token);
    _saveUserData(user);
  }

  void _saveUserData(User user) {
    _prefs.setString('user_data', jsonEncode(user.toJson()));
  }

  /// Returns `null` on success, or a user-friendly error message on failure.
  /// Deliberately does NOT touch the global `isLoading` flag — the caller
  /// (LoginScreen) tracks its own local loading state for the button spinner.
  /// This guarantees the screen stays mounted and the error message survives.
  Future<String?> login(String email, String password) async {
    try {
      final response = await _api.login(email, password);

      if (response.success &&
          response.token != null &&
          response.user != null) {
        _saveAuthData(response.token!, response.user!);
        notifyListeners(); // now safe to flip screens — login succeeded
        return null;
      }

      final msg = (response.message ?? '').trim();
      if (msg.isEmpty) return 'Invalid email or password';

      final lower = msg.toLowerCase();
      if (lower.contains('invalid') || lower.contains('credential')) {
        return 'Invalid email or password';
      }
      if (lower.contains('not active') || lower.contains('inactive')) {
        return 'Your account is not active. Contact administrator.';
      }
      return msg;
    } catch (e) {
      final err = e.toString().toLowerCase();
      if (err.contains('socket') ||
          err.contains('connection') ||
          err.contains('network') ||
          err.contains('timed out') ||
          err.contains('timeout') ||
          err.contains('failed host lookup') ||
          err.contains('connection refused')) {
        return 'Network error. Please check your internet connection.';
      }
      return 'Something went wrong. Please try again.';
    }
  }

  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (e) {
      debugPrint('Logout error: $e');
    } finally {
      await clearSessionLocally();
    }
  }

  Future<void> clearSessionLocally() async {
    _token = null;
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
    await _prefs.remove('auth_token');
    await _prefs.remove('user_data');
  }
}