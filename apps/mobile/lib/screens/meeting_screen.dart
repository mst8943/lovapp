import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';
import '../widgets/date_plans_section.dart';
import 'profile_detail_screen.dart';

class MeetingScreen extends StatefulWidget {
  const MeetingScreen({super.key, required this.api, this.active = true});
  final LovaskApi api;
  final bool active;
  @override
  State<MeetingScreen> createState() => _MeetingScreenState();
}

class _MeetingScreenState extends State<MeetingScreen>
    with WidgetsBindingObserver {
  Map<String, dynamic>? data;
  List<Map<String, dynamic>> events = [];
  String? error;
  String? eventError;
  bool busy = false, fetching = false;
  bool eventsFetching = false;
  String? eventBusyId;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (widget.active &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed &&
          !busy) {
        load();
      }
    });
  }

  @override
  void didUpdateWidget(covariant MeetingScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (widget.active && state == AppLifecycleState.resumed) load();
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> load() async {
    if (fetching) return;
    unawaited(loadEvents());
    fetching = true;
    try {
      final result = await widget.api.meetings();
      if (mounted) {
        setState(() {
          data = result;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Buluşma alanı yüklenemedi. Yeniden dene.');
      }
    } finally {
      fetching = false;
    }
  }

  Future<void> loadEvents() async {
    if (eventsFetching) return;
    eventsFetching = true;
    try {
      final result = await widget.api.events();
      if (mounted) {
        setState(() {
          events = (result['events'] as List? ?? []).whereType<Map<String, dynamic>>().toList();
          eventError = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => eventError = 'Etkinlikler yüklenemedi.');
    } finally {
      eventsFetching = false;
    }
  }

  Future<void> respondEvent(Map<String, dynamic> event) async {
    if (eventBusyId != null) return;
    final id = event['id'] as String;
    setState(() => eventBusyId = id);
    try {
      await widget.api.respondEvent(id, event['attending'] != true);
      await loadEvents();
    } catch (cause) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(cause.toString())));
    } finally {
      if (mounted) setState(() => eventBusyId = null);
    }
  }

  String eventDate(String value) {
    final date = DateTime.parse(value).toLocal();
    String two(int part) => part.toString().padLeft(2, '0');
    return '${two(date.day)}.${two(date.month)}.${date.year} · ${two(date.hour)}:${two(date.minute)}';
  }

  Future<void> choose(String? id) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      if (id == null) {
        await widget.api.cancelMeeting();
      } else {
        await widget.api.chooseMeeting(id);
      }
      await load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text(e.toString()),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final options = (data?['options'] as List? ?? [])
        .cast<Map<String, dynamic>>();
    final selected = data?['selected'] as Map<String, dynamic>?;
    final profiles = (data?['profiles'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .map(DiscoveryProfile.fromJson)
        .toList();
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Image.asset('assets/meeting-logo.png', width: 42, height: 42),
              const SizedBox(width: 12),
              Text(
                'Buluşma',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Bugün ne yapmak istersin?',
            style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            'Bir plan seç. Aynı planı seçen uygun üyelerle tanış. Seçimin 24 saat geçerli.',
            style: TextStyle(color: muted, height: 1.5),
          ),
          const SizedBox(height: 20),
          Text('Yaklaşan etkinlikler', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          if (eventError != null) TextButton.icon(onPressed: loadEvents, icon: const Icon(Icons.refresh), label: Text(eventError!)),
          if (events.isEmpty && eventError == null) const Text('Şu anda planlanmış bir etkinlik yok. Yeni buluşmalar burada duyurulacak.', style: TextStyle(color: muted)),
          for (final event in events) Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LovaskSurface(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${eventDate(event['starts_at'] as String)} · ${event['city']}', style: const TextStyle(color: champagne, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(event['title'] as String, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 7),
              Text(event['description'] as String, style: const TextStyle(color: Colors.white)),
              const SizedBox(height: 7),
              Text(event['venue'] as String, style: const TextStyle(color: muted)),
              const SizedBox(height: 10),
              Text(event['status'] == 'cancelled' ? 'Etkinlik iptal edildi' : '${event['goingCount']}/${event['capacity']} katılımcı', style: const TextStyle(color: champagne)),
              if (event['status'] == 'published') Align(alignment: Alignment.centerRight, child: FilledButton(
                onPressed: eventBusyId != null || (event['attending'] != true && ((event['goingCount'] as int) >= (event['capacity'] as int) || !DateTime.parse(event['starts_at'] as String).isAfter(DateTime.now()))) ? null : () => respondEvent(event),
                child: Text(event['attending'] == true ? 'Katılımımı iptal et' : !DateTime.parse(event['starts_at'] as String).isAfter(DateTime.now()) ? 'Etkinlik başladı' : (event['goingCount'] as int) >= (event['capacity'] as int) ? 'Kontenjan doldu' : 'Katılacağım'),
              )),
            ])),
          ),
          const SizedBox(height: 20),
          DatePlansSection(api: widget.api),
          const SizedBox(height: 24),
          if (data == null && error == null)
            const Center(child: CircularProgressIndicator()),
          if (error != null)
            TextButton.icon(
              onPressed: load,
              icon: const Icon(Icons.refresh),
              label: Text(error!),
            ),
          if (data != null && options.isEmpty)
            const Text('Şu anda açık bir buluşma planı yok.'),
          for (final option in options)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Semantics(
                selected: selected?['option_id'] == option['id'],
                child: InkWell(
                  onTap: busy ? null : () => choose(option['id'] as String),
                  borderRadius: LovaskRadius.portrait,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: selected?['option_id'] == option['id']
                          ? actionGradient
                          : orbitGradient,
                      borderRadius: LovaskRadius.portrait,
                      border: Border.all(
                        color: selected?['option_id'] == option['id']
                            ? ruby
                            : wine,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          option['icon'] == 'walk'
                              ? Icons.directions_walk
                              : option['icon'] == 'event'
                              ? Icons.local_activity_outlined
                              : Icons.coffee_outlined,
                          color: champagne,
                          size: 28,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            option['label'] as String,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Icon(
                          selected?['option_id'] == option['id']
                              ? Icons.check_circle
                              : Icons.arrow_forward,
                          color: Colors.white,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          if (busy) const LinearProgressIndicator(),
          if (selected != null) ...[
            TextButton(
              onPressed: busy ? null : () => choose(null),
              child: const Text('Planımı kaldır'),
            ),
            const SizedBox(height: 12),
            Text(
              'Aynı planı seçenler',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            if (profiles.isEmpty)
              const LovaskSurface(
                child: Text(
                  'Henüz bu planı seçen uygun bir üye yok. Yeni katılımlar burada görünecek.',
                ),
              ),
            for (final profile in profiles)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: LovaskAvatar(
                  url: profile.image,
                  size: 48,
                  online: profile.presence.isOnline,
                ),
                title: Text('${profile.name}, ${profile.age}'),
                subtitle: Row(
                  children: [
                    if (profile.city.isNotEmpty) ...[
                      Text(profile.city),
                      const SizedBox(width: 6),
                      const Text('·'),
                      const SizedBox(width: 6),
                    ],
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: profile.presence.isOnline
                            ? const Color(0xFF22C55E)
                            : const Color(0xFF94A3B8),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      profile.presence.label,
                      style: TextStyle(
                        color: profile.presence.isOnline
                            ? const Color(0xFF4ADE80)
                            : muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => openProfileDetails(context, profile),
              ),
          ],
        ],
      ),
    );
  }
}
