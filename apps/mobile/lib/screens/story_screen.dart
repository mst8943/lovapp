import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../theme.dart';

class StoryComposerScreen extends StatefulWidget {
  const StoryComposerScreen({
    super.key,
    required this.api,
    required this.image,
  });
  final LovaskApi api;
  final XFile image;

  @override
  State<StoryComposerScreen> createState() => _StoryComposerScreenState();
}

class _StoryComposerScreenState extends State<StoryComposerScreen> {
  bool uploading = false;

  Future<void> share() async {
    setState(() => uploading = true);
    try {
      await widget.api.uploadStory(widget.image);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        final message = error is LovaskApiException
            ? error.message ?? 'Hikaye yüklenemedi.'
            : 'Hikaye yüklenemedi.';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(duration: const Duration(seconds: 6), content: Text(message)));
        setState(() => uploading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: photoDark,
    appBar: AppBar(
      backgroundColor: photoDark,
      foregroundColor: Colors.white,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      title: const Text('Yeni hikaye', style: TextStyle(color: Colors.white)),
    ),
    body: SafeArea(
      child: Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ClipRRect(
                borderRadius: LovaskRadius.portrait,
                child: Image.file(
                  File(widget.image.path),
                  fit: BoxFit.contain,
                  width: double.infinity,
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Hikayen 24 saat boyunca eşleşmelerin tarafından görüntülenebilir.',
              textAlign: TextAlign.center,
              style: TextStyle(color: champagne),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: uploading ? null : share,
                child: uploading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Hikayeyi paylaş'),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class StoryViewerScreen extends StatefulWidget {
  const StoryViewerScreen({
    super.key,
    required this.api,
    required this.stories,
  });
  final LovaskApi api;
  final List<Map<String, dynamic>> stories;

  @override
  State<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends State<StoryViewerScreen> {
  int index = 0;
  bool deleting = false;
  final viewed = <String>{};

  void markViewed(String id) {
    if (!viewed.add(id)) return;
    widget.api.viewStory(id).catchError((_) {
      viewed.remove(id);
      return <String, dynamic>{};
    });
  }

  Future<void> report() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hikayeyi şikâyet et'),
        content: const Text(
          'Bu hikaye uygunsuz içerik olarak inceleme ekibine iletilecek.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Gönder'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => deleting = true);
    final story = widget.stories[index];
    try {
      await widget.api.safety({
        'action': 'report',
        'targetProfileId': story['profileId'],
        'reason': 'inappropriate_content',
        'details': 'Hikaye: ${story['id']}',
        'block': false,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(duration: Duration(seconds: 6), content: Text('Şikâyetin inceleme ekibine iletildi.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(duration: Duration(seconds: 6), content: Text('Şikâyet gönderilemedi. Yeniden dene.')),
        );
      }
    } finally {
      if (mounted) setState(() => deleting = false);
    }
  }

  Future<void> delete() async {
    setState(() => deleting = true);
    try {
      await widget.api.deleteStory(widget.stories[index]['id'] as String);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(duration: Duration(seconds: 6), content: Text('Hikaye silinemedi.')));
        setState(() => deleting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final story = widget.stories[index];
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: photoDark,
        body: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                child: Image.network(
                  story['url'] as String,
                  fit: BoxFit.contain,
                  loadingBuilder: (context, child, progress) {
                    if (progress == null) {
                      markViewed(story['id'] as String);
                      return child;
                    }
                    return const Center(
                      child: CircularProgressIndicator(color: champagne),
                    );
                  },
                  errorBuilder: (_, _, _) => const Center(
                    child: Text(
                      'Hikaye görüntülenemedi.',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ),
              Positioned.fill(
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.translucent,
                        onTap: () => setState(() {
                          if (index > 0) index--;
                        }),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.translucent,
                        onTap: () {
                          if (index + 1 < widget.stories.length) {
                            setState(() => index++);
                          } else {
                            Navigator.pop(context);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                top: 8,
                left: 12,
                right: 12,
                child: Column(
                  children: [
                    Row(
                      children: List.generate(
                        widget.stories.length,
                        (i) => Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            child: LinearProgressIndicator(
                              value: i <= index ? 1 : 0,
                              backgroundColor: Colors.white38,
                              color: Colors.white,
                              minHeight: 3,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.auto_stories, color: Colors.white),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            story['name'] as String? ?? 'Hikaye',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        if (story['own'] == true)
                          IconButton(
                            tooltip: 'Hikayeyi sil',
                            onPressed: deleting ? null : delete,
                            icon: const Icon(
                              Icons.delete_outline,
                              color: Colors.white,
                            ),
                          ),
                        if (story['own'] != true)
                          IconButton(
                            tooltip: 'Hikayeyi şikâyet et',
                            onPressed: deleting ? null : report,
                            icon: const Icon(
                              Icons.flag_outlined,
                              color: Colors.white,
                            ),
                          ),
                        IconButton(
                          tooltip: 'Kapat',
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.close, color: Colors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
