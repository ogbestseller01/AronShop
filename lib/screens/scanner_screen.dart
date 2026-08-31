import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../config/app_config.dart';

class ScannerScreen extends StatefulWidget {
  final List<String> existingImeis;
  final bool isBatchMode;
  final bool isTab;

  const ScannerScreen({
    super.key,
    this.existingImeis = const [],
    this.isBatchMode = true,
    this.isTab = false,
  });

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen>
    with WidgetsBindingObserver {
  late MobileScannerController _controller;

  final List<String> _scannedImeis = [];
  String? _pendingCode;
  bool _isProcessing = false;
  bool _torchOn = false;
  bool _cameraReady = false;

  String? _lastDetectedCode;
  DateTime? _lastDetectTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scannedImeis.addAll(widget.existingImeis);
    _initCamera();
  }

  void _initCamera() {
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
      formats: const [BarcodeFormat.all],
      returnImage: false,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_cameraReady) return;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _controller.stop();
    } else if (state == AppLifecycleState.resumed) {
      _controller.start();
    }
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing || _pendingCode != null) return;

    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final raw = barcodes.first.rawValue?.trim();
    if (raw == null || raw.isEmpty) return;

    final now = DateTime.now();
    if (_lastDetectedCode == raw &&
        _lastDetectTime != null &&
        now.difference(_lastDetectTime!).inMilliseconds < 1200) {
      return;
    }
    _lastDetectedCode = raw;
    _lastDetectTime = now;

    HapticFeedback.mediumImpact();

    if (_scannedImeis.contains(raw)) {
      Fluttertoast.showToast(
        msg: 'Already added: $raw',
        backgroundColor: Colors.orange,
        textColor: Colors.white,
        toastLength: Toast.LENGTH_SHORT,
      );
      return;
    }

    setState(() {
      _pendingCode = raw;
    });

    _controller.stop();
  }

  void _confirmAdd() {
    if (_pendingCode == null || _isProcessing) return;

    setState(() {
      _isProcessing = true;
      _scannedImeis.add(_pendingCode!);
      _pendingCode = null;
      _isProcessing = false;
    });

    Fluttertoast.showToast(
      msg: 'Added: ${_scannedImeis.last}',
      backgroundColor: Colors.green,
      textColor: Colors.white,
    );

    if (!widget.isBatchMode) {
      Navigator.pop(context, _scannedImeis);
      return;
    }

    _controller.start();
  }

  void _skipPending() {
    setState(() => _pendingCode = null);
    _controller.start();
  }

  void _removeAt(int index) {
    setState(() => _scannedImeis.removeAt(index));
  }

  void _finish() {
    Navigator.pop(context, List<String>.from(_scannedImeis));
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      setState(() => _torchOn = !_torchOn);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    // Horizontal rectangle – good for IMEI / product barcodes
    final cutOutWidth = size.width * 0.85;
    final cutOutHeight = cutOutWidth * 0.38; // wide & short

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(
          widget.isBatchMode ? 'Scan Identifiers' : 'Scan Product',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(
              _torchOn ? Icons.flash_on : Icons.flash_off,
              color: _torchOn ? Colors.amber : Colors.white70,
            ),
            onPressed: _toggleTorch,
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch_outlined),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Camera
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.camera_alt_outlined,
                        size: 64,
                        color: Colors.white54,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        error.errorCode.name == 'permissionDenied'
                            ? 'Camera permission denied.\nPlease allow camera access in settings.'
                            : (error.errorDetails?.message ??
                            'Camera error. Please try again.'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () {
                          _controller.start();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppConfig.primaryColor,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          // Horizontal rectangle overlay
          CustomPaint(
            painter: _ScannerOverlayPainter(
              cutOutWidth: cutOutWidth,
              cutOutHeight: cutOutHeight,
              borderColor: AppConfig.primaryColor,
            ),
          ),

          // Top instruction
          Positioned(
            top: 20,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.65),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _pendingCode == null
                    ? 'Align barcode inside the rectangle'
                    : 'Confirm this code',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),

          // ========== PENDING CONFIRMATION CARD ==========
          if (_pendingCode != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 140,
              child: Material(
                elevation: 8,
                borderRadius: BorderRadius.circular(16),
                color: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Detected',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _pendingCode!,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                          letterSpacing: 0.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _skipPending,
                              style: OutlinedButton.styleFrom(
                                padding:
                                const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: const Text('Skip'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 2,
                            child: ElevatedButton.icon(
                              onPressed: _confirmAdd,
                              icon: const Icon(Icons.check, size: 20),
                              label: const Text('Add'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppConfig.primaryColor,
                                foregroundColor: Colors.white,
                                padding:
                                const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // ========== BOTTOM BAR ==========
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.85),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(20),
                ),
              ),
              padding: EdgeInsets.fromLTRB(
                16,
                16,
                16,
                MediaQuery.of(context).padding.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppConfig.primaryColor,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${_scannedImeis.length} added',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (_scannedImeis.isNotEmpty)
                        TextButton(
                          onPressed: () {
                            setState(() => _scannedImeis.clear());
                          },
                          child: const Text(
                            'Clear',
                            style: TextStyle(color: Colors.redAccent),
                          ),
                        ),
                    ],
                  ),

                  if (_scannedImeis.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _scannedImeis.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, index) {
                          return Chip(
                            label: Text(
                              _scannedImeis[index],
                              style: const TextStyle(fontSize: 12),
                            ),
                            deleteIcon: const Icon(Icons.close, size: 16),
                            onDeleted: () => _removeAt(index),
                            backgroundColor: Colors.white12,
                            labelStyle: const TextStyle(color: Colors.white),
                            side: BorderSide.none,
                          );
                        },
                      ),
                    ),
                  ],

                  const SizedBox(height: 14),

                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _finish,
                      icon: const Icon(Icons.check_circle_outline),
                      label: Text(
                        _scannedImeis.isEmpty
                            ? 'Cancel'
                            : 'Done (${_scannedImeis.length})',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppConfig.primaryColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------- Horizontal rectangle overlay (for IMEI / barcodes) ----------
class _ScannerOverlayPainter extends CustomPainter {
  final double cutOutWidth;
  final double cutOutHeight;
  final Color borderColor;

  _ScannerOverlayPainter({
    required this.cutOutWidth,
    required this.cutOutHeight,
    required this.borderColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cutOutRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2 - 50),
      width: cutOutWidth,
      height: cutOutHeight,
    );

    // Dim background
    final bgPaint = Paint()..color = Colors.black.withOpacity(0.55);
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(
          RRect.fromRectAndRadius(cutOutRect, const Radius.circular(12)))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, bgPaint);

    // Corner borders
    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;

    const cornerLen = 22.0;

    // Top-left
    canvas.drawPath(
      Path()
        ..moveTo(cutOutRect.left, cutOutRect.top + cornerLen)
        ..lineTo(cutOutRect.left, cutOutRect.top)
        ..lineTo(cutOutRect.left + cornerLen, cutOutRect.top),
      borderPaint,
    );
    // Top-right
    canvas.drawPath(
      Path()
        ..moveTo(cutOutRect.right - cornerLen, cutOutRect.top)
        ..lineTo(cutOutRect.right, cutOutRect.top)
        ..lineTo(cutOutRect.right, cutOutRect.top + cornerLen),
      borderPaint,
    );
    // Bottom-right
    canvas.drawPath(
      Path()
        ..moveTo(cutOutRect.right, cutOutRect.bottom - cornerLen)
        ..lineTo(cutOutRect.right, cutOutRect.bottom)
        ..lineTo(cutOutRect.right - cornerLen, cutOutRect.bottom),
      borderPaint,
    );
    // Bottom-left
    canvas.drawPath(
      Path()
        ..moveTo(cutOutRect.left + cornerLen, cutOutRect.bottom)
        ..lineTo(cutOutRect.left, cutOutRect.bottom)
        ..lineTo(cutOutRect.left, cutOutRect.bottom - cornerLen),
      borderPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}