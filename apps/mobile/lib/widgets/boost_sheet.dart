import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'lovask_primitives.dart';

class BoostIconButton extends StatelessWidget {
  const BoostIconButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'Boost kullan',
    child: Semantics(
      button: true,
      label: 'Boost kullan',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(15),
          child: Ink(
            width: 54,
            height: 46,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFD6A74C), Color(0xFF9B6926)],
              ),
              borderRadius: BorderRadius.circular(15),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x409B6926),
                  blurRadius: 9,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.bolt_rounded, color: Colors.white, size: 24),
                Text(
                  'BOOST',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    height: 1,
                    letterSpacing: .4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> showBoostSheet(
  BuildContext context, {
  required LovaskApi api,
  required VoidCallback onOpenNoir,
}) => showLovaskSheet<void>(
  context: context,
  builder: (_) => _BoostSheet(api: api, onOpenNoir: onOpenNoir),
);

class _BoostSheet extends StatefulWidget {
  const _BoostSheet({required this.api, required this.onOpenNoir});

  final LovaskApi api;
  final VoidCallback onOpenNoir;

  @override
  State<_BoostSheet> createState() => _BoostSheetState();
}

class _BoostSheetState extends State<_BoostSheet> {
  Map<String, dynamic>? _status;
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final status = await widget.api.boostStatus();
      if (mounted) setState(() => _status = status);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Boost durumu yüklenemedi. Tekrar deneyebilirsin.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _activate() async {
    if (_busy || _status?['canActivate'] != true) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final status = await widget.api.activateBoost();
      if (mounted) setState(() => _status = status);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Boost başlatılamadı. Biraz sonra tekrar dene.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = DateTime.tryParse(
      '${_status?['activeUntil'] ?? ''}',
    )?.toLocal();
    final next = DateTime.tryParse(
      '${_status?['nextAvailableAt'] ?? ''}',
    )?.toLocal();
    final noir =
        DateTime.tryParse(
          '${_status?['noirUntil'] ?? ''}',
        )?.isAfter(DateTime.now()) ==
        true;
    final isActive = active != null && active.isAfter(DateTime.now());
    final canActivate = _status?['canActivate'] == true;
    final message = isActive
        ? 'Boost aktif. ${active.day}.${active.month} ${active.hour.toString().padLeft(2, '0')}:${active.minute.toString().padLeft(2, '0')} tarihine kadar profilin keşifte daha fazla görünme şansına sahip.'
        : !noir
        ? 'Noir üyeleri haftada bir kez 30 dakika Boost kullanabilir.'
        : next != null && next.isAfter(DateTime.now())
        ? 'Bu haftaki hakkını kullandın. Yeni hakkın ${next.day}.${next.month} tarihinde açılacak.'
        : _status?['eligible'] != true
        ? 'Boost için profilini görünür yap, Hayalet Modu kapat ve onaylı bir fotoğraf ekle.'
        : 'Profilin 30 dakika boyunca keşifte daha fazla görünme şansı kazanır.';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.bolt_rounded, color: gold, size: 42),
        const SizedBox(height: 8),
        Text(
          '30 dakika Boost',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Text(
          _status == null
              ? _busy
                    ? 'Boost hakkın kontrol ediliyor…'
                    : 'Boost hakkını ve süresini burada görebilirsin.'
              : message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: muted),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: reject),
          ),
        ],
        const SizedBox(height: 20),
        if (_busy)
          const CircularProgressIndicator(color: gold)
        else if (_error != null && _status == null)
          LovaskPrimaryButton(label: 'Tekrar dene', onPressed: _load)
        else if (canActivate)
          LovaskPrimaryButton(label: 'Boost’u başlat', onPressed: _activate)
        else if (!noir && !isActive && _status != null)
          LovaskPrimaryButton(
            label: 'Noir’ı keşfet',
            onPressed: () {
              Navigator.pop(context);
              widget.onOpenNoir();
            },
          ),
      ],
    );
  }
}
