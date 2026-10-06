import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../theme.dart';

class CampaignCard extends StatefulWidget {
  const CampaignCard({super.key, required this.api});
  final LovaskApi api;
  @override
  State<CampaignCard> createState() => _CampaignCardState();
}

class _CampaignCardState extends State<CampaignCard> {
  Map<String, dynamic>? campaign;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await widget.api.campaign();
      if (mounted) setState(() => campaign = result['campaign'] as Map<String, dynamic>?);
    } catch (_) {
      // A campaign must not block discovery.
    }
  }

  Future<void> open() async {
    final item = campaign;
    if (item == null) return;
    final path = item['cta_path'] as String?;
    if (path == null || !path.startsWith('/') || path.startsWith('//')) return;
    unawaited(widget.api.trackCampaignClick(item['id'] as String).catchError((_) => <String, dynamic>{}));
    await launchUrl(Uri.parse('${LovaskApi.baseUrl}$path'), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final item = campaign;
    if (item == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(top: 12), padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(gradient: actionGradient, borderRadius: BorderRadius.circular(18), border: Border.all(color: champagne)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('DUYURU', style: TextStyle(color: champagne, fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Text(item['title'] as String, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Text(item['body'] as String, style: const TextStyle(color: Colors.white, height: 1.35)),
        const SizedBox(height: 10),
        FilledButton(onPressed: open, child: Text(item['cta_label'] as String)),
      ]),
    );
  }
}
