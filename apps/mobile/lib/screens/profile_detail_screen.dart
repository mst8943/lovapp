import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';
import 'chat_screen.dart';
import 'safety_sheet.dart';
import 'preferences_screen.dart' show preferenceChoices;
import 'voice_message.dart';

Future<void> openProfileDetails(
  BuildContext context,
  DiscoveryProfile profile,
) => Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => ProfileDetailScreen(profile: profile)),
);

class LovaskPhotoViewer extends StatefulWidget {
  const LovaskPhotoViewer({
    super.key,
    required this.photos,
    this.initialIndex = 0,
  });
  final List<String> photos;
  final int initialIndex;
  @override
  State<LovaskPhotoViewer> createState() => _LovaskPhotoViewerState();
}

class _LovaskPhotoViewerState extends State<LovaskPhotoViewer> {
  late final controller = PageController(initialPage: widget.initialIndex);
  late int index = widget.initialIndex;
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: photoDark,
    body: SafeArea(
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Fotoğrafları kapat',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
              Expanded(
                child: Row(
                  children: List.generate(
                    widget.photos.length,
                    (i) => Expanded(
                      child: Container(
                        height: 3,
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        color: i == index ? Colors.white : Colors.white38,
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  '${index + 1}/${widget.photos.length}',
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ],
          ),
          Expanded(
            child: PageView.builder(
              controller: controller,
              itemCount: widget.photos.length,
              onPageChanged: (value) => setState(() => index = value),
              itemBuilder: (_, i) => InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Center(
                  child: Image.network(
                    widget.photos[i],
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const Icon(
                      Icons.broken_image_outlined,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class ProfileDetailScreen extends StatefulWidget {
  const ProfileDetailScreen({
    super.key,
    required this.profile,
    this.api,
    this.preview = false,
  });
  final DiscoveryProfile profile;
  final LovaskApi? api;
  final bool preview;
  @override
  State<ProfileDetailScreen> createState() => _ProfileDetailScreenState();
}

class _ProfileDetailScreenState extends State<ProfileDetailScreen> {
  late final api = widget.api ?? LovaskApi();
  bool busy = false;
  String? error;
  int photoIndex = 0;
  Map<String, dynamic>? _extraDetails;
  @override
  void initState() {
    super.initState();
    if (!widget.preview) {
      api.recordVisit(widget.profile.id).catchError((e) {
        if (mounted) setState(() => error = 'Ziyaret kaydedilemedi: $e');
        return <String, dynamic>{};
      });
    }
    final d = widget.profile.details;
    if (d['relationshipGoal'] == null && d['relationship_goal'] == null) {
      _loadProfileDetailsFallback();
    }
  }

  Future<void> _loadProfileDetailsFallback() async {
    try {
      final res = await Supabase.instance.client
          .from('profiles')
          .select(
            'relationship_goal,marital_status,has_children,children_preference,alcohol_use,smoking_use,pet_preference,sports_habit,birth_date,height_cm,education_level,languages',
          )
          .eq('id', widget.profile.id)
          .maybeSingle();
      if (res != null && mounted) {
        setState(() {
          _extraDetails = Map<String, dynamic>.from(res);
        });
      }
    } catch (_) {}
  }

  String? _zodiacFromBirthDate(dynamic value) {
    if (value == null || value is! String || !value.contains('-')) return null;
    final parts = value.split('-').map(int.tryParse).toList();
    if (parts.length < 3 || parts[1] == null || parts[2] == null) return null;
    final m = parts[1]!;
    final d = parts[2]!;
    const cutoffs = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
    const signs = [
      'capricorn',
      'aquarius',
      'pisces',
      'aries',
      'taurus',
      'gemini',
      'cancer',
      'leo',
      'virgo',
      'libra',
      'scorpio',
      'sagittarius',
      'capricorn',
    ];
    if (m < 1 || m > 12) return null;
    final idx = m - 1 + (d >= cutoffs[m - 1] ? 1 : 0);
    return signs[idx.clamp(0, signs.length - 1)];
  }

  Future<void> chat() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await api.openConversation(widget.profile.id);
      if (!mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ChatScreen(
            profileId: widget.profile.id,
            name: widget.profile.name,
            avatarUrl: widget.profile.image,
            matchId: result['matchId'],
            isBot: widget.profile.isBot,
          ),
        ),
      );
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.profile;
    final d = <String, dynamic>{
      ...p.details,
      ...?_extraDetails,
    };

    final lifestyleItems = <({IconData icon, String label, String value})>[];

    final relGoal = d['relationshipGoal'] ?? d['relationship_goal'];
    if (relGoal != null) {
      lifestyleItems.add((
        icon: Icons.favorite_border,
        label: 'İlişki beklentisi',
        value: preferenceChoices['relationshipGoals']?['$relGoal'] ?? '$relGoal',
      ));
    }

    final marital = d['maritalStatus'] ?? d['marital_status'];
    if (marital != null) {
      lifestyleItems.add((
        icon: Icons.person_outline,
        label: 'Medeni durum',
        value: preferenceChoices['maritalStatuses']?['$marital'] ?? '$marital',
      ));
    }

    final childPref = d['childrenPreference'] ?? d['children_preference'];
    if (childPref != null) {
      lifestyleItems.add((
        icon: Icons.child_care_outlined,
        label: 'Gelecekte çocuk',
        value: preferenceChoices['childrenPreferences']?['$childPref'] ?? '$childPref',
      ));
    }

    final alc = d['alcoholUse'] ?? d['alcohol_use'];
    if (alc != null) {
      lifestyleItems.add((
        icon: Icons.wine_bar_outlined,
        label: 'Alkol',
        value: preferenceChoices['alcoholValues']?['$alc'] ?? '$alc',
      ));
    }

    final smk = d['smokingUse'] ?? d['smoking_use'];
    if (smk != null) {
      lifestyleItems.add((
        icon: Icons.smoking_rooms_outlined,
        label: 'Sigara',
        value: preferenceChoices['smokingValues']?['$smk'] ?? '$smk',
      ));
    }

    final pet = d['petPreference'] ?? d['pet_preference'];
    if (pet != null) {
      lifestyleItems.add((
        icon: Icons.pets_outlined,
        label: 'Evcil hayvan',
        value: preferenceChoices['petValues']?['$pet'] ?? '$pet',
      ));
    }

    final sport = d['sportsHabit'] ?? d['sports_habit'];
    if (sport != null) {
      lifestyleItems.add((
        icon: Icons.fitness_center_outlined,
        label: 'Spor',
        value: preferenceChoices['sportsValues']?['$sport'] ?? '$sport',
      ));
    }

    final zod = d['zodiac'] ?? _zodiacFromBirthDate(d['birthDate'] ?? d['birth_date']);
    if (zod != null) {
      lifestyleItems.add((
        icon: Icons.star_border,
        label: 'Burç',
        value: preferenceChoices['zodiacValues']?['$zod'] ?? '$zod',
      ));
    }

    final edu = d['educationLevel'] ?? d['education_level'];
    if (edu != null) {
      lifestyleItems.add((
        icon: Icons.school_outlined,
        label: 'Eğitim',
        value: preferenceChoices['educationValues']?['$edu'] ?? '$edu',
      ));
    }

    final hasChild = d['hasChildren'] ?? d['has_children'];
    if (hasChild != null) {
      lifestyleItems.add((
        icon: Icons.person_outline,
        label: 'Çocuğu var mı?',
        value: hasChild == true || '$hasChild' == 'true' ? 'Evet' : 'Hayır',
      ));
    }

    final height = d['heightCm'] ?? d['height_cm'];
    if (height != null) {
      lifestyleItems.add((
        icon: Icons.straighten_outlined,
        label: 'Boy',
        value: '$height cm',
      ));
    }

    final rawLanguages = d['languages'];
    final languagesList = rawLanguages is List
        ? rawLanguages.whereType<String>().toList()
        : <String>[];

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9FE),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: Center(
          child: Container(
            width: 40,
            height: 40,
            margin: const EdgeInsets.only(left: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFF1EBF8)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: IconButton(
              icon: const Icon(Icons.arrow_back, color: Color(0xFF1E293B), size: 20),
              padding: EdgeInsets.zero,
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ),
        title: const LovaskWordmark(),
        centerTitle: true,
        actions: [
          if (!widget.preview)
            Center(
              child: Container(
                width: 40,
                height: 40,
                margin: const EdgeInsets.only(right: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFF1EBF8)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0A000000),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: IconButton(
                  tooltip: 'Şikâyet et veya engelle',
                  padding: EdgeInsets.zero,
                  onPressed: () async {
                    final closed = await showSafetySheet(context, p.id);
                    if (context.mounted && closed == true) Navigator.pop(context);
                  },
                  icon: const Icon(Icons.more_horiz, color: Color(0xFF1E293B), size: 20),
                ),
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          Positioned(
            top: -40,
            right: -60,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFE9D5FF).withValues(alpha: 0.45),
                    const Color(0xFFE9D5FF).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 240,
            right: -80,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFF3E8FF).withValues(alpha: 0.4),
                    const Color(0xFFF3E8FF).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          if (p.allPhotos.isNotEmpty)
            SizedBox(
              height: MediaQuery.sizeOf(context).height * .5,
              child: Stack(
                children: [
                  PageView.builder(
                    onPageChanged: (value) =>
                        setState(() => photoIndex = value),
                    itemCount: p.allPhotos.length,
                    itemBuilder: (_, index) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: ClipRRect(
                        borderRadius: LovaskRadius.portrait,
                        child: GestureDetector(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => LovaskPhotoViewer(
                                photos: p.allPhotos,
                                initialIndex: index,
                              ),
                            ),
                          ),
                          child: Image.network(
                            p.allPhotos[index],
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const ColoredBox(
                              color: photoDark,
                              child: Center(
                                child: Icon(
                                  Icons.person,
                                  size: 70,
                                  color: Colors.white54,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 14,
                    left: 18,
                    right: 18,
                    child: Row(
                      children: List.generate(
                        p.allPhotos.length,
                        (index) => Expanded(
                          child: Container(
                            height: 3,
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(
                              color: index == photoIndex
                                  ? Colors.white
                                  : Colors.white38,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  p.age > 0 ? '${p.name}, ${p.age}' : p.name,
                  style: const TextStyle(
                    fontFamily: 'CormorantGaramond',
                    fontSize: 40,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (p.verified) const Icon(Icons.verified, color: ruby),
            ],
          ),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: p.presence.isOnline
                      ? const Color(0xFF22C55E)
                      : const Color(0xFF94A3B8),
                  shape: BoxShape.circle,
                  boxShadow: p.presence.isOnline
                      ? [
                          BoxShadow(
                            color: const Color(0xFF22C55E).withValues(alpha: 0.7),
                            blurRadius: 6,
                            spreadRadius: 1,
                          )
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                p.presence.label,
                style: TextStyle(
                  color: p.presence.isOnline
                      ? const Color(0xFF22C55E)
                      : muted,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (p.distance.isNotEmpty) ...[
                const SizedBox(width: 8),
                const Text('·', style: TextStyle(color: muted)),
                const SizedBox(width: 8),
                Text(
                  p.distance,
                  style: const TextStyle(color: muted, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
          if (p.superLikedYou &&
              '${d['superLikeNote'] ?? ''}'.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            LovaskSurface(
              child: Text(
                '“${d['superLikeNote']}”',
                style: const TextStyle(
                  color: champagne,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: p.badges
                .map((badge) => LovaskPill(badge, selected: true))
                .toList(),
          ),
          const SizedBox(height: 24),
          if (p.prompt.isNotEmpty)
            LovaskSurface(
              color: photoDark,
              child: Padding(
                padding: EdgeInsets.zero,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.prompt.toUpperCase(),
                      style: const TextStyle(
                        color: champagne,
                        fontSize: 11,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      p.answer,
                      style: const TextStyle(
                        color: moon,
                        fontFamily: 'CormorantGaramond',
                        fontSize: 30,
                        height: 1.15,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (d['voiceUrl'] is String && '${d['voiceUrl']}'.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: LovaskSurface(
                color: photoDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${d['voicePrompt'] ?? 'Sesli biyografi'}',
                      style: const TextStyle(color: champagne, fontSize: 12),
                    ),
                    VoicePlayer(
                      url: '${d['voiceUrl']}',
                      durationMs: (d['voiceDurationMs'] as num?)?.toInt(),
                    ),
                  ],
                ),
              ),
            ),
          if (lifestyleItems.isNotEmpty || languagesList.isNotEmpty) ...[
            const SizedBox(height: 28),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Onun dünyasında',
                  style: TextStyle(
                    fontFamily: 'CormorantGaramond',
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E1B4B),
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE9D5FF),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFF1EBF8), width: 1.2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A2B1547),
                    blurRadius: 24,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Column(
                children: [
                  for (var i = 0; i < lifestyleItems.length; i++) ...[
                    if (i > 0)
                      const Divider(
                        height: 1,
                        thickness: 1,
                        color: Color(0xFFF3EDF8),
                      ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF8F4FD),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              lifestyleItems[i].icon,
                              size: 18,
                              color: const Color(0xFF7C3AED),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              lifestyleItems[i].label,
                              style: const TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            lifestyleItems[i].value,
                            textAlign: TextAlign.end,
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (languagesList.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(top: 8, bottom: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 13,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7F4FB),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.language,
                            size: 20,
                            color: Color(0xFF4338CA),
                          ),
                          const SizedBox(width: 10),
                          const Text(
                            'Diller: ',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              languagesList.join(', '),
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            LovaskSurface(
              color: panelLight,
              radius: 16,
              child: Text(error!, style: const TextStyle(color: ruby)),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    ],
  ),
      bottomNavigationBar: widget.preview
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7C3AED), Color(0xFFD946EF)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF7C3AED).withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(999),
                    onTap: busy ? null : chat,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.chat_bubble_outline,
                          color: Colors.white,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          busy ? 'Açılıyor…' : 'Mesaj gönder',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
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
}
