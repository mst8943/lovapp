import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import 'lovask_primitives.dart';

class LovaskMatchSheet extends StatefulWidget {
  const LovaskMatchSheet({
    super.key,
    required this.profile,
    required this.api,
    required this.onMessage,
    required this.onContinue,
  });
  final DiscoveryProfile profile;
  final LovaskApi api;
  final VoidCallback onMessage, onContinue;
  @override
  State<LovaskMatchSheet> createState() => _LovaskMatchSheetState();
}

class _LovaskMatchSheetState extends State<LovaskMatchSheet> {
  late final self = widget.api.profile();
  Timer? _dismissTimer;

  @override
  void initState() {
    super.initState();
    _dismissTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) widget.onContinue();
    });
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(alignment: Alignment.centerRight, child: IconButton(tooltip: 'Eşleşme bildirimini kapat', icon: const Icon(Icons.close), onPressed: widget.onContinue)),
          const Center(child: LovaskEyebrow('Karşılıklı bir başlangıç')),
          const SizedBox(height: 28),
          FutureBuilder<Map<String, dynamic>>(
            future: self,
            builder: (context, snapshot) {
              final photos =
                  (snapshot.data?['profile'] as Map?)?['photos'] as List? ?? [];
              final first = photos.isEmpty ? null : photos.first;
              final url = first is Map
                  ? first['url'] as String?
                  : first is String
                  ? first
                  : null;
              return Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Semantics(
                    label: 'Sen',
                    child: LovaskAvatar(url: url, size: 80),
                  ),
                  Expanded(
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 500),
                      builder: (_, value, child) =>
                          Transform.scale(scaleX: value, child: child),
                      child: const LovaskOrbit(size: 64, color: ruby),
                    ),
                  ),
                  Semantics(
                    label: widget.profile.name,
                    child: LovaskAvatar(url: widget.profile.image, size: 80),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 28),
          Text(
            'Yollarınız kesişti.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: 12),
          Text(
            '${widget.profile.name} ile ilk sohbetin burada başlayabilir.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted),
          ),
          const SizedBox(height: 28),
          LovaskPrimaryButton(
            label: 'Mesaj gönder',
            icon: Icons.chat_bubble_outline,
            onPressed: widget.onMessage,
          ),
          const SizedBox(height: 10),
          LovaskGhostButton(
            label: 'Keşfetmeye devam et',
            onPressed: widget.onContinue,
          ),
        ],
      ),
    ),
  );
}
