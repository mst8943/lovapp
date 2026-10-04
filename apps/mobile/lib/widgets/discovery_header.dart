import 'package:flutter/material.dart';
import 'boost_sheet.dart';

class DiscoveryHeader extends StatelessWidget {
  const DiscoveryHeader({
    super.key,
    required this.list,
    required this.onSwitch,
    required this.onFilter,
    this.onBoost,
    this.onRitual,
  });

  final bool list;
  final VoidCallback? onSwitch;
  final VoidCallback onFilter;
  final VoidCallback? onBoost;
  final VoidCallback? onRitual;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Flexible(
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: const Color(0xFFF4ECF8),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0x33D1B5E8)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x10805096),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _HeaderTabButton(
                      active: !list,
                      icon: Icons.auto_awesome,
                      iconSize: 17,
                      label: 'Kaydır',
                      onTap: !list ? null : onSwitch,
                    ),
                    _HeaderTabButton(
                      active: list,
                      icon: Icons.format_list_bulleted_rounded,
                      iconSize: 19,
                      label: 'Liste',
                      onTap: list ? null : onSwitch,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (onBoost != null) ...[
                BoostIconButton(onPressed: onBoost!),
                const SizedBox(width: 8),
              ],
              if (onRitual != null) ...[
                Material(
                  color: Colors.transparent,
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: onRitual,
                    customBorder: const CircleBorder(),
                    child: Ink(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFFAF6FC),
                        border: Border.all(
                          color: const Color(0xFFEADBFA),
                          width: 1.2,
                        ),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.auto_fix_high_rounded,
                          color: Color(0xFF7C3AED),
                          size: 23,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Material(
                color: Colors.transparent,
                shape: const CircleBorder(),
                child: InkWell(
                  onTap: onFilter,
                  customBorder: const CircleBorder(),
                  child: Ink(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFFAF6FC),
                      border: Border.all(
                        color: const Color(0xFFEADBFA),
                        width: 1.2,
                      ),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.tune_rounded,
                        color: Color(0xFF7C3AED),
                        size: 23,
                      ),
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

class _HeaderTabButton extends StatelessWidget {
  const _HeaderTabButton({
    required this.active,
    required this.icon,
    required this.iconSize,
    required this.label,
    required this.onTap,
  });

  final bool active;
  final IconData icon;
  final double iconSize;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: active
              ? const LinearGradient(
                  colors: [
                    Color(0xFFA855F7),
                    Color(0xFF7E22CE),
                    Color(0xFF6B21A8),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          boxShadow: active
              ? const [
                  BoxShadow(
                    color: Color(0x407E22CE),
                    blurRadius: 10,
                    offset: Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: iconSize,
              color: active ? Colors.white : const Color(0xFF7B668A),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: active ? Colors.white : const Color(0xFF7B668A),
                fontSize: 13.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
