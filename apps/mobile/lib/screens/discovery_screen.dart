import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import '../widgets/match_sheet.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import 'chat_screen.dart';
import 'preferences_screen.dart';
import '../widgets/discovery_header.dart';
import '../widgets/boost_sheet.dart';
import '../widgets/story_strip.dart';
import 'profile_detail_screen.dart';
import 'voice_message.dart';
import '../widgets/lovask_primitives.dart';

class DiscoveryScreen extends StatefulWidget {
  const DiscoveryScreen({super.key, this.onOpenNoir, this.onExplore, this.api});
  final LovaskApi? api;
  final VoidCallback? onOpenNoir;
  final VoidCallback? onExplore;

  @override
  State<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends State<DiscoveryScreen>
    with WidgetsBindingObserver {
  late final api = widget.api ?? LovaskApi();
  List<DiscoveryProfile> _profiles = [];
  int _currentIndex = 0;
  bool _loading = true;
  String? _error;
  DiscoveryProfile? _lastSwiped;
  bool _deciding = false;
  bool _refreshing = false;
  DateTime? _lastLoadedAt;
  DateTime? _lastPhotoRetryAt;
  Timer? _photoTimer;
  GlobalKey<_InteractiveSwipeCardState> _cardKey = GlobalKey();
  int _superLikeRemaining = 0;
  bool _superLikePremium = false;
  int _questProgress = 0;
  int _questTarget = 3;
  int _questXp = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadDiscovery();
    _photoTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _refreshPhotosIfStale();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshPhotosIfStale();
  }

  @override
  void dispose() {
    _photoTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _refreshPhotosIfStale() {
    if (_deciding || _refreshing || _lastLoadedAt == null) return;
    if (DateTime.now().difference(_lastLoadedAt!) >=
        const Duration(minutes: 10)) {
      _loadDiscovery(silent: true);
    }
  }

  void _retryExpiredPhoto() {
    final now = DateTime.now();
    if (_refreshing ||
        (_lastPhotoRetryAt != null &&
            now.difference(_lastPhotoRetryAt!) < const Duration(minutes: 1))) {
      return;
    }
    _lastPhotoRetryAt = now;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_deciding) _loadDiscovery(silent: true);
    });
  }

  Future<void> _loadDiscovery({bool silent = false}) async {
    if (_refreshing) return;
    _refreshing = true;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final summaryFuture = api.discoverySummary().catchError(
        (_) => <String, dynamic>{},
      );
      final list = await api.discovery();
      final summary = await summaryFuture;
      if (mounted) {
        final currentId = silent && _currentIndex < _profiles.length
            ? _profiles[_currentIndex].id
            : null;
        final currentIndex = currentId == null
            ? 0
            : list.indexWhere((profile) => profile.id == currentId);
        setState(() {
          _profiles = list;
          _currentIndex = currentIndex < 0 ? 0 : currentIndex;
          _lastLoadedAt = DateTime.now();
          _superLikeRemaining =
              ((summary['superLike'] as Map?)?['remaining'] as num?)?.toInt() ??
              0;
          _superLikePremium =
              (summary['superLike'] as Map?)?['premium'] == true;
          _questProgress =
              ((summary['quest'] as Map?)?['progress'] as num?)?.toInt() ?? 0;
          _questTarget =
              ((summary['quest'] as Map?)?['target'] as num?)?.toInt() ?? 3;
          _questXp = ((summary['quest'] as Map?)?['xp'] as num?)?.toInt() ?? 0;
          _loading = false;
        });
        _precacheUpcomingPhoto();
      }
    } catch (e) {
      if (mounted && !silent) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    } finally {
      _refreshing = false;
    }
  }

  void _precacheUpcomingPhoto() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final next = _currentIndex + 2;
      if (next >= _profiles.length) return;
      final url = _profiles[next].image;
      if (url.isEmpty) return;
      final width =
          (MediaQuery.sizeOf(context).width *
                  MediaQuery.devicePixelRatioOf(context))
              .round();
      unawaited(
        precacheImage(
          ResizeImage.resizeIfNeeded(width, null, NetworkImage(url)),
          context,
          onError: (_, _) {},
        ),
      );
    });
  }

  Future<void> _handleSwipe(String direction, {String? note}) async {
    if (_deciding || _currentIndex >= _profiles.length) return;
    final target = _profiles[_currentIndex];
    final index = _currentIndex;
    setState(() => _deciding = true);

    try {
      final wasDailyPick = api.dailyPickProfileId == target.id;
      final departure = _cardKey.currentState?.dismiss(direction);
      departure?.then((_) {
        if (!mounted || !_deciding || _currentIndex != index) return;
        setState(() {
          _currentIndex++;
          _cardKey = GlobalKey();
        });
        _precacheUpcomingPhoto();
      });
      final res = await api.swipe(
        profileId: target.id,
        direction: direction,
        note: note,
      );
      if (direction == 'super') {
        unawaited(HapticFeedback.heavyImpact());
      } else if (direction == 'right') {
        unawaited(HapticFeedback.mediumImpact());
      } else {
        unawaited(HapticFeedback.lightImpact());
      }
      await departure;
      if (!mounted) return;
      setState(() {
        _lastSwiped = target;
        _superLikeRemaining =
            ((res['superLike'] as Map?)?['remaining'] as num?)?.toInt() ??
            _superLikeRemaining;
        _questProgress =
            (res['questProgress'] as num?)?.toInt() ?? _questProgress;
        if (_currentIndex == index) {
          _currentIndex++;
          _cardKey = GlobalKey();
        }
      });
      _precacheUpcomingPhoto();
      if (res['matched'] == true) {
        _showMatchDialog(target);
      }
      if (wasDailyPick) unawaited(api.markDailyPickSeen());
    } catch (error) {
      if (mounted) {
        final wasAdvanced = _currentIndex != index;
        final card = _cardKey.currentState;
        setState(() {
          _deciding = false;
          if (wasAdvanced) {
            _currentIndex = index;
            _cardKey = GlobalKey();
          }
        });
        if (!wasAdvanced) card?._returnToRest();
        final apiError = error is LovaskApiException ? error : null;
        final needsNoir =
            apiError?.code == 'noir_required' ||
            apiError?.code == 'like_limit' ||
            apiError?.code == 'super_like_limit' ||
            apiError?.code == 'undo_limit';
        await showLovaskNoticeSheet(
          context,
          title: needsNoir ? 'Noir ile daha fazlası' : 'İşlem tamamlanamadı',
          message: needsNoir
              ? 'Bu özellik Noir üyeliğiyle kullanılabilir. Keşfetmeye devam etmek için Noir ayrıcalıklarını aç.'
              : apiError?.toString() ??
                    'Karar iletilemedi. İnternet bağlantını kontrol et.',
          icon: needsNoir
              ? Icons.workspace_premium_outlined
              : Icons.info_outline,
          onAction: needsNoir ? widget.onOpenNoir : null,
          actionLabel: 'Noir\'ı aç',
        );
      }
    } finally {
      if (mounted) setState(() => _deciding = false);
    }
  }

  Future<void> _showSuperLikeNotice() async {
    await showLovaskNoticeSheet(
      context,
      title: 'Süper Beğeni Hakkın Bitti',
      message:
          'Bugünkü süper beğeni hakların tükendi. Süper beğeniyle profillere öncelikli görünmek ve sınırsız ayrıcalıklar için Noir ayrıcalıklarını açabilirsin.',
      icon: Icons.star_rounded,
      onAction: widget.onOpenNoir,
      actionLabel: 'Noir\'ı aç',
    );
  }

  Future<void> _showUndoNotice() async {
    await showLovaskNoticeSheet(
      context,
      title: 'Geri Alınacak Profil Yok',
      message:
          'Geri almak için önce bu oturumda bir profili beğenmiş veya geçmiş olmalısın.',
      icon: Icons.rotate_left_rounded,
    );
  }

  Future<void> _showDeckFinishedNotice() async {
    await showLovaskNoticeSheet(
      context,
      title: 'Yeni Profil Kalmadı',
      message:
          'Bölgendeki profilleri inceledin. Yeni üyeler katıldıkça veya kriterlerini genişlettiğinde yeni profiller listelenecektir.',
      icon: Icons.people_outline_rounded,
    );
  }

  Future<void> _handleUndo() async {
    if (_deciding || _lastSwiped == null || _currentIndex == 0) return;
    setState(() => _deciding = true);
    try {
      await api.undo();
      if (mounted) {
        setState(() {
          _currentIndex--;
          _lastSwiped = null;
          _cardKey = GlobalKey();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 6),
            content: Text(
              'Son profil geri alındı.',
              style: TextStyle(color: ink2),
            ),
            backgroundColor: panelLight,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final apiError = e is LovaskApiException ? e : null;
        final needsNoir =
            apiError?.code == 'noir_required' || apiError?.code == 'undo_limit';
        await showLovaskNoticeSheet(
          context,
          title: needsNoir ? 'Geri alma Noir özelliği' : 'Geri alınamadı',
          message: needsNoir
              ? 'Geçtiğin profili geri almak için Noir ayrıcalıklarını açabilirsin.'
              : apiError?.message ?? 'Geri alma sırasında bir sorun oluştu.',
          icon: needsNoir
              ? Icons.workspace_premium_outlined
              : Icons.info_outline,
          onAction: needsNoir ? widget.onOpenNoir : null,
          actionLabel: 'Noir\'ı aç',
        );
      }
    } finally {
      if (mounted) setState(() => _deciding = false);
    }
  }

  void _showMatchDialog(DiscoveryProfile matchProfile) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (ctx) => LovaskMatchSheet(
        profile: matchProfile,
        api: api,
        onContinue: () => Navigator.pop(ctx),
        onMessage: () {
          Navigator.pop(ctx);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChatScreen(
                profileId: matchProfile.id,
                name: matchProfile.name,
                avatarUrl: matchProfile.image,
                isBot: matchProfile.isBot,
              ),
            ),
          );
        },
      ),
    );
  }

  void _showProfileDetails(DiscoveryProfile profile) =>
      openProfileDetails(context, profile);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 2),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DiscoveryHeader(
          list: false,
          onSwitch: widget.onExplore,
          onRitual: _showRitualModal,
          onBoost: () => showBoostSheet(
            context,
            api: api,
            onOpenNoir: widget.onOpenNoir ?? () {},
          ),
          onFilter: () async {
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
            if (mounted && changed == true) _loadDiscovery();
          },
        ),
        const SizedBox(height: 2),
        StoryStrip(api: api),
        const SizedBox(height: 4),
        Expanded(child: _buildDeckArea()),
      ],
    ),
  );

  void _showRitualModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final complete = _questProgress >= _questTarget;
        final target = _questTarget > 0 ? _questTarget : 3;
        final totalXp = _questXp > 0 ? _questXp : 120;
        final xpEarned = (_questProgress * (totalXp / target)).round();
        final progressFactor = (target == 0 ? 0.0 : (_questProgress / target))
            .clamp(0.0, 1.0);

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Color(0x3328183E),
                blurRadius: 30,
                offset: Offset(0, -6),
              ),
            ],
          ),
          padding: EdgeInsets.fromLTRB(
            22,
            12,
            22,
            24 + MediaQuery.paddingOf(ctx).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDDD2E8),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x338B5CF6),
                          blurRadius: 10,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.auto_fix_high_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Günün Ritüeli',
                          style: TextStyle(
                            color: Color(0xFF28183E),
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          complete
                              ? 'Tebrikler! Bugünün ritüelini tamamladın.'
                              : 'Bağ kur, her gün keşfet ve ödülleri topla.',
                          style: const TextStyle(
                            color: Color(0xFF80698E),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF4ECF8),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0xFFD1B5E8)),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'GÖREV',
                          style: TextStyle(
                            color: Color(0xFF80698E),
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          '$_questProgress/$target',
                          style: const TextStyle(
                            color: Color(0xFF7C3AED),
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBF8FD),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFEFE4F7)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          complete
                              ? 'Tamamlandı: +$totalXp XP'
                              : 'Kazanılan: $xpEarned XP',
                          style: const TextStyle(
                            color: Color(0xFF7C3AED),
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          'Hedef: +$totalXp XP',
                          style: const TextStyle(
                            color: Color(0xFF80698E),
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: Container(
                        height: 8,
                        color: const Color(0xFFE9DCF2),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: progressFactor,
                          child: Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              const Padding(
                padding: EdgeInsets.only(left: 4, bottom: 8),
                child: Text(
                  'GÜNLÜK GÖREVLER',
                  style: TextStyle(
                    color: Color(0xFF80698E),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              _buildModalTaskItem(
                title: '3 Profil hakkında karar ver',
                detail: '$_questProgress/$_questTarget tamamlandı',
                reward: '+${_questXp > 0 ? _questXp : 120} XP',
                done: complete,
                icon: Icons.favorite_rounded,
                iconColor: const Color(0xFFE11D48),
              ),
              const SizedBox(height: 8),
              _buildModalTaskItem(
                title: 'Yeni bir sohbet başlat',
                detail: 'Eşleştiğin biriyle ilk adımı at',
                reward: '+80 XP',
                done: false,
                icon: Icons.chat_bubble_rounded,
                iconColor: const Color(0xFF7C3AED),
              ),
              const SizedBox(height: 8),
              _buildModalTaskItem(
                title: 'Günün bir anısını paylaş',
                detail: '24 saatlik hikâye ekle',
                reward: '+50 XP',
                done: false,
                icon: Icons.auto_awesome,
                iconColor: const Color(0xFFD97706),
              ),
              const SizedBox(height: 20),
              Container(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7C3AED), Color(0xFFA855F7)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x337C3AED),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => Navigator.pop(ctx),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 14),
                      child: Center(
                        child: Text(
                          'Harika, Devam Et',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildModalTaskItem({
    required String title,
    required String detail,
    required String reward,
    required bool done,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: done ? const Color(0xFFF3FAF6) : const Color(0xFFFAF6FC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: done ? const Color(0xFFC7EBD7) : const Color(0xFFEFE4F7),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: done
                  ? const Color(0xFF22C55E).withValues(alpha: 0.15)
                  : iconColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              done ? Icons.check_rounded : icon,
              color: done ? const Color(0xFF16A34A) : iconColor,
              size: 19,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: const Color(0xFF28183E),
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    decoration: done ? TextDecoration.lineThrough : null,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: const TextStyle(
                    color: Color(0xFF80698E),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: done
                  ? const Color(0xFF16A34A).withValues(alpha: 0.12)
                  : const Color(0xFF7C3AED).withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              reward,
              style: TextStyle(
                color: done ? const Color(0xFF16A34A) : const Color(0xFF7C3AED),
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeckArea() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: gold));
    }
    if (_error != null) {
      return LovaskEmptyState(
        title: 'Bağlantıyı yeniden kuralım.',
        message: _error!,
        action: LovaskGhostButton(
          label: 'Tekrar dene',
          onPressed: _loadDiscovery,
          icon: Icons.refresh,
        ),
      );
    }
    if (_currentIndex >= _profiles.length) {
      return LovaskEmptyState(
        title: 'Şimdilik bu kadar',
        message:
            'Yeni bir karşılaşmaya biraz zaman ver. Tercihlerini genişleterek daha fazla kişiyi keşfedebilirsin.',
        action: LovaskGhostButton(
          label: 'Yenile',
          onPressed: _loadDiscovery,
          icon: Icons.refresh,
        ),
      );
    }

    // Interactive Swipe Card
    final currentProfile = _profiles[_currentIndex];
    final cardCacheWidth =
        (MediaQuery.sizeOf(context).width *
                MediaQuery.devicePixelRatioOf(context))
            .round();
    return Stack(
      fit: StackFit.expand,
      children: [
        if (_currentIndex + 2 < _profiles.length)
          Transform.translate(
            offset: const Offset(0, 8),
            child: Transform.scale(
              scale: .94,
              child: Container(
                decoration: BoxDecoration(
                  color: panel,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: gold.withValues(alpha: .10)),
                ),
              ),
            ),
          ),
        if (_currentIndex + 1 < _profiles.length)
          Transform.translate(
            offset: const Offset(0, 4),
            child: Transform.scale(
              scale: .97,
              child: Container(
                decoration: BoxDecoration(
                  color: panelLight,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: gold.withValues(alpha: .14)),
                ),
                clipBehavior: Clip.antiAlias,
                child: _profiles[_currentIndex + 1].image.isNotEmpty
                    ? Image.network(
                        _profiles[_currentIndex + 1].image,
                        fit: BoxFit.cover,
                        cacheWidth: cardCacheWidth,
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                      )
                    : null,
              ),
            ),
          ),
        Positioned.fill(
          child: InteractiveSwipeCard(
            key: _cardKey,
            profile: currentProfile,
            disabled: _deciding,
            onSwipeLeft: () => _handleSwipe('left'),
            onSwipeRight: () => _handleSwipe('right'),
            onSwipeUp: () => _handleSwipe('super'),
            onShowDetails: () => _showProfileDetails(currentProfile),
            onPhotoError: _retryExpiredPhoto,
          ),
        ),
        if (api.dailyPickProfileId == currentProfile.id && api.dailyPickReason != null)
          Positioned(
            top: 12,
            left: 12,
            right: 12,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xE61B151D),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: gold.withValues(alpha: .65)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Günün uyumu', style: TextStyle(color: champagne, fontWeight: FontWeight.w800, fontSize: 13)),
                    const SizedBox(height: 3),
                    Text(api.dailyPickReason!, style: const TextStyle(color: Colors.white, fontSize: 12, height: 1.3)),
                  ],
                ),
              ),
            ),
          ),
        Positioned(left: 0, right: 0, bottom: 14, child: _buildActionRow()),
      ],
    );
  }

  Widget _buildActionRow() {
    final canUndo = !_deciding && _currentIndex > 0 && _lastSwiped != null;
    final canSwipe = !_deciding && _currentIndex < _profiles.length;
    final canSuper = canSwipe && (_superLikePremium || _superLikeRemaining > 0);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Geri Al (Undo)
          _NeonActionButton(
            size: 50,
            backgroundColor: const Color(0xFFFAF7FD),
            border: Border.all(color: const Color(0xFFE879F9), width: 2.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFD946EF).withValues(alpha: 0.55),
                blurRadius: 12,
                spreadRadius: 1,
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.9),
                blurRadius: 4,
                offset: const Offset(-1, -1),
              ),
            ],
            onPressed: () {
              if (canUndo) {
                _handleUndo();
              } else {
                _showUndoNotice();
              }
            },
            tooltip: 'Son profili geri al',
            child: const Icon(
              Icons.rotate_left_rounded,
              color: Color(0xFF7C3AED),
              size: 26,
            ),
          ),
          const SizedBox(width: 12),

          // 2. Geç (Pass - Glowing Neon Magenta)
          _NeonActionButton(
            size: 62,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFFF2E93), Color(0xFFD90368)],
            ),
            border: Border.all(color: const Color(0xFFFF94D2), width: 2.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFFF2E93).withValues(alpha: 0.8),
                blurRadius: 18,
                spreadRadius: 1.5,
              ),
              BoxShadow(
                color: const Color(0xFF9E0B65).withValues(alpha: 0.35),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
            onPressed: () {
              if (_deciding) return;
              if (!canSwipe) {
                _showDeckFinishedNotice();
                return;
              }
              _handleSwipe('left');
            },
            tooltip: 'Geç',
            child: const Icon(
              Icons.close_rounded,
              color: Colors.white,
              size: 32,
            ),
          ),
          const SizedBox(width: 12),

          // 3. Beğen (Like - Glowing Deep Violet / Indigo)
          _NeonActionButton(
            size: 62,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF5B21B6), Color(0xFF3B0764)],
            ),
            border: Border.all(color: const Color(0xFF818CF8), width: 2.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6366F1).withValues(alpha: 0.85),
                blurRadius: 18,
                spreadRadius: 1.5,
              ),
              BoxShadow(
                color: const Color(0xFF311042).withValues(alpha: 0.35),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
            onPressed: () {
              if (_deciding) return;
              if (!canSwipe) {
                _showDeckFinishedNotice();
                return;
              }
              _handleSwipe('right');
            },
            tooltip: 'Beğen',
            child: const Icon(
              Icons.favorite_rounded,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: 12),

          // 4. Süper Beğeni (Super Like with Gold Rim & Crown)
          Stack(
            clipBehavior: Clip.none,
            children: [
              _NeonActionButton(
                size: 50,
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
                ),
                border: Border.all(color: const Color(0xFFF59E0B), width: 2.2),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFBBF24).withValues(alpha: 0.7),
                    blurRadius: 14,
                    spreadRadius: 1,
                  ),
                  BoxShadow(
                    color: const Color(0xFFB45309).withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
                onPressed: () {
                  if (_deciding) return;
                  if (!canSwipe) {
                    _showDeckFinishedNotice();
                    return;
                  }
                  if (!canSuper) {
                    _showSuperLikeNotice();
                    return;
                  }
                  _handleSwipe('super');
                },
                tooltip: _superLikePremium
                    ? 'Süper beğeni · günlük hak'
                    : 'Süper beğeni · $_superLikeRemaining hakkın kaldı',
                child: const Icon(
                  Icons.star_rounded,
                  color: Color(0xFFD97706),
                  size: 28,
                ),
              ),
              const Positioned(
                right: -2,
                top: -5,
                child: Text('👑', style: TextStyle(fontSize: 13)),
              ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  constraints: const BoxConstraints(
                    minWidth: 18,
                    minHeight: 18,
                  ),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFC084FC),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x40000000),
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Text(
                    _superLikePremium ? '∞' : '$_superLikeRemaining',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class InteractiveSwipeCard extends StatefulWidget {
  const InteractiveSwipeCard({
    required this.profile,
    required this.onSwipeLeft,
    required this.onSwipeRight,
    required this.onSwipeUp,
    required this.onShowDetails,
    this.onPhotoError,
    this.disabled = false,
    super.key,
  });

  final DiscoveryProfile profile;
  final VoidCallback onSwipeLeft;
  final VoidCallback onSwipeRight;
  final VoidCallback onSwipeUp;
  final VoidCallback onShowDetails;
  final VoidCallback? onPhotoError;
  final bool disabled;

  @override
  State<InteractiveSwipeCard> createState() => _InteractiveSwipeCardState();
}

class _InteractiveSwipeCardState extends State<InteractiveSwipeCard>
    with SingleTickerProviderStateMixin {
  Offset _dragOffset = Offset.zero;
  Offset _returnFrom = Offset.zero;
  Offset? _departureTarget;
  late final AnimationController _return;
  @override
  void initState() {
    super.initState();
    _return = AnimationController.unbounded(vsync: this)
      ..addListener(() {
        if (mounted) {
          setState(
            () => _dragOffset = _departureTarget == null
                ? _returnFrom * _return.value
                : Offset.lerp(
                    _returnFrom,
                    _departureTarget,
                    Curves.easeOutCubic.transform(
                      _return.value.clamp(0.0, 1.0),
                    ),
                  )!,
          );
        }
      });
  }

  int _photoIndex = 0;
  bool _thresholdNotified = false;

  Future<void> dismiss(String direction) async {
    if (MediaQuery.disableAnimationsOf(context)) return;
    _return.stop();
    _returnFrom = _dragOffset;
    final screen = MediaQuery.sizeOf(context);
    _departureTarget = direction == 'super'
        ? Offset(_dragOffset.dx, -screen.height * 1.2)
        : Offset(
            (direction == 'right' ? 1 : -1) * screen.width * 1.4,
            _dragOffset.dy,
          );
    _return.value = 0;
    try {
      await _return
          .animateTo(1, duration: const Duration(milliseconds: 360))
          .orCancel;
    } on TickerCanceled {
      // A failed request or leaving the screen cancels the departure.
    }
  }

  @override
  void dispose() {
    _return.dispose();
    super.dispose();
  }

  void _onPanUpdate(DragUpdateDetails details) {
    _return.stop();
    setState(() {
      _dragOffset += details.delta;
    });
    if (!_thresholdNotified &&
        (_dragOffset.dx.abs() > 105 || _dragOffset.dy < -140)) {
      _thresholdNotified = true;
      if (!MediaQuery.disableAnimationsOf(context)) {
        HapticFeedback.selectionClick();
      }
    }
  }

  void _onPanEnd(DragEndDetails details) {
    final dx = _dragOffset.dx;
    final dy = _dragOffset.dy;

    if (dx > 105) {
      widget.onSwipeRight();
      if (_departureTarget == null) {
        _returnToRest(details.velocity.pixelsPerSecond);
      }
      return;
    } else if (dx < -105) {
      widget.onSwipeLeft();
      if (_departureTarget == null) {
        _returnToRest(details.velocity.pixelsPerSecond);
      }
      return;
    } else if (dy < -140) {
      widget.onSwipeUp();
      if (_departureTarget == null) {
        _returnToRest(details.velocity.pixelsPerSecond);
      }
      return;
    }
    _returnToRest(details.velocity.pixelsPerSecond);
  }

  void _returnToRest([Offset velocity = Offset.zero]) {
    _thresholdNotified = false;
    _return.stop();
    _departureTarget = null;
    _returnFrom = _dragOffset;
    if (MediaQuery.disableAnimationsOf(context)) {
      setState(() => _dragOffset = Offset.zero);
    } else {
      _return
          .animateWith(
            SpringSimulation(
              const SpringDescription(mass: 1, stiffness: 250, damping: 26),
              1,
              0,
              _returnFrom.distanceSquared == 0
                  ? 0
                  : ((velocity.dx * _returnFrom.dx +
                                velocity.dy * _returnFrom.dy) /
                            _returnFrom.distanceSquared)
                        .clamp(-4.0, 4.0),
            ),
          )
          .then((_) {
            if (mounted) setState(() => _dragOffset = Offset.zero);
          });
    }
  }

  void _nextPhoto() {
    final photos = widget.profile.allPhotos;
    if (_photoIndex >= photos.length - 1) {
      widget.onShowDetails();
    } else {
      setState(() => _photoIndex++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.profile.allPhotos;
    final currentPhoto = photos.isNotEmpty && _photoIndex < photos.length
        ? photos[_photoIndex]
        : widget.profile.image;
    final cardCacheWidth =
        (MediaQuery.sizeOf(context).width *
                MediaQuery.devicePixelRatioOf(context))
            .round();

    final angle = (_dragOffset.dx * 0.0005).clamp(-0.12, 0.12);

    return LayoutBuilder(
      builder: (context, constraints) => GestureDetector(
        onPanUpdate: widget.disabled ? null : _onPanUpdate,
        onPanEnd: widget.disabled ? null : _onPanEnd,
        onPanCancel: () => _returnToRest(),
        child: Transform.translate(
          offset: _dragOffset,
          child: Transform.rotate(
            angle: angle,
            child: Container(
              decoration: BoxDecoration(
                color: photoDark,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: line),
                boxShadow: [
                  BoxShadow(
                    color: shadowInk.withValues(alpha: 0.10),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Photo
                    if (currentPhoto.isNotEmpty)
                      RepaintBoundary(
                        child: Image.network(
                          currentPhoto,
                          fit: BoxFit.cover,
                          cacheWidth: cardCacheWidth,
                          frameBuilder: (context, child, frame, synchronous) =>
                              frame == null
                              ? const Center(
                                  child: SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: champagne,
                                    ),
                                  ),
                                )
                              : child,
                          errorBuilder: (context, error, stackTrace) {
                            widget.onPhotoError?.call();
                            return const Center(
                              child: Icon(Icons.person, size: 80, color: muted),
                            );
                          },
                        ),
                      )
                    else
                      const Center(
                        child: Icon(Icons.person, size: 80, color: muted),
                      ),

                    // Tap areas for photo switching
                    Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.translucent,
                            onTap: _nextPhoto,
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.translucent,
                            onTap: _nextPhoto,
                          ),
                        ),
                      ],
                    ),

                    // Gradient Dark Overlay
                    const IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            stops: [0.0, 0.40, 0.68, 1.0],
                            colors: [
                              Colors.transparent,
                              Colors.transparent,
                              photoScrimMiddle,
                              photoScrimEnd,
                            ],
                          ),
                        ),
                      ),
                    ),

                    // Photo Indicators (Stories-style)
                    if (photos.isNotEmpty)
                      Positioned(
                        top: 12,
                        left: 16,
                        right: 16,
                        child: Row(
                          children: List.generate(
                            photos.length,
                            (i) => Expanded(
                              child: Container(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 2,
                                ),
                                height: 3,
                                decoration: BoxDecoration(
                                  color: i == _photoIndex
                                      ? champagne
                                      : Colors.white.withValues(alpha: 0.35),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                    if (widget.profile.details['compatibility'] != null ||
                        widget.profile.details['matchPercent'] != null)
                      Positioned(
                        top: 28,
                        left: 18,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: .48),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: .28),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.favorite,
                                color: Colors.white,
                                size: 15,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '${widget.profile.details['compatibility'] ?? widget.profile.details['matchPercent']}% Uyum',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Positioned(
                      top: 26,
                      right: 14,
                      child: IconButton(
                        tooltip: 'Daha fazla',
                        onPressed: widget.onShowDetails,
                        icon: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: const BoxDecoration(
                            color: Colors.black45,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.more_horiz,
                            color: Colors.white,
                            size: 19,
                          ),
                        ),
                      ),
                    ),

                    // Profile Info Bottom
                    Positioned(
                      left: 18,
                      right: 18,
                      bottom: 96,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${widget.profile.name}, ${widget.profile.age}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontFamily: 'CormorantGaramond',
                                    fontSize: 34,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              if (widget.profile.verified) ...[
                                const SizedBox(width: 8),
                                const Icon(
                                  Icons.verified,
                                  color: verifiedBlue,
                                  size: 22,
                                ),
                              ],
                              IconButton(
                                tooltip: 'Profili incele',
                                onPressed: widget.onShowDetails,
                                icon: Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: const BoxDecoration(
                                    color: Colors.black45,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.info_outline,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: widget.profile.presence.isOnline
                                      ? const Color(0xFF22C55E)
                                      : widget.profile.presence.label ==
                                                'Az önce aktifti' ||
                                            widget.profile.presence.label
                                                .contains('dk önce')
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFF94A3B8),
                                  shape: BoxShape.circle,
                                  boxShadow: widget.profile.presence.isOnline
                                      ? [
                                          BoxShadow(
                                            color: const Color(
                                              0xFF22C55E,
                                            ).withValues(alpha: 0.7),
                                            blurRadius: 6,
                                            spreadRadius: 1,
                                          ),
                                        ]
                                      : null,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  widget.profile.presence.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: widget.profile.presence.isOnline
                                        ? const Color(0xFF4ADE80)
                                        : widget.profile.presence.label ==
                                                  'Az önce aktifti' ||
                                              widget.profile.presence.label
                                                  .contains('dk önce')
                                        ? const Color(0xFFFBBF24)
                                        : Colors.white.withValues(alpha: 0.85),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                              if (widget.profile.distance.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                Text(
                                  '·',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.6),
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  widget.profile.distance,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (widget.profile.prompt.isNotEmpty ||
                              widget.profile.answer.isNotEmpty) ...[
                            const SizedBox(height: 5),
                            if (widget.profile.prompt.isNotEmpty)
                              Text(
                                widget.profile.prompt,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.85),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            if (widget.profile.answer.isNotEmpty)
                              Text(
                                widget.profile.answer,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                          ],
                          if (widget.profile.details['voiceUrl'] is String &&
                              constraints.maxHeight > 400)
                            Row(
                              children: [
                                const Icon(
                                  Icons.mic_none,
                                  color: champagne,
                                  size: 16,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    '${widget.profile.details['voicePrompt'] ?? 'Sesli biyografi'}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                VoicePlayer(
                                  url: '${widget.profile.details['voiceUrl']}',
                                  durationMs:
                                      (widget.profile.details['voiceDurationMs']
                                              as num?)
                                          ?.toInt(),
                                  foreground: Colors.white,
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),

                    // Swipe Stamp: BEĞEN (Right)
                    if (_dragOffset.dx > 40)
                      Positioned(
                        top: 40,
                        left: 30,
                        child: Transform.rotate(
                          angle: -0.2,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(color: like, width: 3),
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.black45,
                            ),
                            child: const Text(
                              'BEĞEN',
                              style: TextStyle(
                                color: like,
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2,
                              ),
                            ),
                          ),
                        ),
                      ),

                    // Swipe Stamp: PAS (Left)
                    if (_dragOffset.dx < -40)
                      Positioned(
                        top: 40,
                        right: 30,
                        child: Transform.rotate(
                          angle: 0.2,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(color: ruby, width: 3),
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.black45,
                            ),
                            child: const Text(
                              'GEÇ',
                              style: TextStyle(
                                color: ruby,
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2,
                              ),
                            ),
                          ),
                        ),
                      ),

                    // Swipe Stamp: SÜPER (Up)
                    if (_dragOffset.dy < -50 && _dragOffset.dx.abs() < 50)
                      Positioned(
                        bottom: 120,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(color: gold, width: 3),
                              borderRadius: BorderRadius.circular(12),
                              color: Colors.black45,
                            ),
                            child: const Text(
                              'SÜPER BEĞENİ',
                              style: TextStyle(
                                color: gold,
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NeonActionButton extends StatelessWidget {
  const _NeonActionButton({
    required this.size,
    required this.child,
    this.backgroundColor,
    this.gradient,
    this.border,
    this.boxShadow,
    this.onPressed,
    this.tooltip,
  });

  final double size;
  final Widget child;
  final Color? backgroundColor;
  final Gradient? gradient;
  final BoxBorder? border;
  final List<BoxShadow>? boxShadow;
  final VoidCallback? onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final isEnabled = onPressed != null;
    Widget button = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: gradient == null ? (backgroundColor ?? Colors.white) : null,
        gradient: gradient,
        shape: BoxShape.circle,
        border: border,
        boxShadow: isEnabled ? boxShadow : null,
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          splashColor: Colors.white.withValues(alpha: 0.25),
          highlightColor: Colors.white.withValues(alpha: 0.15),
          child: Center(
            child: Opacity(opacity: isEnabled ? 1.0 : 0.45, child: child),
          ),
        ),
      ),
    );

    if (tooltip != null) {
      button = Tooltip(message: tooltip!, child: button);
    }
    return button;
  }
}
