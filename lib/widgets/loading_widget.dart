import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../config/app_theme.dart';

class LoadingWidget extends StatelessWidget {
  final int itemCount;
  final bool isGrid;
  final double? height;

  const LoadingWidget({
    super.key,
    this.itemCount = 6,
    this.isGrid = false,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    return isGrid ? _buildGridShimmer(context) : _buildListShimmer(context);
  }

  Widget _buildListShimmer(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Shimmer.fromColors(
            baseColor: isDark ? AppTheme.darkSurfaceLight : AppTheme.navy100,
            highlightColor: isDark ? AppTheme.darkBorder : AppTheme.navy50,
            child: Container(
              height: height ?? 80,
              decoration: BoxDecoration(
                color: isDark ? AppTheme.darkSurface : Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildGridShimmer(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.8,
      ),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        return Shimmer.fromColors(
          baseColor: isDark ? AppTheme.darkSurfaceLight : AppTheme.navy100,
          highlightColor: isDark ? AppTheme.darkBorder : AppTheme.navy50,
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? AppTheme.darkSurface : Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      },
    );
  }
}