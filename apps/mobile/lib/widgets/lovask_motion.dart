import 'package:flutter/material.dart';
import '../theme.dart';

class LovaskEnter extends StatefulWidget {
  const LovaskEnter({super.key, required this.child, this.trigger});
  final Widget child;
  final Object? trigger;
  @override
  State<LovaskEnter> createState() => _LovaskEnterState();
}

class _LovaskEnterState extends State<LovaskEnter>
    with SingleTickerProviderStateMixin {
  late final controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _play();
  }

  @override
  void didUpdateWidget(covariant LovaskEnter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.trigger != widget.trigger) _play();
  }

  void _play() {
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.value = 1;
    } else {
      controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: controller,
    child: SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(.025, 0),
        end: Offset.zero,
      ).chain(CurveTween(curve: Curves.easeOutCubic)).animate(controller),
      child: widget.child,
    ),
  );
}

class LovaskPress extends StatefulWidget {
  const LovaskPress({super.key, required this.child});
  final Widget child;
  @override
  State<LovaskPress> createState() => _LovaskPressState();
}

class _LovaskPressState extends State<LovaskPress> {
  bool pressed = false;
  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: (_) => setState(() => pressed = true),
    onPointerUp: (_) => setState(() => pressed = false),
    onPointerCancel: (_) => setState(() => pressed = false),
    child: AnimatedScale(
      scale: pressed && !MediaQuery.disableAnimationsOf(context) ? .98 : 1,
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 100),
      child: widget.child,
    ),
  );
}

class LovaskTyping extends StatefulWidget {
  const LovaskTyping({super.key});
  @override
  State<LovaskTyping> createState() => _LovaskTypingState();
}

class _LovaskTypingState extends State<LovaskTyping>
    with SingleTickerProviderStateMixin {
  late final controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.stop();
    } else {
      controller.repeat();
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Yazıyor',
    liveRegion: true,
    child: AnimatedBuilder(
      animation: controller,
      builder: (_, _) => Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(
            3,
            (i) => Opacity(
              opacity: MediaQuery.disableAnimationsOf(context)
                  ? .7
                  : .35 +
                        .65 *
                            (1 - ((controller.value * 3 - i) % 3).clamp(0, 1)),
              child: Container(
                width: 5,
                height: 5,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: const BoxDecoration(
                  color: muted,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
