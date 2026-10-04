import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import '../api.dart';
import '../theme.dart';

List<int> voiceWaveform(List<int> samples) => List.generate(
  24,
  (index) => samples.isEmpty
      ? 0
      : samples[(index * samples.length ~/ 24).clamp(0, samples.length - 1)]
            .clamp(0, 100),
);

class VoiceComposer extends StatefulWidget {
  const VoiceComposer({
    super.key,
    required this.profileId,
    required this.onSent,
    this.bioPrompt,
  });
  final String profileId;
  final VoidCallback onSent;
  final String? bioPrompt;
  @override
  State<VoiceComposer> createState() => _VoiceComposerState();
}

class _VoiceComposerState extends State<VoiceComposer>
    with WidgetsBindingObserver {
  final recorder = AudioRecorder();
  final previewPlayer = AudioPlayer();
  StreamSubscription<Amplitude>? amplitude;
  Timer? limit;
  Timer? ticker;
  final samples = <int>[];
  DateTime? started;
  String? path;
  String clientId = '';
  int duration = 0;
  bool recording = false, busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    limit?.cancel();
    ticker?.cancel();
    amplitude?.cancel();
    recorder.dispose();
    previewPlayer.dispose();
    final temporary = path;
    if (temporary != null) {
      File(temporary).delete().catchError((_) => File(temporary));
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && recording && !busy) stop();
  }

  Future<void> start() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (!await recorder.hasPermission()) {
        throw Exception('Sesli mesaj için mikrofon izni gerekli.');
      }
      final directory = await getTemporaryDirectory();
      clientId = const Uuid().v4();
      path = '${directory.path}/lovask-voice-$clientId.m4a';
      samples.clear();
      await recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000),
        path: path!,
      );
      started = DateTime.now();
      duration = 0;
      ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted && recording) {
          setState(
            () => duration = DateTime.now()
                .difference(started!)
                .inMilliseconds
                .clamp(0, 60000),
          );
        }
      });
      amplitude = recorder
          .onAmplitudeChanged(const Duration(milliseconds: 200))
          .listen((a) {
            samples.add(((a.current + 60) / 60 * 100).round().clamp(0, 100));
          });
      limit = Timer(
        Duration(seconds: widget.bioPrompt == null ? 59 : 30),
        stop,
      );
      if (mounted) setState(() => recording = true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> stop() async {
    if (busy || !recording) return;
    setState(() => busy = true);
    limit?.cancel();
    ticker?.cancel();
    duration = DateTime.now()
        .difference(started!)
        .inMilliseconds
        .clamp(0, 60000);
    try {
      path = await recorder.stop();
      await amplitude?.cancel();
      if (duration < (widget.bioPrompt == null ? 500 : 15000)) {
        await clear();
        if (mounted) {
          setState(
            () => error = widget.bioPrompt == null
                ? 'En az yarım saniye kayıt yap.'
                : 'En az 15 saniye kayıt yap.',
          );
        }
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          recording = false;
          busy = false;
        });
      }
    }
  }

  Future<void> clear() async {
    final temporary = path;
    path = null;
    if (temporary != null && await File(temporary).exists()) {
      await File(temporary).delete();
    }
    if (mounted) setState(() {});
  }

  Future<void> send() async {
    if (path == null || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (widget.bioPrompt != null) {
        await LovaskApi().sendVoiceBio(
          XFile(path!),
          widget.bioPrompt!,
          duration.clamp(15000, 30000),
        );
      } else {
        await LovaskApi().sendAudio(
          widget.profileId,
          XFile(path!),
          clientId: clientId,
          durationMs: duration,
          waveform: voiceWaveform(samples),
        );
      }
      await clear();
      if (mounted) widget.onSent();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text('Sesinle anlat', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 8),
      Text(
        recording
            ? 'Kaydı durdurduktan sonra gönderebilirsin.'
            : path != null
            ? 'Kaydın hazır. Gönder veya silip yeniden kaydet.'
            : widget.bioPrompt == null
            ? 'Mikrofona dokun. En fazla 59 saniye kaydedebilirsin.'
            : '15–30 saniye konuş. Kaydı dinleyip yayınla.',
        textAlign: TextAlign.center,
        style: const TextStyle(color: muted, fontSize: 13),
      ),
      const SizedBox(height: 16),
      if (busy) const LinearProgressIndicator(color: ruby),
      if (error != null) Text(error!, style: const TextStyle(color: ruby)),
      Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (recording)
            Text(
              'Kaydediliyor · ${duration ~/ 1000} sn',
              style: const TextStyle(color: ruby),
            ),
          if (path != null && !recording && !busy) ...[
            Text('${(duration / 1000).toStringAsFixed(1)} sn'),
            IconButton(
              tooltip: 'Kaydı dinle',
              onPressed: () => previewPlayer.play(DeviceFileSource(path!)),
              icon: const Icon(Icons.play_arrow),
            ),
            IconButton(
              tooltip: 'Kaydı sil',
              onPressed: clear,
              icon: const Icon(Icons.delete_outline),
            ),
            IconButton(
              tooltip: 'Sesli mesajı gönder',
              onPressed: send,
              icon: const Icon(Icons.send),
            ),
          ] else
            IconButton(
              tooltip: recording ? 'Kaydı durdur' : 'Sesli mesaj kaydet',
              onPressed: busy
                  ? null
                  : recording
                  ? stop
                  : start,
              icon: Icon(
                recording ? Icons.stop_circle : Icons.mic_none,
                color: ruby,
              ),
            ),
        ],
      ),
    ],
  );
}

class VoicePlayer extends StatefulWidget {
  const VoicePlayer({
    super.key,
    required this.url,
    this.durationMs,
    this.foreground = pearl,
  });
  final String url;
  final int? durationMs;
  final Color foreground;
  @override
  State<VoicePlayer> createState() => _VoicePlayerState();
}

class _VoicePlayerState extends State<VoicePlayer> {
  final player = AudioPlayer();
  @override
  void dispose() {
    player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => StreamBuilder<PlayerState>(
    stream: player.onPlayerStateChanged,
    builder: (context, snapshot) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          color: widget.foreground,
          tooltip: 'Sesli mesajı oynat / duraklat',
          icon: Icon(
            snapshot.data == PlayerState.playing
                ? Icons.pause
                : Icons.play_arrow,
          ),
          onPressed: () async {
            try {
              if (snapshot.data == PlayerState.playing) {
                await player.pause();
              } else {
                await player.play(UrlSource(widget.url));
              }
            } catch (_) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(duration: Duration(seconds: 6), 
                    content: Text(
                      'Ses açılamadı. Sohbeti yenileyip tekrar dene.',
                    ),
                  ),
                );
              }
            }
          },
        ),
        StreamBuilder<Duration>(
          stream: player.onPositionChanged,
          builder: (_, position) {
            final elapsed = position.data?.inMilliseconds ?? 0;
            final total = widget.durationMs ?? 0;
            return Flexible(
              child: SizedBox(
                width: 150,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sesli mesaj',
                      style: TextStyle(color: widget.foreground, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: total > 0 ? (elapsed / total).clamp(0.0, 1.0) : 0,
                      color: widget.foreground,
                      backgroundColor: widget.foreground.withValues(alpha: .18),
                      borderRadius: BorderRadius.circular(4),
                      semanticsLabel: 'Sesli mesaj ilerlemesi',
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${elapsed ~/ 1000} / ${total ~/ 1000} sn',
                      style: TextStyle(color: widget.foreground, fontSize: 11),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    ),
  );
}
