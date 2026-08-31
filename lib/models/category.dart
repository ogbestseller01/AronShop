class CategoryDropdown {
  final String value;
  final String label; // clean: "OPPO (Y04)" – never includes SKUs
  final String? model;
  final List<String>? skus;

  CategoryDropdown({
    required this.value,
    required this.label,
    this.model,
    this.skus,
  });

  factory CategoryDropdown.fromJson(Map<String, dynamic> json) {
    final name = json['name']?.toString() ??
        json['category_name']?.toString() ??
        '';
    final code = json['code']?.toString() ??
        json['model']?.toString() ??
        '';

    String cleanLabel;
    if (name.isNotEmpty && code.isNotEmpty) {
      cleanLabel = '$name ($code)';
    } else if (name.isNotEmpty) {
      cleanLabel = name;
    } else {
      // Fallback: strip SKUs if API only sends full label
      final raw = json['label']?.toString() ?? '';
      cleanLabel =
      raw.contains(' - ') ? raw.split(' - ').first.trim() : raw;
    }

    return CategoryDropdown(
      value: json['value']?.toString() ??
          json['category_id']?.toString() ??
          '',
      label: cleanLabel,
      model: code.isNotEmpty ? code : null,
      skus: json['skus'] != null ? List<String>.from(json['skus']) : null,
    );
  }
}