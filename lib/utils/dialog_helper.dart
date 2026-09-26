import 'package:flutter/material.dart';

import '../config/app_theme.dart';

class DialogHelper {
  static Future<void> showInfoDialog(
      BuildContext context, {
        required String title,
        required String message,
        String buttonText = 'OK',
        VoidCallback? onPressed,
      }) {
    return showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onPressed?.call();
            },
            child: Text(buttonText),
          ),
        ],
      ),
    );
  }

  static Future<void> showErrorDialog(
      BuildContext context, {
        String title = 'Error',
        required String message,
      }) {
    return showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.error_outline, color: AppTheme.error),
            const SizedBox(width: 8),
            Expanded(child: Text(title)),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            style: TextButton.styleFrom(foregroundColor: AppTheme.error),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  static Future<void> showSuccessDialog(
      BuildContext context, {
        String title = 'Success',
        required String message,
        VoidCallback? onConfirm,
      }) {
    return showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: AppTheme.success),
            const SizedBox(width: 8),
            Expanded(child: Text(title)),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onConfirm?.call();
            },
            style: TextButton.styleFrom(foregroundColor: AppTheme.success),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  static Future<void> showWarningDialog(
      BuildContext context, {
        String title = 'Notice',
        required String message,
      }) {
    return showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: AppTheme.warning),
            const SizedBox(width: 8),
            Expanded(child: Text(title)),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            style: TextButton.styleFrom(foregroundColor: AppTheme.primary),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}