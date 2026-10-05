import 'package:flutter/material.dart';
import '../brand_settings.dart';
import '../models.dart';
import '../theme.dart';
import 'lovask_motion.dart';

Future<T?> showLovaskSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
}) => showModalBottomSheet<T>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  backgroundColor: Colors.transparent,
  barrierColor: const Color(0x660B090D),
  builder: (sheetContext) => _LovaskSheet(child: builder(sheetContext)),
);

Future<void> showLovaskNoticeSheet(
  BuildContext context, {
  required String title,
  required String message,
  IconData icon = Icons.info_outline,
  VoidCallback? onAction,
  String actionLabel = 'Anladım',
}) async {
  await showLovaskSheet<void>(
    context: context,
    builder: (sheetContext) => Column(
      children: [
        Icon(icon, color: ruby, size: 38),
        const SizedBox(height: 10),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(sheetContext).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: muted),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: LovaskGhostButton(
                label: 'Kapat',
                onPressed: () => Navigator.pop(sheetContext),
              ),
            ),
            if (onAction != null) ...[
              const SizedBox(width: 10),
              Expanded(
                child: LovaskPrimaryButton(
                  label: actionLabel,
                  onPressed: () {
                    Navigator.pop(sheetContext);
                    onAction();
                  },
                ),
              ),
            ],
          ],
        ),
      ],
    ),
  );
}

class _LovaskSheet extends StatelessWidget {
  const _LovaskSheet({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .9,
        ),
        decoration: const BoxDecoration(
          color: panel,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            24,
            10,
            24,
            24 + MediaQuery.paddingOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: inputBorder,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

class LovaskEyebrow extends StatelessWidget {
  const LovaskEyebrow(this.text, {super.key, this.color = ruby});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: color,
      fontSize: 11,
      fontWeight: FontWeight.w800,
      letterSpacing: 1.5,
    ),
  );
}

class LovaskCrown extends StatelessWidget {
  const LovaskCrown({super.key, this.size = 20, this.color = gold});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _CrownPainter(color));
}

class _CrownPainter extends CustomPainter {
  const _CrownPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final crown = Path()
      ..moveTo(size.width * .08, size.height * .28)
      ..lineTo(size.width * .28, size.height * .47)
      ..lineTo(size.width * .37, size.height * .15)
      ..lineTo(size.width * .50, size.height * .43)
      ..lineTo(size.width * .63, size.height * .15)
      ..lineTo(size.width * .72, size.height * .47)
      ..lineTo(size.width * .92, size.height * .28)
      ..lineTo(size.width * .81, size.height * .76)
      ..lineTo(size.width * .19, size.height * .76)
      ..close();
    canvas.drawPath(crown, paint);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          size.width * .18,
          size.height * .82,
          size.width * .64,
          size.height * .10,
        ),
        Radius.circular(size.width * .03),
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(_CrownPainter oldDelegate) => oldDelegate.color != color;
}

class LovaskSurface extends StatelessWidget {
  const LovaskSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.color = panel,
    this.radius = LovaskRadius.card,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: color,
      borderRadius: LovaskRadius.surface(radius),
      border: Border.all(color: line),
      boxShadow: cardShadow,
    ),
    child: child,
  );
}

/// Ruled fields keep labels visible while a member fills in their details.
class LovaskFormCard extends StatelessWidget {
  const LovaskFormCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => LovaskSurface(
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
    child: Theme(
      data: Theme.of(context).copyWith(
        inputDecorationTheme: Theme.of(context).inputDecorationTheme.copyWith(
          filled: false,
          floatingLabelBehavior: FloatingLabelBehavior.always,
          labelStyle: const TextStyle(color: muted, fontSize: 14),
          floatingLabelStyle: const TextStyle(
            color: wine,
            fontWeight: FontWeight.w600,
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 16),
          border: const UnderlineInputBorder(
            borderSide: BorderSide(color: inputBorder),
          ),
          enabledBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: inputBorder),
          ),
          disabledBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: line),
          ),
          focusedBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: wine, width: 2),
          ),
          errorBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: reject),
          ),
          focusedErrorBorder: const UnderlineInputBorder(
            borderSide: BorderSide(color: reject, width: 2),
          ),
        ),
      ),
      child: Material(color: Colors.transparent, child: child),
    ),
  );
}

class LovaskPrimaryButton extends StatelessWidget {
  const LovaskPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: 52),
    child: LovaskPress(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: onPressed == null ? null : actionGradient,
          borderRadius: BorderRadius.circular(999),
          boxShadow: onPressed == null ? null : cardShadow,
        ),
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
          ),
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
          label: Text(label, textAlign: TextAlign.center),
        ),
      ),
    ),
  );
}

class LovaskGhostButton extends StatelessWidget {
  const LovaskGhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: 48),
    child: LovaskPress(
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 17),
        label: Text(label, textAlign: TextAlign.center),
      ),
    ),
  );
}

class LovaskPill extends StatelessWidget {
  const LovaskPill(
    this.label, {
    super.key,
    this.selected = false,
    this.color,
    this.onPressed,
  });
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final pill = Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: color ?? (selected ? wine : panel),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: selected ? wine : line),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: selected ? Colors.white : muted2,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
    if (onPressed == null) return pill;
    return Semantics(
      selected: selected,
      child: TextButton(
        style: TextButton.styleFrom(
          minimumSize: const Size(48, 48),
          padding: EdgeInsets.zero,
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
        onPressed: onPressed,
        child: pill,
      ),
    );
  }
}

class LovaskAvatar extends StatelessWidget {
  const LovaskAvatar({
    super.key,
    this.url,
    this.size = 48,
    this.online = false,
  });
  final String? url;
  final double size;
  final bool online;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Container(
        width: size,
        height: size,
        padding: const EdgeInsets.all(2),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: panelLight,
        ),
        child: ClipOval(
          child: url != null && url!.isNotEmpty
              ? Image.network(
                  url!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const ColoredBox(
                    color: panelLight,
                    child: Icon(Icons.person_outline, color: ruby),
                  ),
                )
              : const ColoredBox(
                  color: panelLight,
                  child: Icon(Icons.person_outline, color: ruby),
                ),
        ),
      ),
      if (online)
        Positioned(
          right: -1,
          bottom: 1,
          child: Container(
            width: 13,
            height: 13,
            decoration: BoxDecoration(
              color: onlineGreen,
              shape: BoxShape.circle,
              border: Border.all(color: panel, width: 2),
            ),
          ),
        ),
    ],
  );
}

/// Two paths sharing a centre: Lovask's mark, drawn without bitmap assets.
class LovaskOrbit extends StatelessWidget {
  const LovaskOrbit({super.key, this.size = 80, this.color = champagne});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _OrbitPainter(color)),
    ),
  );
}

class _OrbitPainter extends CustomPainter {
  const _OrbitPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width < 60 ? 1.6 : 1.2;
    canvas.translate(size.width / 2, size.height / 2);
    for (final angle in [-.55, .55]) {
      canvas.save();
      canvas.rotate(angle);
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset.zero,
          width: size.width * .52,
          height: size.height * .90,
        ),
        paint,
      );
      canvas.restore();
    }
    canvas.drawCircle(Offset.zero, size.width * .045, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_OrbitPainter oldDelegate) => oldDelegate.color != color;
}

class LovaskWordmark extends StatelessWidget {
  const LovaskWordmark({super.key, this.color = pearl});
  final Color color;
  @override
  Widget build(BuildContext context) =>
      ValueListenableBuilder<AppBrandSettings>(
        valueListenable: AppBrandSettings.value,
        builder: (context, brand, _) => Semantics(
          label: brand.name,
          excludeSemantics: true,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 34,
                height: 34,
                child: Image.network(
                  brand.resolvedLogoUrl,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) => Image.asset(
                    'assets/lovask-discovery-logo.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(width: 7),
              Text(
                brand.name,
                style: TextStyle(
                  fontFamily: 'CormorantGaramond',
                  fontSize: 30,
                  letterSpacing: -.8,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      );
}

class LovaskHero extends StatelessWidget {
  const LovaskHero({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    this.footer,
    this.noir = false,
  });
  final String eyebrow, title, subtitle;
  final Widget? footer;
  final bool noir;

  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      gradient: orbitGradient,
      borderRadius: LovaskRadius.portrait,
      border: Border.all(color: champagne.withValues(alpha: .20)),
      boxShadow: cardShadow,
    ),
    child: Stack(
      children: [
        Positioned(
          right: -56,
          top: -50,
          child: LovaskOrbit(
            size: 230,
            color: (noir ? noirGold : champagne).withValues(alpha: .14),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(LovaskSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LovaskEyebrow(eyebrow, color: noir ? noirGold : champagne),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: moon,
                  fontSize: 38,
                  height: 1.02,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                subtitle,
                style: const TextStyle(
                  color: champagne,
                  height: 1.5,
                  fontSize: 13,
                ),
              ),
              if (footer != null) ...[const SizedBox(height: 24), footer!],
            ],
          ),
        ),
      ],
    ),
  );
}

class LovaskSectionTitle extends StatelessWidget {
  const LovaskSectionTitle(this.title, {super.key, this.caption});
  final String title;
  final String? caption;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (caption != null) ...[
          const SizedBox(height: 6),
          Text(caption!, style: const TextStyle(color: muted, fontSize: 13)),
        ],
      ],
    ),
  );
}

class LovaskEmptyState extends StatelessWidget {
  const LovaskEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.action,
  });
  final String title, message;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const LovaskOrbit(size: 86, color: ruby),
          const SizedBox(height: 24),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, height: 1.5),
          ),
          if (action != null) ...[const SizedBox(height: 24), action!],
        ],
      ),
    ),
  );
}

/// Shared by the discovery gallery, likes and visitors.
class LovaskPortrait extends StatelessWidget {
  const LovaskPortrait({
    super.key,
    required this.profile,
    required this.onTap,
    this.onPhotoError,
  });
  final DiscoveryProfile profile;
  final VoidCallback onTap;
  final VoidCallback? onPhotoError;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '${profile.name}, ${profile.age}, ${profile.city}. Profili aç',
    child: Material(
      color: photoDark,
      borderRadius: LovaskRadius.portrait,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (profile.image.isNotEmpty)
              Image.network(
                profile.image,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) {
                  onPhotoError?.call();
                  return const Center(child: LovaskOrbit());
                },
              ),
            if (profile.image.isEmpty) const Center(child: LovaskOrbit()),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, photoVignette],
                  stops: [.3, 1],
                ),
              ),
            ),
            if (profile.superLikedYou)
              const Positioned(
                top: 16,
                right: 14,
                child: Icon(Icons.auto_awesome, color: noirGold, size: 22),
              ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 22,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (profile.verified)
                    const Icon(
                      Icons.verified_outlined,
                      size: 17,
                      color: verifiedBlue,
                    ),
                  Text(
                    '${profile.name}, ${profile.age}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'CormorantGaramond',
                      fontSize: 24,
                      height: 1.05,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  if (profile.city.isNotEmpty)
                    Text(
                      profile.city,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: champagne, fontSize: 12),
                    ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: profile.presence.isOnline
                              ? const Color(0xFF22C55E)
                              : const Color(0xFF94A3B8),
                          shape: BoxShape.circle,
                          boxShadow: profile.presence.isOnline
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF22C55E).withValues(alpha: 0.7),
                                    blurRadius: 5,
                                    spreadRadius: 1,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          profile.presence.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: profile.presence.isOnline
                                ? const Color(0xFF4ADE80)
                                : Colors.white.withValues(alpha: 0.85),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (profile.superLikedYou &&
                      ''.trim().isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0x33FDE68A),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0x66FDE68A), width: 0.5),
                      ),
                      child: Text(
                        '\u201c\u201d',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 11, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
