import 'package:flutter/material.dart';
import '../api.dart';
import '../widgets/lovask_primitives.dart';

Future<bool?> showSafetySheet(
  BuildContext context,
  String profileId, {
  String? matchId,
}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  builder: (_) => _SafetySheet(profileId: profileId, matchId: matchId),
);

class _SafetySheet extends StatefulWidget {
  const _SafetySheet({required this.profileId, this.matchId});
  final String profileId;
  final String? matchId;
  @override
  State<_SafetySheet> createState() => _SafetySheetState();
}

class _SafetySheetState extends State<_SafetySheet> {
  String action = 'report', reason = 'fake_profile';
  bool block = true, busy = false;
  String? error;
  final details = TextEditingController();
  @override
  void dispose() {
    details.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy) return;
    final confirmed = await showLovaskSheet<bool>(
      context: context,
      builder: (dialogContext) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            action == 'report'
                ? 'Şikâyeti gönder?'
                : action == 'block'
                ? 'Bu profili engelle?'
                : 'Eşleşmeyi kaldır?',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          Text(
            action == 'report'
                ? 'Şikâyetin inceleme ekibine iletilecek.${block ? ' Bu profil ayrıca engellenecek.' : ''}'
                : action == 'block'
                ? 'Bu kişi profilini göremez ve seninle iletişim kuramaz. Engeli ayarlardan kaldırabilirsin.'
                : 'Sohbet kapanacak. Bu işlem geri alınamaz.',
          ),
          const SizedBox(height: 24),
          LovaskPrimaryButton(
            label: 'Onayla',
            onPressed: () => Navigator.pop(dialogContext, true),
          ),
          const SizedBox(height: 12),
          LovaskGhostButton(
            label: 'Vazgeç',
            onPressed: () => Navigator.pop(dialogContext, false),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await LovaskApi().safety({
        'action': action,
        'targetProfileId': widget.profileId,
        if (action == 'report') ...{
          'reason': reason,
          'details': details.text.trim(),
          'block': block,
          'matchId': widget.matchId,
        },
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(duration: Duration(seconds: 6), content: Text('Güvenlik işlemi tamamlandı.')),
        );
        Navigator.pop(context, action != 'report' || block);
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      24,
      24,
      24,
      MediaQuery.viewInsetsOf(context).bottom + 24,
    ),
    child: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Güvenlik',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: action,
            decoration: const InputDecoration(labelText: 'İşlem'),
            items: [
              const DropdownMenuItem(
                value: 'report',
                child: Text('Şikâyet et'),
              ),
              const DropdownMenuItem(value: 'block', child: Text('Engelle')),
              if (widget.matchId != null)
                const DropdownMenuItem(
                  value: 'unmatch',
                  child: Text('Eşleşmeyi kaldır'),
                ),
            ],
            onChanged: busy ? null : (v) => setState(() => action = v!),
          ),
          const SizedBox(height: 16),
          if (action == 'report') ...[
            DropdownButtonFormField<String>(
              initialValue: reason,
              decoration: const InputDecoration(labelText: 'Şikâyet nedeni'),
              items:
                  const {
                        'fake_profile': 'Sahte profil',
                        'harassment': 'Taciz',
                        'inappropriate_content': 'Uygunsuz içerik',
                        'fraud': 'Dolandırıcılık',
                        'underage': '18 yaşından küçük',
                        'spam': 'Spam',
                        'other': 'Diğer',
                      }.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
              onChanged: busy ? null : (v) => setState(() => reason = v!),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: details,
              maxLength: 1000,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Açıklama (isteğe bağlı)',
              ),
            ),
            LovaskSurface(
              radius: 16,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: Row(
                children: [
                  const Expanded(child: Text('Bu profili ayrıca engelle')),
                  Checkbox(
                    value: block,
                    onChanged: busy
                        ? null
                        : (v) => setState(() => block = v ?? false),
                  ),
                ],
              ),
            ),
          ] else
            Text(
              action == 'block'
                  ? 'Bu kişi profilini göremez ve seninle iletişim kuramaz.'
                  : 'Bu sohbet kapanacak. İşlem geri alınamaz.',
            ),
          if (error != null) Text(error!),
          const SizedBox(height: 16),
          LovaskPrimaryButton(
            onPressed: busy ? null : submit,
            label: busy
                ? 'İşleniyor…'
                : action == 'report'
                ? 'Şikâyeti gönder'
                : action == 'block'
                ? 'Engellemeyi onayla'
                : 'Eşleşmeyi kaldır',
            icon: Icons.shield_outlined,
          ),
        ],
      ),
    ),
  );
}
