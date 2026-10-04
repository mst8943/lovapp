import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../theme.dart';
import '../screens/story_screen.dart';
import 'lovask_primitives.dart';

class StoryStrip extends StatefulWidget {
  const StoryStrip({super.key, required this.api});
  final LovaskApi api;
  @override
  State<StoryStrip> createState() => _StoryStripState();
}

class _StoryStripState extends State<StoryStrip> with WidgetsBindingObserver {
  List<Map<String, dynamic>> stories = [];
  Timer? timer;
  bool fetching = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        load();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) load();
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> load() async {
    if (fetching) return;
    fetching = true;
    try {
      final data = await widget.api.stories();
      if (mounted) {
        setState(() {
          stories = (data['stories'] as List? ?? [])
              .cast<Map<String, dynamic>>();
          error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = 'Hikayeleri yenile');
    } finally {
      fetching = false;
    }
  }

  Future<void> add() async {
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (image == null || !mounted) return;
      await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => StoryComposerScreen(api: widget.api, image: image),
        ),
      );
      await load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(duration: Duration(seconds: 6), content: Text('Fotoğraf seçilemedi. Yeniden dene.')),
        );
      }
    }
  }

  void explain() => showLovaskNoticeSheet(
    context,
    title: 'Hikayene fotoğraf ekle',
    message:
        'Hikayen 24 saat boyunca eşleşmelerin tarafından görüntülenebilir.',
    icon: Icons.add_photo_alternate_outlined,
    actionLabel: 'Fotoğraf seç',
    onAction: add,
  );
  Future<void> view(List<Map<String, dynamic>> group) async {
    await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => StoryViewerScreen(api: widget.api, stories: group),
      ),
    );
    await load();
  }

  @override
  Widget build(BuildContext context) {
    final own = stories.where((s) => s['own'] == true).toList();
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final story in stories.where((s) => s['own'] != true)) {
      groups.putIfAbsent(story['profileId'] as String, () => []).add(story);
    }
    Widget tile(List<Map<String, dynamic>> group, bool mine) => SizedBox(
      width: 72,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Semantics(
                button: true,
                label: mine ? 'Hikayem' : '${group.first['name']} hikayeleri',
                child: InkWell(
                  onTap: group.isEmpty ? explain : () => view(group),
                  borderRadius: BorderRadius.circular(32),
                  child: CustomPaint(
                    painter: StoryRing(
                      group.map((s) => s['seen'] == true).toList(),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: ClipOval(
                        child: SizedBox.square(
                          dimension: 46,
                          child: group.isEmpty
                              ? const ColoredBox(
                                  color: panelLight,
                                  child: Icon(Icons.add, color: ruby),
                                )
                              : Image.network(
                                  group.last['url'] as String,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) => const ColoredBox(
                                    color: panelLight,
                                    child: Icon(Icons.person, color: ruby),
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (mine && group.isNotEmpty)
                Positioned(
                  right: -8,
                  bottom: -8,
                  child: IconButton(
                    tooltip: 'Hikaye ekle',
                    onPressed: explain,
                    icon: const CircleAvatar(
                      radius: 11,
                      backgroundColor: ruby,
                      child: Icon(Icons.add, size: 17, color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 5),
          GestureDetector(
            onTap: group.isEmpty ? explain : () => view(group),
            child: Text(
              mine
                  ? (group.isEmpty ? 'Hikayen +' : 'Hikayem')
                  : group.first['name'] as String? ?? 'Üye',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: pearl),
            ),
          ),
        ],
      ),
    );
    return SizedBox(
      height: 88 + (MediaQuery.textScalerOf(context).scale(11) - 11),
      child: Material(
        color: Colors.transparent,
        child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          tile(own, true),
          ...groups.values.map((group) => tile(group, false)),
          if (error != null) TextButton(onPressed: load, child: Text(error!)),
        ],
        ),
      ),
    );
  }
}

class StoryRing extends CustomPainter {
  const StoryRing(this.seen);
  final List<bool> seen;
  @override
  void paint(Canvas canvas, Size size) {
    if (seen.isEmpty) return;
    final rect = (Offset.zero & size).deflate(2);
    final sweep = 2 * math.pi / seen.length;
    for (var i = 0; i < seen.length; i++) {
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = seen[i] ? 1.5 : 3.5
        ..strokeCap = StrokeCap.round;
      if (seen[i]) {
        paint.color = const Color(0xFFBDAACD);
      } else {
        paint.shader = const LinearGradient(
          colors: [Color(0xFFFF479E), Color(0xFF8B3EE8)],
        ).createShader(rect);
      }
      final gap = seen.length == 1 ? 0.0 : .12;
      canvas.drawArc(
        rect,
        -math.pi / 2 + i * sweep + gap / 2,
        sweep - gap,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(StoryRing oldDelegate) => true;
}
