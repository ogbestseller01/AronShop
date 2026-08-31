class User {
  final String id;
  final String name;
  final String email;
  final String? status;
  final int? roleId;
  final String? role; // role name (ADMINISTRATOR / MANAGER / etc.)

  User({
    required this.id,
    required this.name,
    required this.email,
    this.status,
    this.roleId,
    this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    // Role name comes through under different keys depending on the
    // endpoint: nested {role: {name/display_name}} from eager-loaded
    // relations, or a flat 'category' string from getLoggedUserProfile.
    // Login itself sends none of these — only a numeric role_id — so role
    // name may legitimately be null right after login until /me is fetched.
    String? roleName;
    final roleField = json['role'];
    if (roleField is Map) {
      roleName = roleField['name']?.toString() ??
          roleField['display_name']?.toString() ??
          roleField['category']?.toString();
    } else if (roleField != null) {
      roleName = roleField.toString();
    } else {
      roleName = json['role_name']?.toString() ??
          json['category']?.toString() ??
          json['role_category']?.toString();
    }

    final rawRoleId = json['role_id'];
    final roleId = rawRoleId is int
        ? rawRoleId
        : int.tryParse(rawRoleId?.toString() ?? '');

    return User(
      // Backend's primary key is `user_id`, not `id`.
      id: (json['user_id'] ?? json['id'])?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      status: json['status']?.toString(),
      roleId: roleId,
      role: roleName,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': id,
      'name': name,
      'email': email,
      'status': status,
      'role_id': roleId,
      'role': role,
    };
  }

  bool get isAdminOrManager {
    final r = role?.toUpperCase() ?? '';
    return r == 'ADMINISTRATOR' || r == 'MANAGER' || r == 'ADMIN';
  }
}

class AuthResponse {
  final bool success;
  final String? token;
  final User? user;
  final String? message;

  AuthResponse({
    required this.success,
    this.token,
    this.user,
    this.message,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    // AuthController::login returns a FLAT payload on success:
    //   { "user": {...}, "token": "...", "role_id": 2 }
    // — no `success`/`status` field and no `data` envelope. A `data`
    // wrapper is still supported here in case some other endpoint uses
    // one, but the backend you're actually calling never sends `success`
    // or `status`, so relying on those made every successful login look
    // like a failure. The only reliable signal is: did a token come back.
    final data = json['data'];
    final dataMap = data is Map ? Map<String, dynamic>.from(data) : null;

    final token = (dataMap?['token'] ?? json['token'])?.toString();

    final userJson = dataMap?['user'] ?? json['user'];
    final user = userJson is Map
        ? User.fromJson(Map<String, dynamic>.from(userJson))
        : null;

    return AuthResponse(
      success: token != null && token.isNotEmpty,
      token: token,
      user: user,
      message: json['message']?.toString(),
    );
  }
}