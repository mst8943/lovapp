import 'screens/meeting_screen.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'widgets/lovask_motion.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api.dart';
import 'screens/auth_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/discovery_screen.dart';
import 'screens/explore_screen.dart';
import 'screens/likes_visitors_screen.dart';
import 'screens/noir_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/profile_hub_screen.dart';
import 'screens/recovery_screen.dart';
import 'theme.dart';
import 'services/notification_manager.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://jagqvyfnychnoxarebgv.supabase.co',
  );
  const key = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZ3F2eWZueWNobm94YXJlYmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTgxOTQsImV4cCI6MjEwNDg5NDE5NH0.NCqnkHgP0rjVvdUv93xKV-YcuUMC9f-IVPcCJGEHrjk',
  );
  if (url.isNotEmpty && key.isNotEmpty) {
    await Supabase.initialize(
      url: url,
      publishableKey: key,
      authOptions: FlutterAuthClientOptions(
        detectSessionInUriPredicate: (uri) =>
            uri.scheme == 'lovask' && uri.host == 'auth-callback',
      ),
    );
  }
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    unawaited(LovaskApi().recordFirstOpen().catchError((_) {}));
  }
  runApp(const LovaskApp());
}

class LovaskApp extends StatefulWidget {
  const LovaskApp({super.key});

  @override
  State<LovaskApp> createState() => _LovaskAppState();
}

class _LovaskAppState extends State<LovaskApp> {
  final navigator = GlobalKey<NavigatorState>();
  StreamSubscription<AuthState>? authChanges;

  @override
  void initState() {
    super.initState();
    if (SupabaseConfig.ready) {
      authChanges = Supabase.instance.client.auth.onAuthStateChange.listen((
        state,
      ) {
        if (state.event == AuthChangeEvent.signedOut) {
          navigator.currentState?.popUntil((route) => route.isFirst);
        }
      });
    }
  }

  @override
  void dispose() {
    authChanges?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigator,
      debugShowCheckedModeBanner: false,
      title: 'Lovask',
      theme: buildLovaskTheme(),
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.dark.copyWith(
          statusBarColor: Colors.transparent,
          systemNavigationBarColor: ink,
          systemNavigationBarIconBrightness: Brightness.dark,
        ),
        child: ColoredBox(color: ink, child: child!),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool recovering = false;

  @override
  Widget build(BuildContext context) {
    if (!SupabaseConfig.ready) {
      return const Scaffold(
        body: Center(child: Text('Uygulama bağlantı ayarları eksik.')),
      );
    }
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (snapshot.data?.event == AuthChangeEvent.passwordRecovery) {
          recovering = true;
        }
        if (snapshot.data?.event == AuthChangeEvent.signedOut) {
          recovering = false;
        }
        final session =
            snapshot.data?.session ??
            Supabase.instance.client.auth.currentSession;
        if (session != null && recovering) {
          return RecoveryScreen(
            onDone: () async {
              recovering = false;
              await Supabase.instance.client.auth.signOut();
            },
          );
        }
        return session != null
            ? ProfileCompletionGate(key: ValueKey(session.user.id))
            : const AuthScreen();
      },
    );
  }
}

class ProfileCompletionGate extends StatefulWidget {
  const ProfileCompletionGate({super.key});

  @override
  State<ProfileCompletionGate> createState() => _ProfileCompletionGateState();
}

class _ProfileCompletionGateState extends State<ProfileCompletionGate> {
  final api = LovaskApi();
  late Future<bool> _completion;
  Map<String, dynamic>? _initialProfile;
  String? _scheduledFor;

  @override
  void initState() {
    super.initState();
    _completion = _check();
  }

  Future<bool> _check() async {
    await api.ensureMembershipApproved();
    // Reserve this device for the first signed-in account before onboarding ends.
    await claimAndroidWelcome(api);
    final results = await Future.wait([api.accountState(), api.profile()]);
    final state = results[0];
    final deletion = state['deletion'] as Map?;
    _scheduledFor =
        deletion != null &&
            deletion['cancelled_at'] == null &&
            deletion['completed_at'] == null
        ? deletion['scheduled_for'] as String?
        : null;
    if (_scheduledFor != null) return false;
    final result = results[1];
    final profile = result['profile'];
    _initialProfile = profile is Map<String, dynamic> ? profile : null;
    return profile is Map<String, dynamic> && profile['completed'] == true;
  }

  void _done() => setState(() => _completion = Future.value(true));

  @override
  Widget build(BuildContext context) => FutureBuilder<bool>(
    future: _completion,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const _LoadingScreen();
      }
      if (snapshot.hasError) {
        return _RetryScreen(
          message: snapshot.error.toString(),
          onRetry: () => setState(() => _completion = _check()),
        );
      }
      if (_scheduledFor != null) {
        return RecoveryScreen(
          scheduledFor: _scheduledFor,
          onDone: () => setState(() => _completion = _check()),
        );
      }
      return snapshot.data == true
          ? const HomeScreen()
          : OnboardingScreen(
              onCompleted: _done,
              initialProfile: _initialProfile,
            );
    },
  );
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(child: CircularProgressIndicator(color: gold)),
  );
}

class _RetryScreen extends StatelessWidget {
  const _RetryScreen({required this.onRetry, required this.message});
  final VoidCallback onRetry;
  final String message;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, style: const TextStyle(color: pearl, fontSize: 17)),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: const Text('Tekrar dene')),
            TextButton(
              onPressed: () => Supabase.instance.client.auth.signOut(),
              child: const Text('Oturumu kapat'),
            ),
          ],
        ),
      ),
    ),
  );
}

class SupabaseConfig {
  static bool get ready =>
      const String.fromEnvironment(
        'SUPABASE_URL',
        defaultValue: 'https://jagqvyfnychnoxarebgv.supabase.co',
      ).isNotEmpty &&
      const String.fromEnvironment(
        'SUPABASE_ANON_KEY',
        defaultValue:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZ3F2eWZueWNobm94YXJlYmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTgxOTQsImV4cCI6MjEwNDg5NDE5NH0.NCqnkHgP0rjVvdUv93xKV-YcuUMC9f-IVPcCJGEHrjk',
      ).isNotEmpty;
}

Future<Map<String, dynamic>> claimAndroidWelcome(LovaskApi api) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return {};
  try {
    const device = MethodChannel('tr.com.lovask.app/device');
    final deviceId = await device.invokeMethod<String>('androidId');
    if (deviceId == null || deviceId.isEmpty) return {};
    return await api.claimAndroidWelcome(deviceId);
  } catch (_) {
    // Retry on the next app launch or when onboarding finishes.
    return {};
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.api});
  final LovaskApi? api;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _currentTab = 0;
  final Set<int> _visitedTabs = {0};
  int _unread = 0;
  int _unreadLikes = 0;
  late final _api = widget.api ?? LovaskApi();
  Timer? _presenceTimer;
  LovaskNotificationManager? _notificationManager;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _claimAndroidWelcome();
    _touchPresence();
    _presenceTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _touchPresence();
      }
    });
    if (SupabaseConfig.ready) {
      _notificationManager = LovaskNotificationManager(
        api: _api,
        getContext: () => context,
        switchTab: _switchTab,
        onUnreadChange: (count) {
          if (mounted && count != _unread) setState(() => _unread = count);
        },
        onUnreadLikesChange: (count) {
          // The open likes tab has already marked these as seen.
          final next = _currentTab == 2 ? 0 : count;
          if (mounted && next != _unreadLikes) {
            setState(() => _unreadLikes = next);
          }
        },
      );
      _notificationManager?.start();
    }
  }

  Future<void> _claimAndroidWelcome() async {
    final result = await claimAndroidWelcome(_api);
    if (result['granted'] == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            duration: Duration(seconds: 6),
            content: Text('3 günlük Noir hediyen hesabına tanımlandı.'),
          ),
        );
    }
  }

  Future<void> _touchPresence() async {
    // Presence is best-effort; a temporary outage must not interrupt browsing.
    try {
      await _api.presence();
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _touchPresence();
  }

  @override
  void dispose() {
    _notificationManager?.stop();
    _presenceTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _openNoir() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NoirScreen()),
    );
  }

  void _switchTab(int index) {
    if (_currentTab == index) return;
    if (index == 2 && _unreadLikes > 0) {
      _api.markLikesSeen().catchError((_) => <String, dynamic>{});
    }
    setState(() {
      _currentTab = index;
      _visitedTabs.add(index);
      if (index == 2) _unreadLikes = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      DiscoveryScreen(
        api: _api,
        onOpenNoir: _openNoir,
        onExplore: () => _switchTab(1),
      ),
      ExploreScreen(api: _api, onCards: () => _switchTab(0)),
      LikesVisitorsScreen(api: _api),
      ConversationsScreen(
        api: _api,
        active: _currentTab == 3,
        onOpenNoir: _openNoir,
        onUnreadCount: (count) {
          if (mounted && count != _unread) setState(() => _unread = count);
        },
      ),
      ProfileHubScreen(
        api: _api,
        onNavigateToMatches: () => _switchTab(3),
        onNavigateToLikes: () => _switchTab(2),
        onNavigateToVisitors: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const LikesVisitorsScreen(initialTab: 1),
          ),
        ),
      ),
      MeetingScreen(api: _api, active: _currentTab == 5),
    ];

    return Scaffold(
      body: SafeArea(
        child: LovaskEnter(
          trigger: _currentTab,
          child: IndexedStack(
            index: _currentTab,
            children: [
              for (var index = 0; index < screens.length; index++)
                _visitedTabs.contains(index)
                    ? screens[index]
                    : const SizedBox.shrink(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          height: 68,
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(
              top: BorderSide(color: Color(0xFFEFE8F4), width: 1.2),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 10,
                offset: Offset(0, -2),
              ),
            ],
          ),
          child: Row(
            children: [
              _NavItem(
                icon: Icons.search_rounded,
                activeIcon: Icons.search_rounded,
                label: 'Keşfet',
                selected: _currentTab == 0 || _currentTab == 1,
                onTap: () => _switchTab(0),
              ),
              _NavItem(
                icon: Icons.favorite_border_rounded,
                activeIcon: Icons.favorite_rounded,
                label: 'Beğeniler',
                count: _unreadLikes,
                selected: _currentTab == 2,
                onTap: () => _switchTab(2),
              ),
              _NavItem(
                icon: Icons.people_outline_rounded,
                activeIcon: Icons.people_rounded,
                label: 'Buluşma',
                selected: _currentTab == 5,
                onTap: () => _switchTab(5),
              ),
              _NavItem(
                icon: Icons.chat_bubble_outline_rounded,
                activeIcon: Icons.chat_bubble_rounded,
                label: 'Mesajlar',
                count: _unread,
                selected: _currentTab == 3,
                onTap: () => _switchTab(3),
              ),
              _NavItem(
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: 'Profil',
                selected: _currentTab == 4,
                onTap: () => _switchTab(4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.count = 0,
  });

  final IconData icon, activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int count;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Badge(
              isLabelVisible: count > 0,
              backgroundColor: const Color(0xFFD132B5),
              label: Text(count > 99 ? '99+' : '$count'),
              child: Icon(
                selected ? activeIcon : icon,
                color: selected
                    ? const Color(0xFF7C3AED)
                    : const Color(0xFF8B8294),
                size: 26,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: selected
                    ? const Color(0xFF7C3AED)
                    : const Color(0xFF8B8294),
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            const SizedBox(height: 3),
            if (selected)
              const _NavIndicatorBar()
            else
              const SizedBox(height: 3),
          ],
        ),
      ),
    ),
  );
}

class _NavIndicatorBar extends StatelessWidget {
  const _NavIndicatorBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 3,
      decoration: BoxDecoration(
        color: const Color(0xFF7C3AED),
        borderRadius: BorderRadius.circular(99),
      ),
    );
  }
}
