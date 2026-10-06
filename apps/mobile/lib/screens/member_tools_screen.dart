import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';
import '../brand_settings.dart';

class MemberToolsScreen extends StatefulWidget {
  const MemberToolsScreen({super.key, required this.section, this.api});
  final LovaskApi? api;
  final String section;
  @override
  State<MemberToolsScreen> createState() => _MemberToolsScreenState();
}

class _MemberToolsScreenState extends State<MemberToolsScreen> {
  late final api = widget.api ?? LovaskApi();
  Map<String, dynamic>? data;
  String? error;
  bool busy = false;
  final subject = TextEditingController(), message = TextEditingController();
  String category = 'account';
  static const titles = {
    'support': 'Destek merkezi',
    'blocked': 'Engellenen profiller',
    'referrals': 'Arkadaşını davet et',
    'notifications': 'Bildirim tercihleri',
  };
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await switch (widget.section) {
        'support' => api.supportTickets(),
        'blocked' => api.blockedProfiles(),
        'referrals' => api.referrals(),
        _ => api.pushPreferences(),
      };
      if (mounted) {
        setState(() {
          data = result;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> run(Future<void> Function() action) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> reply(Map<String, dynamic> ticket) async {
    final input = TextEditingController();
    final text = await showLovaskSheet<String>(
      context: context,
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(ticket['subject'], style: Theme.of(ctx).textTheme.headlineSmall),
          const SizedBox(height: 16),
          TextField(
            controller: input,
            maxLength: 4000,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Yanıtın'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Vazgeç'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    if (input.text.trim().isNotEmpty) {
                      Navigator.pop(ctx, input.text.trim());
                    }
                  },
                  child: const Text('Gönder'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
    input.dispose();
    if (text != null && mounted) {
      await run(() async {
        await api.replySupport(ticket['id'], text);
      });
    }
  }

  Widget support() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text(
        'Yeni destek talebi',
        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
      ),
      ValueListenableBuilder<AppBrandSettings>(
        valueListenable: AppBrandSettings.value,
        builder: (context, brand, _) => TextButton.icon(
          onPressed: () async {
            final opened = await launchUrl(
              Uri(scheme: 'mailto', path: brand.supportEmail),
            );
            if (!opened && mounted) {
              setState(
                () => error =
                    'E-posta uygulaması açılamadı. Lütfen ${brand.supportEmail} adresine yaz.',
              );
            }
          },
          icon: const Icon(Icons.mail_outline, size: 18),
          label: Text(brand.supportEmail),
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: subject,
        maxLength: 120,
        decoration: const InputDecoration(labelText: 'Konu'),
      ),
      DropdownButtonFormField<String>(
        initialValue: category,
        decoration: const InputDecoration(labelText: 'Kategori'),
        items:
            const {
                  'account': 'Hesap',
                  'payment': 'Ödeme',
                  'safety': 'Güvenlik',
                  'technical': 'Teknik',
                  'other': 'Diğer',
                }.entries
                .map(
                  (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                )
                .toList(),
        onChanged: (v) => category = v!,
      ),
      const SizedBox(height: 16),
      TextField(
        controller: message,
        maxLength: 4000,
        maxLines: 4,
        decoration: const InputDecoration(labelText: 'Mesajın'),
      ),
      LovaskPrimaryButton(
        onPressed: busy
            ? null
            : () => run(() async {
                if (subject.text.trim().length < 3 ||
                    message.text.trim().length < 5) {
                  throw const LovaskApiException(
                    400,
                    'Konu en az 3, mesaj en az 5 karakter olmalı.',
                  );
                }
                await api.support({
                  'subject': subject.text.trim(),
                  'category': category,
                  'message': message.text.trim(),
                });
                subject.clear();
                message.clear();
              }),
        label: busy ? 'İşleniyor…' : 'Talep oluştur',
        icon: Icons.send_outlined,
      ),
      const SizedBox(height: 28),
      const Text(
        'Destek taleplerin',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
      ),
      if ((data!['tickets'] as List).isEmpty)
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text('Henüz destek talebin yok.'),
        ),
      for (final raw in data!['tickets'] as List)
        Builder(
          builder: (_) {
            final ticket = Map<String, dynamic>.from(raw);
            final messages =
                List<Map<String, dynamic>>.from(
                  ticket['support_ticket_messages'] ?? [],
                )..sort(
                  (a, b) =>
                      '${a['created_at']}'.compareTo('${b['created_at']}'),
                );
            return LovaskSurface(
              padding: EdgeInsets.zero,
              radius: 18,
              child: ExpansionTile(
                title: Text(ticket['subject']),
                subtitle: Text(
                  const {
                        'open': 'Açık',
                        'pending': 'Beklemede',
                        'resolved': 'Çözüldü',
                        'closed': 'Kapalı',
                      }[ticket['status']] ??
                      '${ticket['status']}',
                ),
                children: [
                  for (final m in messages)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${m['sender_admin_id'] != null ? 'Destek ekibi' : 'Sen'} · ${m['created_at']}',
                            style: const TextStyle(color: muted, fontSize: 11),
                          ),
                          const SizedBox(height: 5),
                          Text('${m['body']}'),
                        ],
                      ),
                    ),
                  if (ticket['status'] != 'closed')
                    TextButton(
                      onPressed: busy ? null : () => reply(ticket),
                      child: const Text('Yanıt yaz'),
                    ),
                ],
              ),
            );
          },
        ),
    ],
  );

  Widget notifications() {
    final p = data!['preferences'] as Map<String, dynamic>;
    Future<void> pick(String key) async {
      final parts = '${p[key]}'.split(':');
      final result = await showTimePicker(
        context: context,
        initialTime: TimeOfDay(
          hour: int.parse(parts[0]),
          minute: int.parse(parts[1]),
        ),
      );
      if (result != null && mounted) {
        setState(
          () => p[key] =
              '${result.hour.toString().padLeft(2, '0')}:${result.minute.toString().padLeft(2, '0')}',
        );
      }
    }

    return Column(
      children: [
        LovaskSurface(
          radius: 16,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            children: [
              const Expanded(child: Text('Sessiz saatler')),
              Switch(
                value: p['quiet_hours_enabled'] == true,
                onChanged: (v) => setState(() => p['quiet_hours_enabled'] = v),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: LovaskSurface(
            radius: 16,
            child: InkWell(
              onTap: () => pick('quiet_start'),
              child: Row(
                children: [
                  const Expanded(child: Text('Başlangıç')),
                  Text(
                    '${p['quiet_start']}'.substring(0, 5),
                    style: const TextStyle(
                      color: ruby,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: LovaskSurface(
            radius: 16,
            child: InkWell(
              onTap: () => pick('quiet_end'),
              child: Row(
                children: [
                  const Expanded(child: Text('Bitiş')),
                  Text(
                    '${p['quiet_end']}'.substring(0, 5),
                    style: const TextStyle(
                      color: ruby,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text('Saat dilimi: ${p['timezone']}'),
        const SizedBox(height: 20),
        LovaskPrimaryButton(
          onPressed: busy
              ? null
              : () => run(() async {
                  await api.savePushPreferences({
                    'quietHoursEnabled': p['quiet_hours_enabled'],
                    'quietStart': '${p['quiet_start']}'.substring(0, 5),
                    'quietEnd': '${p['quiet_end']}'.substring(0, 5),
                    'timezone': p['timezone'],
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        duration: Duration(seconds: 6),
                        content: Text('Bildirim tercihleri kaydedildi.'),
                      ),
                    );
                  }
                }),
          label: 'Tercihleri kaydet',
          icon: Icons.check,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(titles[widget.section]!)),
    body: data == null && error == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(22),
              children: [
                LovaskHero(
                  eyebrow: 'SENİN ALANIN',
                  title: switch (widget.section) {
                    'support' => 'Yanındayız.',
                    'blocked' => 'Sınırların sana ait.',
                    'notifications' => 'Kendi ritminde.',
                    _ => 'İyi şeyler paylaşılır.',
                  },
                  subtitle: switch (widget.section) {
                    'support' =>
                      'Bir sorunun varsa yaz. Destek taleplerini buradan takip edebilirsin.',
                    'blocked' =>
                      'Engellediğin profilleri buradan yönetebilirsin.',
                    'notifications' =>
                      'Sessiz saatlerini belirle. Tanışmak için her zaman çevrimiçi olman gerekmez.',
                    _ =>
                      'Davet bağlantını paylaş, arkadaşların da Lovask ile tanışsın.',
                  },
                ),
                const SizedBox(height: 24),
                if (error != null) ...[
                  Text(error!, style: const TextStyle(color: ruby)),
                  TextButton(onPressed: load, child: const Text('Tekrar dene')),
                ],
                if (data != null)
                  AbsorbPointer(
                    absorbing: busy,
                    child: switch (widget.section) {
                      'support' => support(),
                      'notifications' => notifications(),
                      'blocked' => Column(
                        children: [
                          if ((data!['blocked'] as List).isEmpty)
                            const Text('Engellediğin profil yok.'),
                          for (final item in data!['blocked'] as List)
                            LovaskSurface(
                              radius: 16,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '${item['profiles']?['display_name'] ?? 'Profil'}',
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => run(() async {
                                      await api.safety({
                                        'action': 'unblock',
                                        'targetProfileId': item['blocked_id'],
                                      });
                                    }),
                                    child: const Text('Engeli kaldır'),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                      _ => Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Birlikte daha güzel.',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 20),
                          SelectableText(
                            '${data!['code']}',
                            style: const TextStyle(fontSize: 24, color: ruby),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            '${data!['activations']} aktivasyon · ${data!['earnedDays']} gün kazanıldı',
                          ),
                          const SizedBox(height: 16),
                          SelectableText('${data!['shareUrl']}'),
                          const SizedBox(height: 20),
                          LovaskPrimaryButton(
                            icon: Icons.copy,
                            label: 'Davet bağlantısını kopyala',
                            onPressed: () => run(() async {
                              await Clipboard.setData(
                                ClipboardData(text: '${data!['shareUrl']}'),
                              );
                              await api.shareReferral();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    duration: Duration(seconds: 6),
                                    content: Text(
                                      'Davet bağlantısı kopyalandı.',
                                    ),
                                  ),
                                );
                              }
                            }),
                          ),
                        ],
                      ),
                    },
                  ),
              ],
            ),
          ),
  );
}
