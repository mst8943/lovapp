import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';
import 'profile_detail_screen.dart';
import 'noir_screen.dart';

class LikesVisitorsScreen extends StatefulWidget {
  const LikesVisitorsScreen({super.key, this.initialTab = 0, this.api});
  final LovaskApi? api;
  final int initialTab;

  @override
  State<LikesVisitorsScreen> createState() => _LikesVisitorsScreenState();
}

class _LikesVisitorsScreenState extends State<LikesVisitorsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late final api = widget.api ?? LovaskApi();

  bool _loading = true;
  bool _isPremium = false;
  int _likesCount = 0;
  int _visitorsCount = 0;
  List<DiscoveryProfile> _likedProfiles = [];
  List<ProfileVisitor> _visitors = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTab,
    );
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final likesRes = await api.likes();
      final visitorsRes = await api.visitors();

      final likesList = likesRes['profiles'] as List<dynamic>? ?? [];
      final visitorsList = visitorsRes['visitors'] as List<dynamic>? ?? [];

      if (mounted) {
        setState(() {
          _isPremium =
              likesRes['premium'] == true || visitorsRes['premium'] == true;
          _likesCount =
              (likesRes['count'] as num?)?.toInt() ?? likesList.length;
          _visitorsCount =
              (visitorsRes['count'] as num?)?.toInt() ?? visitorsList.length;

          _likedProfiles = likesList
              .whereType<Map<String, dynamic>>()
              .map(DiscoveryProfile.fromJson)
              .toList();

          _visitors = visitorsList
              .whereType<Map<String, dynamic>>()
              .map(ProfileVisitor.fromJson)
              .toList();

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

  void _openNoir() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NoirScreen()),
    ).then((_) => _loadData());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sana gelen izler'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: IconButton(
              tooltip: 'Noir ayrıcalıkları',
              onPressed: _openNoir,
              style: IconButton.styleFrom(backgroundColor: noirSurface),
              icon: const LovaskCrown(size: 24),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Container(
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: panelLight,
              borderRadius: BorderRadius.circular(999),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                gradient: orbitGradient,
                borderRadius: BorderRadius.circular(999),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
              labelColor: Colors.white,
              unselectedLabelColor: muted,
              tabs: [
                Tab(height: 40, text: 'Beğeniler ($_likesCount)'),
                Tab(height: 40, text: 'Ziyaretçiler ($_visitorsCount)'),
              ],
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: gold))
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, style: const TextStyle(color: ruby)),
                  const SizedBox(height: 12),
                  LovaskGhostButton(label: 'Tekrar dene', onPressed: _loadData),
                ],
              ),
            )
          : TabBarView(
              controller: _tabController,
              children: [_buildLikesTab(), _buildVisitorsTab()],
            ),
    );
  }

  Widget _buildLikesTab() {
    if (!_isPremium) {
      return _buildLockedNoirView(
        title: 'İlk izler burada\nbuluşacak.',
        subtitle:
            'Seni merak eden biri var mı? Beğenilerini Noir ile gör, ilk adımı sen at.',
      );
    }

    if (_likedProfiles.isEmpty) {
      return const _EmptyPlaceholder(
        icon: Icons.favorite_border,
        title: 'Henüz Beğeni Yok',
        subtitle: 'Profilini beğenen üyeler burada listelenecek.',
      );
    }

    return RefreshIndicator(
      color: gold,
      onRefresh: _loadData,
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: MediaQuery.textScalerOf(context).scale(14) > 20
              ? 1
              : 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 16,
          childAspectRatio: 0.65,
        ),
        itemCount: _likedProfiles.length,
        itemBuilder: (_, index) {
          final profile = _likedProfiles[index];
          return _ProfileGridTile(
            name: profile.name,
            age: profile.age,
            city: profile.city,
            imageUrl: profile.image,
            verified: profile.verified,
            superLiked: profile.superLikedYou,
            fullProfile: profile,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProfileDetailScreen(profile: profile),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildVisitorsTab() {
    if (!_isPremium) {
      return _buildLockedNoirView(
        title: 'Profil Ziyaretçileri Kilitli',
        subtitle:
            'Profiline kimlerin baktığını anında ve gizlenmeden görmek için Noir üyesi ol.',
      );
    }

    if (_visitors.isEmpty) {
      return const _EmptyPlaceholder(
        icon: Icons.remove_red_eye_outlined,
        title: 'Henüz Ziyaretçi Yok',
        subtitle: 'Profiline bakan kullanıcılar burada listelenecek.',
      );
    }

    return RefreshIndicator(
      color: gold,
      onRefresh: _loadData,
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: MediaQuery.textScalerOf(context).scale(14) > 20
              ? 1
              : 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 16,
          childAspectRatio: 0.65,
        ),
        itemCount: _visitors.length,
        itemBuilder: (_, index) {
          final visitor = _visitors[index];
          return _ProfileGridTile(
            name: visitor.name,
            age: visitor.age,
            city: visitor.city,
            imageUrl: visitor.image,
            verified: visitor.verified,
            superLiked: false,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProfileDetailScreen(
                    profile: DiscoveryProfile(
                      id: visitor.id,
                      name: visitor.name,
                      age: visitor.age,
                      city: visitor.city,
                      image: visitor.image,
                      verified: visitor.verified,
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildLockedNoirView({
    required String title,
    required String subtitle,
  }) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      children: [
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            gradient: orbitGradient,
            borderRadius: LovaskRadius.portrait,
            border: Border.all(color: champagne.withValues(alpha: .4)),
            boxShadow: cardShadow,
          ),
          child: Stack(
            children: [
              Positioned(
                top: -50,
                right: -65,
                child: LovaskOrbit(
                  size: 290,
                  color: champagne.withValues(alpha: .1),
                ),
              ),
              Positioned(
                bottom: 34,
                right: -20,
                left: 40,
                child: ExcludeSemantics(
                  child: SizedBox(
                    height: 190,
                    child: Stack(
                      alignment: Alignment.bottomCenter,
                      children: [
                        for (var i = 0; i < 3; i++)
                          Positioned(
                            right: i * 72.0,
                            bottom: i == 0 ? 60 : 0,
                            child: Transform.rotate(
                              angle: i == 0 ? .16 : -.2 + i * .1,
                              child: Container(
                                width: 116,
                                height: 144,
                                clipBehavior: Clip.antiAlias,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(
                                    color: Colors.white38,
                                    width: 2,
                                  ),
                                ),
                                child: ImageFiltered(
                                  imageFilter: ui.ImageFilter.blur(
                                    sigmaX: 6,
                                    sigmaY: 6,
                                  ),
                                  child: ColorFiltered(
                                    colorFilter: const ColorFilter.mode(
                                      Color(0x66241333),
                                      BlendMode.srcATop,
                                    ),
                                    child: Image.asset(
                                      'assets/noir-preview-${i + 1}.webp',
                                      fit: BoxFit.cover,
                                    ),
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
              if ((_tabController.index == 0 ? _likesCount : _visitorsCount) >
                  0)
                Positioned(
                  right: 14,
                  bottom: 78,
                  child: Transform.rotate(
                    angle: .16,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xCA4D3B66),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: Text(
                        '+${_tabController.index == 0 ? _likesCount : _visitorsCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        LovaskEyebrow('LOVASK NOIR', color: moon),
                        SizedBox(width: 8),
                        LovaskCrown(size: 16, color: noirGold),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      title,
                      style: Theme.of(context).textTheme.displayMedium
                          ?.copyWith(
                            color: Colors.white,
                            fontSize: 38,
                            height: 1.04,
                          ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: 200,
                      child: Text(
                        subtitle,
                        style: const TextStyle(
                          color: moon,
                          fontSize: 13,
                          height: 1.45,
                        ),
                      ),
                    ),
                    const SizedBox(height: 50),
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFEAD3), Color(0xFFF8D5FF)],
                        ),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.white54),
                      ),
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          foregroundColor: photoDark,
                          shadowColor: Colors.transparent,
                          minimumSize: const Size(0, 48),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                        ),
                        onPressed: _openNoir,
                        icon: const Icon(Icons.lock_outline, size: 18),
                        label: const Text('Noir ile kilitleri aç'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        LovaskSurface(
          radius: 20,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  LovaskCrown(size: 20),
                  SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      'Noir ile neler kazanırsın?',
                      style: TextStyle(
                        color: pearl,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final benefit in const [
                'Seni beğenenleri gör',
                'Sınırsız beğeni gönder',
                'Gelişmiş filtreler',
                'Haftada 1 kez 30 dakika Boost',
                'Özel rozet ve ayrıcalıklar',
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      Container(
                        width: 19,
                        height: 19,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: gold),
                        ),
                        child: const Icon(Icons.check, color: gold, size: 13),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Text(
                          benefit,
                          style: const TextStyle(color: muted2, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProfileGridTile extends StatelessWidget {
  const _ProfileGridTile({
    required this.name,
    required this.age,
    required this.city,
    required this.imageUrl,
    required this.verified,
    required this.superLiked,
    this.fullProfile,
    required this.onTap,
  });

  final String name;
  final int age;
  final String city;
  final String imageUrl;
  final bool verified;
  final bool superLiked;
  final DiscoveryProfile? fullProfile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => LovaskPortrait(
    profile: fullProfile ??
        DiscoveryProfile(
          id: '',
          name: name,
          age: age,
          city: city,
          image: imageUrl,
          verified: verified,
          superLikedYou: superLiked,
        ),
    onTap: onTap,
  );
}

class _EmptyPlaceholder extends StatelessWidget {
  const _EmptyPlaceholder({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) =>
      LovaskEmptyState(title: title, message: subtitle);
}
