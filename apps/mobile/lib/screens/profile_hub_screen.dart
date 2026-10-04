import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api.dart';
import '../models.dart';
import '../profile_photo_picker.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';
import 'noir_screen.dart';
import 'onboarding_screen.dart';
import 'verification_screen.dart';
import 'member_tools_screen.dart';
import 'profile_detail_screen.dart';
import 'voice_message.dart';

class ProfileHubScreen extends StatefulWidget {
  const ProfileHubScreen({
    super.key,
    this.api,
    this.onNavigateToMatches,
    this.onNavigateToLikes,
    this.onNavigateToVisitors,
    this.settingsOnly = false,
  });

  final bool settingsOnly;
  final VoidCallback? onNavigateToMatches;
  final VoidCallback? onNavigateToLikes;
  final LovaskApi? api;
  final VoidCallback? onNavigateToVisitors;

  @override
  State<ProfileHubScreen> createState() => _ProfileHubScreenState();
}

class _ProfileHubScreenState extends State<ProfileHubScreen> {
  late final api = widget.api ?? LovaskApi();
  bool _loading = true;
  String? _error;

  Widget _settingRow({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback? onTap,
    Color color = pearl,
  }) => InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: panelLight,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 21),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(color: color, fontWeight: FontWeight.w700),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: muted),
        ],
      ),
    ),
  );

  Map<String, dynamic>? _profileData;
  Map<String, dynamic>? _voiceBio;
  List<Map<String, dynamic>> _photos = [];
  bool? _isDiscoverable;
  bool _ghostEnabled = false;
  bool _ghostAvailable = false;
  bool _updatingGhost = false;
  bool _isNoir = false;
  Map<String, dynamic>? _boost;
  bool _boostBusy = false;
  String? _noirUntil;
  int _likesCount = 0;
  int _visitorsCount = 0;
  int _matchCount = 0;
  bool _updatingDiscoverable = false;

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        api.profile(),
        api.likes(),
        api.visitors(),
        api.noir(),
        api.accountState(),
        api.conversations(),
        api.voiceBio().catchError((_) => <String, dynamic>{}),
        api.boostStatus().catchError((_) => <String, dynamic>{}),
      ]);

      final profRes = results[0];
      final likesRes = results[1];
      final visitorsRes = results[2];

      final p = profRes['profile'] as Map<String, dynamic>? ?? profRes;
      final rawPhotos = p['photos'] as List<dynamic>? ?? [];

      final noirDate = results[3]['noirUntil'] as String?;
      final isNoirActive =
          noirDate != null &&
          DateTime.tryParse(noirDate)?.isAfter(DateTime.now()) == true;

      if (mounted) {
        setState(() {
          _profileData = {
            ...p,
            ...?results[4]['profile'] as Map<String, dynamic>?,
          };
          _voiceBio = results[6]['voice'] as Map<String, dynamic>?;
          _boost = results[7].isEmpty ? null : results[7];
          _matchCount = (results[5]['conversations'] as List? ?? [])
              .where((c) => c['matched'] == true)
              .length;
          _photos = rawPhotos.whereType<Map<String, dynamic>>().toList();
          _isDiscoverable = results[4]['profile']?['is_discoverable'] as bool?;
          _ghostEnabled = results[4]['profile']?['ghost_enabled'] == true;
          _ghostAvailable = results[4]['ghostAvailable'] == true;
          _isNoir = isNoirActive;
          _noirUntil = noirDate;
          _likesCount = (likesRes['count'] as num?)?.toInt() ?? 0;
          _visitorsCount = (visitorsRes['count'] as num?)?.toInt() ?? 0;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _openVoiceBio() async {
    const prompts = [
      'Bir akşam yemeğine çıksak…',
      'Beni güldürmenin yolu…',
      'Benimle ilgili şaşıracağın şey…',
    ];
    var selected = prompts.contains(_voiceBio?['prompt'])
        ? '${_voiceBio!['prompt']}'
        : prompts.first;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: selected,
                decoration: const InputDecoration(labelText: 'Sesli soru'),
                items: prompts
                    .map(
                      (item) =>
                          DropdownMenuItem(value: item, child: Text(item)),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value != null) setSheetState(() => selected = value);
                },
              ),
              const SizedBox(height: 12),
              VoiceComposer(
                key: ValueKey(selected),
                profileId: '${_profileData?['id'] ?? ''}',
                bioPrompt: selected,
                onSent: () {
                  Navigator.pop(sheetContext);
                  _loadProfileData();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _removeVoiceBio() async {
    try {
      await api.deleteVoiceBio();
      if (mounted) setState(() => _voiceBio = null);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text('$error'),
          ),
        );
      }
    }
  }

  Future<void> _toggleDiscoverable(bool val) async {
    setState(() => _updatingDiscoverable = true);
    try {
      await api.setDiscoverable(val);
      if (mounted) {
        setState(() => _isDiscoverable = val);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text(
              val
                  ? 'Profiliniz keşfette görünür yapıldı.'
                  : 'Profiliniz keşfetten gizlendi.',
              style: const TextStyle(color: ink2),
            ),
            backgroundColor: panelLight,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 6),
            content: Text('Ayar kaydedilemedi.'),
            backgroundColor: ruby,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updatingDiscoverable = false);
    }
  }

  Future<void> _activateBoost() async {
    if (_boostBusy || _boost?['canActivate'] != true) return;
    setState(() => _boostBusy = true);
    try {
      final status = await api.activateBoost();
      if (!mounted) return;
      setState(() => _boost = status);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          duration: Duration(seconds: 6),
          content: Text(
            'Boost başladı. Profilin 30 dakika boyunca keşifte daha fazla görünme şansına sahip.',
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text('$error'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _boostBusy = false);
    }
  }

  String get _boostSubtitle {
    final active = DateTime.tryParse(
      '${_boost?['activeUntil'] ?? ''}',
    )?.toLocal();
    if (active != null && active.isAfter(DateTime.now())) {
      return '${active.day}.${active.month}.${active.year} ${active.hour.toString().padLeft(2, '0')}:${active.minute.toString().padLeft(2, '0')} tarihine kadar aktif';
    }
    final next = DateTime.tryParse(
      '${_boost?['nextAvailableAt'] ?? ''}',
    )?.toLocal();
    if (next != null && next.isAfter(DateTime.now())) {
      return 'Yeni hak: ${next.day}.${next.month}.${next.year}';
    }
    if (!_isNoir) return 'Noir üyelerine haftada bir 30 dakika';
    if (_boost?['eligible'] != true) {
      return 'Profili görünür yap, Hayalet Modu kapat ve fotoğraf ekle';
    }
    return 'Keşifte daha fazla görünme şansı';
  }

  Future<void> _toggleGhost(bool val) async {
    setState(() => _updatingGhost = true);
    try {
      await api.setGhostMode(val);
      if (mounted) setState(() => _ghostEnabled = val);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text('$error'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updatingGhost = false);
    }
  }

  Future<void> _uploadNewPhoto() async {
    final XFile? image;
    try {
      image = await pickCroppedProfilePhoto();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 6),
            content: Text(
              'Fotoğraf seçilemedi veya kırpılamadı. Başka bir fotoğraf dene.',
            ),
            backgroundColor: ruby,
          ),
        );
      }
      return;
    }
    if (image == null || !mounted) return;
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          duration: Duration(seconds: 6),
          content: Text('Fotoğraf yükleniyor…'),
        ),
      );
      await api.uploadPhoto(image);
      await _loadProfileData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 6),
            content: Text('Fotoğraf başarıyla eklendi!'),
            backgroundColor: wine,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text(
              e is LovaskApiException
                  ? e.message ?? 'Yükleme başarısız.'
                  : 'Fotoğraf yüklenemedi.',
            ),
            backgroundColor: ruby,
          ),
        );
      }
    }
  }

  Future<void> _deletePhoto(String photoId) async {
    try {
      await api.deletePhoto(photoId);
      await _loadProfileData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 6),
            content: Text('Fotoğraf kaldırıldı.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text(
              e is LovaskApiException
                  ? e.message ?? 'Fotoğraf silinemedi.'
                  : 'Silme başarısız.',
            ),
            backgroundColor: ruby,
          ),
        );
      }
    }
  }

  void _showDeleteAccountDialog() {
    final confirmationController = TextEditingController();
    showLovaskSheet(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Hesap silme talebi',
            style: TextStyle(
              color: ruby,
              fontFamily: 'Manrope',
              fontSize: 28,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Profilin keşfetten kaldırılır. Verilerin 30 günlük kurtarma süresinden sonra silinir. Bu süre içinde hesabına girip talebi iptal edebilirsin. Onaylamak için HESABIMI SİL yaz.',
            style: TextStyle(color: pearl, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: confirmationController,
            decoration: const InputDecoration(hintText: 'HESABIMI SİL'),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Vazgeç', style: TextStyle(color: muted)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: ruby),
                  onPressed: () async {
                    if (confirmationController.text.trim() == 'HESABIMI SİL') {
                      Navigator.pop(ctx);
                      try {
                        await api.deleteAccount();
                        await Supabase.instance.client.auth.signOut();
                      } catch (_) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              duration: Duration(seconds: 6),
                              content: Text('Hesap silme başarısız.'),
                              backgroundColor: ruby,
                            ),
                          );
                        }
                      }
                    }
                  },
                  child: const Text('Hesabımı sil'),
                ),
              ),
            ],
          ),
        ],
      ),
    ).whenComplete(confirmationController.dispose);
  }

  void _showSupportDialog() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const MemberToolsScreen(section: 'support'),
      ),
    );
  }

  void _openEditProfileSheet() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (ctx) => OnboardingScreen(
          initialProfile: _profileData,
          onCompleted: () => Navigator.pop(ctx),
        ),
      ),
    ).then((_) {
      if (mounted) _loadProfileData();
    });
  }

  void _openSettings() => Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => ProfileHubScreen(api: api, settingsOnly: true),
    ),
  );

  List<Widget> _settingsContent() => [
    const LovaskHero(
      eyebrow: 'KONTROL SENDE',
      title: 'Kendi alanın.',
      subtitle: 'Nasıl görüneceğine, kimlerden haber alacağına sen karar ver.',
    ),
    const SizedBox(height: 24),
    // Settings Hub
    const Text(
      'Gizlilik ve hesap',
      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: pearl),
    ),
    const SizedBox(height: 12),
    Material(
      color: panel,
      shape: RoundedRectangleBorder(
        borderRadius: LovaskRadius.portrait,
        side: const BorderSide(color: line),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.visibility_outlined, color: ruby, size: 21),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Keşfette görün',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: pearl,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _isDiscoverable == null
                            ? 'Görünürlük bilgisi alınamadı.'
                            : 'Kapalıyken yeni üyelere önerilmezsin.',
                        style: const TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _isDiscoverable ?? false,
                  onChanged: _updatingDiscoverable || _isDiscoverable == null
                      ? null
                      : _toggleDiscoverable,
                ),
              ],
            ),
          ),
          Divider(color: Colors.white.withValues(alpha: 0.06), height: 1),
          ListTile(
            leading: const Icon(Icons.visibility_off_outlined, color: ruby),
            title: const Text('Hayalet Modu'),
            subtitle: Text(
              _ghostAvailable
                  ? 'Yalnızca beğendiğin kişilere görün.'
                  : 'Noir üyelerine özel.',
            ),
            trailing: Switch(
              value: _ghostEnabled && _ghostAvailable,
              onChanged: !_ghostAvailable || _updatingGhost
                  ? null
                  : _toggleGhost,
            ),
          ),
          Divider(color: Colors.white.withValues(alpha: 0.06), height: 1),
          _settingRow(
            icon: Icons.help_outline,
            title: 'Destek Merkezi',
            subtitle: 'Soruların ve destek taleplerin',
            onTap: _showSupportDialog,
          ),
          _settingRow(
            icon: Icons.verified_outlined,
            title: 'Hesabını doğrula',
            subtitle: 'Selfie ve iletişim doğrulaması',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const VerificationScreen()),
            ),
          ),
          for (final section in const {
            'blocked': 'Engellenen profiller',
            'referrals': 'Arkadaşını davet et',
            'notifications': 'Bildirim tercihleri',
          }.entries)
            _settingRow(
              icon: section.key == 'blocked'
                  ? Icons.block_outlined
                  : section.key == 'referrals'
                  ? Icons.card_giftcard_outlined
                  : Icons.notifications_none,
              title: section.value,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => MemberToolsScreen(section: section.key),
                ),
              ),
            ),
          Divider(color: Colors.white.withValues(alpha: 0.06), height: 1),
          _settingRow(
            icon: Icons.logout,
            title: 'Oturumu kapat',
            onTap: () async {
              await Supabase.instance.client.auth.signOut();
            },
            color: ruby,
          ),
          Divider(color: Colors.white.withValues(alpha: 0.06), height: 1),
          _settingRow(
            icon: Icons.delete_forever,
            title: 'Hesabımı sil',
            onTap: _showDeleteAccountDialog,
            color: ruby,
          ),
        ],
      ),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: gold)),
      );
    }

    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: const TextStyle(color: ruby)),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _loadProfileData,
                child: const Text('Tekrar Dene'),
              ),
            ],
          ),
        ),
      );
    }

    if (widget.settingsOnly) {
      return Scaffold(
        appBar: AppBar(title: const Text('Ayarlar')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          children: _settingsContent(),
        ),
      );
    }

    final name =
        '${_profileData?['displayName'] ?? _profileData?['name'] ?? 'Profilim'}';
    final city = '${_profileData?['city'] ?? ''}';
    final birth = DateTime.tryParse('${_profileData?['birthDate']}');
    final now = DateTime.now();
    final age = birth == null
        ? ''
        : now.year -
              birth.year -
              ((now.month < birth.month ||
                      (now.month == birth.month && now.day < birth.day))
                  ? 1
                  : 0);
    final primaryPhoto = _photos.firstWhere(
      (p) => p['is_primary'] == true,
      orElse: () => _photos.isNotEmpty ? _photos.first : const {},
    );
    final avatarUrl = '${primaryPhoto['url'] ?? primaryPhoto['image'] ?? ''}';
    final completedFields = [
      name.isNotEmpty && name != 'Profilim',
      city.isNotEmpty,
      (_profileData?['gender'] ?? '').toString().isNotEmpty,
      avatarUrl.isNotEmpty,
      (_profileData?['answer'] ?? '').toString().isNotEmpty,
    ].where((complete) => complete).length;

    Widget buildAppBarAction({
      required IconData icon,
      required String tooltip,
      required VoidCallback onPressed,
    }) {
      return Container(
        width: 38,
        height: 38,
        margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFF9F5FC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEFE5F5)),
        ),
        child: IconButton(
          icon: Icon(icon, size: 18, color: const Color(0xFF381F46)),
          tooltip: tooltip,
          padding: EdgeInsets.zero,
          onPressed: onPressed,
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profilim',
          style: TextStyle(
            fontFamily: 'CormorantGaramond',
            fontSize: 28,
            fontWeight: FontWeight.w600,
            color: Color(0xFF28183E),
          ),
        ),
        actions: [
          buildAppBarAction(
            icon: Icons.ios_share_outlined,
            tooltip: 'Davet et',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const MemberToolsScreen(section: 'referrals'),
              ),
            ),
          ),
          buildAppBarAction(
            icon: Icons.edit_outlined,
            tooltip: 'Profili düzenle',
            onPressed: _openEditProfileSheet,
          ),
          buildAppBarAction(
            icon: Icons.settings_outlined,
            tooltip: 'Ayarlar',
            onPressed: _openSettings,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        color: gold,
        onRefresh: _loadProfileData,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
          children: [
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                gradient: orbitGradient,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: champagne.withValues(alpha: .20)),
                boxShadow: cardShadow,
              ),
              child: Stack(
                children: [
                  Positioned(
                    top: -45,
                    right: -45,
                    child: LovaskOrbit(
                      size: 200,
                      color: champagne.withValues(alpha: .10),
                    ),
                  ),
                  Positioned(
                    top: 22,
                    right: 22,
                    child: Icon(
                      Icons.favorite,
                      size: 38,
                      color: Colors.white.withValues(alpha: .10),
                    ),
                  ),
                  Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
                        child: Row(
                          children: [
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(2.5),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: const Color(0xFFA855F7),
                                      width: 2.5,
                                    ),
                                  ),
                                  child: ClipOval(
                                    child: SizedBox(
                                      width: 86,
                                      height: 86,
                                      child: avatarUrl.isNotEmpty
                                          ? Image.network(
                                              avatarUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder: (_, _, _) =>
                                                  const LovaskOrbit(size: 80),
                                            )
                                          : const LovaskOrbit(size: 80),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  right: 3,
                                  bottom: 3,
                                  child: Container(
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF22C55E),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: const Color(0xFF381F46),
                                        width: 2.5,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'BENİM HİKÂYEM',
                                    style: TextStyle(
                                      color: Color(0xFFE9D5FF),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    age != '' ? '$name, $age' : name,
                                    style: const TextStyle(
                                      fontFamily: 'CormorantGaramond',
                                      fontSize: 27,
                                      color: moon,
                                      height: 1.05,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (_profileData?['verified'] == true)
                                    const Padding(
                                      padding: EdgeInsets.only(top: 4),
                                      child: Icon(
                                        Icons.verified_outlined,
                                        color: verifiedBlue,
                                        size: 17,
                                      ),
                                    ),
                                  if (city.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.location_on_outlined,
                                          color: moon,
                                          size: 13,
                                        ),
                                        const SizedBox(width: 4),
                                        Flexible(
                                          child: Text(
                                            city,
                                            style: const TextStyle(
                                              color: champagne,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                  if (_isNoir) ...[
                                    const SizedBox(height: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 9,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(
                                          999,
                                        ),
                                        border: Border.all(color: noirGold),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          LovaskCrown(
                                            size: 14,
                                            color: noirGold,
                                          ),
                                          SizedBox(width: 5),
                                          Flexible(
                                            child: Text(
                                              'Noir Üye',
                                              style: TextStyle(
                                                color: moon,
                                                fontSize: 11,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        child: Center(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(
                              backgroundColor: moon,
                              foregroundColor: photoDark,
                              minimumSize: const Size(170, 40),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 8,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                              ),
                              textStyle: const TextStyle(
                                fontFamily: 'Manrope',
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            label: const Text('Profilimi önizle'),
                            icon: const Icon(
                              Icons.visibility_outlined,
                              size: 17,
                            ),
                            onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ProfileDetailScreen(
                                  preview: true,
                                  api: api,
                                  profile: DiscoveryProfile(
                                    id: '${_profileData?['id'] ?? ''}',
                                    name: name,
                                    age: age is int ? age : 0,
                                    city: city,
                                    image: avatarUrl,
                                    photos: _photos
                                        .map(
                                          (photo) =>
                                              '${photo['url'] ?? photo['image'] ?? ''}',
                                        )
                                        .where((url) => url.isNotEmpty)
                                        .toList(),
                                    prompt: '${_profileData?['prompt'] ?? ''}',
                                    answer: '${_profileData?['answer'] ?? ''}',
                                    badges:
                                        (_profileData?['badgeSlugs'] as List? ??
                                                [])
                                            .map(
                                              (slug) =>
                                                  badgeOptions[slug] ?? '$slug',
                                            )
                                            .toList(),
                                    details: {
                                      ...?_profileData,
                                      'voicePrompt': _voiceBio?['prompt'],
                                      'voiceUrl': _voiceBio?['audioUrl'],
                                      'voiceDurationMs':
                                          _voiceBio?['durationMs'],
                                    },
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                for (final stat in [
                  (
                    title: 'Eşleşme',
                    count: _matchCount,
                    onTap: widget.onNavigateToMatches,
                    icon: Icons.favorite,
                  ),
                  (
                    title: 'Beğeni',
                    count: _likesCount,
                    onTap: widget.onNavigateToLikes,
                    icon: Icons.favorite_border_rounded,
                  ),
                  (
                    title: 'Ziyaret',
                    count: _visitorsCount,
                    onTap: widget.onNavigateToVisitors,
                    icon: Icons.visibility_outlined,
                  ),
                ])
                  Expanded(
                    child: InkWell(
                      onTap: stat.onTap,
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFF0E5F5)),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x0A552070),
                              blurRadius: 8,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              decoration: const BoxDecoration(
                                color: Color(0xFFF3E8FA),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                stat.icon,
                                color: const Color(0xFF7839A6),
                                size: 17,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${stat.count}',
                                    style: const TextStyle(
                                      fontFamily: 'CormorantGaramond',
                                      fontSize: 22,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF28183E),
                                      height: 1.05,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    stat.title,
                                    style: const TextStyle(
                                      color: Color(0xFF7A688A),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            LovaskSurface(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      const LovaskEyebrow('PROFİL BİLGİLERİN'),
                      Text(
                        '%${completedFields * 20} tamamlandı',
                        style: const TextStyle(color: muted, fontSize: 11),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: completedFields / 5,
                      minHeight: 6,
                      color: ruby,
                      backgroundColor: panelLight,
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (final entry in [
                    ('İsim', name, Icons.person_outline),
                    (
                      'Şehir',
                      city.isEmpty ? 'Şehir seç' : city,
                      Icons.location_on_outlined,
                    ),
                    (
                      'Cinsiyet',
                      genderOptions[_profileData?['gender']] ?? 'Cinsiyet seç',
                      Icons.person_search_outlined,
                    ),
                  ]) ...[
                    const SizedBox(height: 5),
                    Material(
                      color: ink,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: const BorderSide(color: lineSoft),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10,
                        ),
                        minVerticalPadding: 8,
                        leading: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: panelLight,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(entry.$3, size: 18, color: wine),
                        ),
                        title: Text(
                          entry.$1,
                          style: const TextStyle(color: muted, fontSize: 12),
                        ),
                        subtitle: Text(
                          entry.$2,
                          style: const TextStyle(
                            color: pearl,
                            fontSize: 20,
                            fontFamily: 'CormorantGaramond',
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        trailing: const Icon(
                          Icons.edit_outlined,
                          size: 18,
                          color: ruby,
                        ),
                        onTap: _openEditProfileSheet,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: panel,
                border: Border.all(color: line),
                borderRadius: LovaskRadius.portrait,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Hakkımda',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Profili düzenle',
                        onPressed: _openEditProfileSheet,
                        icon: const Icon(
                          Icons.edit_outlined,
                          color: pearl,
                          size: 19,
                        ),
                      ),
                    ],
                  ),
                  if ((_profileData?['answer'] ?? '')
                      .toString()
                      .isNotEmpty) ...[
                    Text(
                      '${_profileData?['prompt'] ?? ''}',
                      style: const TextStyle(color: muted, fontSize: 12),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${_profileData?['answer']}',
                      style: const TextStyle(
                        fontSize: 15,
                        color: pearl,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  const SizedBox(height: 12),
                  Text(
                    'Sesli biyografi',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (_voiceBio != null) ...[
                    Text(
                      '${_voiceBio!['prompt']}',
                      style: const TextStyle(color: muted, fontSize: 12),
                    ),
                    VoicePlayer(
                      url: '${_voiceBio!['audioUrl']}',
                      durationMs: (_voiceBio!['durationMs'] as num?)?.toInt(),
                    ),
                  ],
                  Row(
                    children: [
                      TextButton.icon(
                        onPressed: _openVoiceBio,
                        icon: const Icon(Icons.mic_none),
                        label: Text(
                          _voiceBio == null ? 'Ses kaydet' : 'Yeniden kaydet',
                        ),
                      ),
                      if (_voiceBio != null)
                        IconButton(
                          tooltip: 'Sesli biyografiyi sil',
                          onPressed: _removeVoiceBio,
                          icon: const Icon(Icons.delete_outline),
                        ),
                    ],
                  ),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final slug
                          in _profileData?['badgeSlugs'] as List? ?? [])
                        LovaskPill(badgeOptions[slug] ?? '$slug'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            LovaskSurface(
              radius: 16,
              padding: EdgeInsets.zero,
              child: _settingRow(
                icon: Icons.visibility_outlined,
                title: 'Profil ziyaretçileri',
                subtitle: '$_visitorsCount kişi profilini ziyaret etti',
                onTap: widget.onNavigateToVisitors,
                color: ruby,
              ),
            ),
            const SizedBox(height: 12),
            // Photos Gallery
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Fotoğraflarım',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: pearl,
                  ),
                ),
                if (_photos.length < 6)
                  TextButton.icon(
                    onPressed: _uploadNewPhoto,
                    icon: const Icon(Icons.add_a_photo, size: 18, color: gold),
                    label: const Text('Ekle', style: TextStyle(color: gold)),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 0.8,
              ),
              itemCount: _photos.length + (_photos.length < 6 ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _photos.length) {
                  return GestureDetector(
                    onTap: _uploadNewPhoto,
                    child: Container(
                      decoration: BoxDecoration(
                        color: panel,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: gold.withValues(alpha: 0.3),
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add, color: gold, size: 32),
                          SizedBox(height: 4),
                          Text(
                            'Fotoğraf',
                            style: TextStyle(color: muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final photo = _photos[index];
                final url = '${photo['url'] ?? photo['image'] ?? ''}';
                final photoId = '${photo['id'] ?? ''}';

                return Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        url,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => Container(
                          color: panelLight,
                          child: const Icon(Icons.broken_image, color: muted),
                        ),
                      ),
                    ),
                    if (photoId.isNotEmpty)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () => _deletePhoto(photoId),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              color: ruby,
                              size: 16,
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
            const SizedBox(height: 28),

            // Noir Club Card
            GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const NoirScreen()),
              ).then((_) => _loadProfileData()),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: noirSurface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: gold.withValues(alpha: 0.4),
                    width: 1.5,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: gold.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Center(child: LovaskCrown(size: 28)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isNoir
                                ? 'Noir Kulübü (Aktif)'
                                : 'Lovask Noir Kulübü',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: pearl,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _isNoir
                                ? 'Bitiş: ${_noirUntil?.split("T").first ?? ""} · Haftalık Boost'
                                : 'Beğenenleri ve ziyaretçileri gör, sınırsız keşfet ve haftalık Boost kullan.',
                            style: const TextStyle(color: pearl, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios, color: gold, size: 16),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            if (_boost != null) ...[
              LovaskSurface(
                padding: EdgeInsets.zero,
                child: _settingRow(
                  icon: Icons.bolt,
                  title: _boostBusy ? 'Boost başlatılıyor…' : '30 dakika Boost',
                  subtitle: _boostSubtitle,
                  color: gold,
                  onTap: _boostBusy
                      ? null
                      : _boost?['canActivate'] == true
                      ? () => _activateBoost()
                      : !_isNoir
                      ? () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const NoirScreen()),
                        ).then((_) => _loadProfileData())
                      : null,
                ),
              ),
              const SizedBox(height: 24),
            ],

            if (_profileData?['xp'] != null && _profileData?['level'] != null)
              Container(
                margin: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ink,
                  border: Border.all(color: lineSoft),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${_profileData!['xp']} XP',
                      style: const TextStyle(color: ruby),
                    ),
                    Text(
                      'Seviye ${_profileData!['level']}',
                      style: const TextStyle(color: muted),
                    ),
                  ],
                ),
              ),

            LovaskSurface(
              padding: EdgeInsets.zero,
              child: _settingRow(
                icon: Icons.tune_outlined,
                title: 'Ayarlar',
                subtitle: 'Gizlilik, bildirimler ve hesabın',
                onTap: _openSettings,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
