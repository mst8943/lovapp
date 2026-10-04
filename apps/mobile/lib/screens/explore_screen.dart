import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';
import 'preferences_screen.dart';
import '../widgets/discovery_header.dart';
import '../widgets/story_strip.dart';
import 'profile_detail_screen.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key, this.api, this.onCards});
  final LovaskApi? api;
  final VoidCallback? onCards;

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen>
    with WidgetsBindingObserver {
  late final api = widget.api ?? LovaskApi();
  List<DiscoveryProfile> profiles = [];
  bool loading = true;
  String? error;
  bool refreshing = false;
  DateTime? lastLoadedAt;
  DateTime? lastPhotoRetryAt;
  Timer? photoTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    photoTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _refreshIfStale();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshIfStale();
  }

  @override
  void dispose() {
    photoTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _refreshIfStale() {
    if (refreshing || lastLoadedAt == null) return;
    if (DateTime.now().difference(lastLoadedAt!) >=
        const Duration(minutes: 10)) {
      _load(silent: true);
    }
  }

  void _retryExpiredPhoto() {
    final now = DateTime.now();
    if (refreshing ||
        (lastPhotoRetryAt != null &&
            now.difference(lastPhotoRetryAt!) < const Duration(minutes: 1))) {
      return;
    }
    lastPhotoRetryAt = now;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(silent: true);
    });
  }

  Future<void> _load({bool silent = false}) async {
    if (refreshing) return;
    refreshing = true;
    if (!silent) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final data = await api.discovery();
      if (mounted) {
        setState(() {
          profiles = data;
          lastLoadedAt = DateTime.now();
          loading = false;
        });
      }
    } catch (e) {
      if (mounted && !silent) {
        setState(() {
          loading = false;
          error = e.toString();
        });
      }
    } finally {
      refreshing = false;
    }
  }

  Future<void> filter() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => SizedBox(
        height: MediaQuery.sizeOf(context).height * .92,
        child: const PreferencesScreen(),
      ),
    );
    if (mounted && changed == true) _load();
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _load,
    child: CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Column(
              children: [
                DiscoveryHeader(
                  list: true,
                  onSwitch: widget.onCards,
                  onFilter: filter,
                ),
                const SizedBox(height: 4),
                StoryStrip(api: api),
              ],
            ),
          ),
        ),
        if (loading)
          const SliverFillRemaining(
            child: Center(child: CircularProgressIndicator()),
          )
        else if (error != null || profiles.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: _StatePanel(
              message: error ?? 'Bu tercihlere uygun profil bulunamadı.',
              action: 'Yenile',
              onPressed: _load,
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
            sliver: SliverGrid(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: MediaQuery.textScalerOf(context).scale(14) > 20
                    ? 1
                    : 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 18,
                childAspectRatio: .65,
              ),
              delegate: SliverChildBuilderDelegate((context, index) {
                final profile = profiles[index];
                return LovaskPortrait(
                  profile: profile,
                  onTap: () => openProfileDetails(context, profile),
                  onPhotoError: _retryExpiredPhoto,
                );
              }, childCount: profiles.length),
            ),
          ),
      ],
    ),
  );
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.message,
    required this.action,
    required this.onPressed,
  });
  final String message;
  final String action;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: LovaskSurface(
        color: panel,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.explore_outlined, color: ruby, size: 28),
            const SizedBox(height: 14),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            LovaskGhostButton(label: action, onPressed: onPressed),
          ],
        ),
      ),
    ),
  );
}
