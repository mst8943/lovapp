import 'package:flutter/material.dart';

// Native app palette, measured against arayuzler.png.
const ink = Color(0xFFFCF8FB);
const panel = Color(0xFFFFFFFF);
const panelLight = Color(0xFFF1E7F7);
const wine = Color(0xFF55227C);
const ruby = Color(0xFF9B45D5);
const gold = Color(0xFFA9803B);
const champagne = Color(0xFFE9CFFF);
const pearl = Color(0xFF28183E);
const muted = Color(0xFF80698E);
const ink2 = Color(0xFF4E3861);
const muted2 = Color(0xFF76617F);
const line = Color(0xFFE8DCEF);
const inputBorder = Color(0xFFD4B8E7);
const photoDark = Color(0xFF241333);
const noirSurface = Color(0xFFF3EBDE);
const noirBorder = Color(0xFFD9C6A7);
const noirText = Color(0xFF79592D);
const moon = Color(0xFFF7EEFF);
const noirGold = Color(0xFFE5CDA6);
const success = Color(0xFF24745E);
const rewind = muted2;
const reject = Color(0xFFB83E65);
const superLike = ruby;
const like = ruby;
const verifiedBlue = Color(0xFFAB50F3);
const shadowInk = photoDark;
const photoScrimMiddle = Color(0x66261C35);
const photoScrimEnd = Color(0xF2261C35);
const photoVignette = Color(0xE0261C35);
const photoVignetteSoft = Color(0xCC261C35);
const lineSoft = line;
const alternateLine = line;
const onlineGreen = Color(0xFF459D82);
const cardShadow = [
  BoxShadow(color: Color(0x102D163F), blurRadius: 20, offset: Offset(0, 6)),
];

abstract final class LovaskSpace {
  static const double xs = 4, sm = 8, md = 12, lg = 16, xl = 24, xxl = 32;
  static const page = EdgeInsets.symmetric(horizontal: xl);
}

abstract final class LovaskRadius {
  static const double control = 16, card = 24, sheet = 32;
  static BorderRadius surface(double radius) => BorderRadius.only(
    topRight: Radius.circular(radius),
    bottomLeft: Radius.circular(radius),
  );
  static const portrait = BorderRadius.only(
    topLeft: Radius.circular(0),
    topRight: Radius.circular(28),
    bottomLeft: Radius.circular(28),
    bottomRight: Radius.circular(0),
  );
}

const orbitGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF583367), Color(0xFF342043), Color(0xFF24132F)],
  stops: [0, .55, 1],
);

const actionGradient = LinearGradient(
  begin: Alignment.topRight,
  end: Alignment.bottomLeft,
  colors: [Color(0xFFF395F5), Color(0xFFBE45DD), Color(0xFF72269F)],
  stops: [0, .35, 1],
);

ThemeData buildLovaskTheme() {
  final display = const TextTheme(
    displayLarge: TextStyle(
      fontFamily: 'CormorantGaramond',
      fontSize: 48,
      height: 1.05,
      fontWeight: FontWeight.w600,
      letterSpacing: -.8,
    ),
    displayMedium: TextStyle(
      fontFamily: 'CormorantGaramond',
      fontSize: 40,
      height: 1.08,
      fontWeight: FontWeight.w600,
      letterSpacing: -.5,
    ),
    headlineSmall: TextStyle(
      fontFamily: 'CormorantGaramond',
      fontSize: 32,
      height: 1.05,
      fontWeight: FontWeight.w600,
    ),
    titleLarge: TextStyle(
      fontFamily: 'CormorantGaramond',
      fontSize: 22,
      height: 1.1,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: TextStyle(fontSize: 15, height: 1.45),
    bodyMedium: TextStyle(fontSize: 14, height: 1.4),
    labelLarge: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      letterSpacing: .15,
    ),
  );
  return ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: ink,
    primaryColor: wine,
    colorScheme: const ColorScheme.light(
      primary: wine,
      secondary: ruby,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      surfaceContainerHighest: panelLight,
      outline: inputBorder,
      surface: panel,
      onSurface: pearl,
      error: reject,
    ),
    fontFamily: 'Manrope',
    textTheme: display.apply(bodyColor: pearl, displayColor: pearl),
    useMaterial3: true,
    chipTheme: const ChipThemeData(
      shape: StadiumBorder(),
      backgroundColor: panelLight,
      side: BorderSide(color: line),
      labelStyle: TextStyle(fontFamily: 'Manrope', color: pearl),
    ),
    appBarTheme: const AppBarTheme(
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      backgroundColor: ink,
      foregroundColor: pearl,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'CormorantGaramond',
        fontSize: 32,
        fontWeight: FontWeight.w600,
        color: pearl,
      ),
      toolbarHeight: 68,
      titleSpacing: 20,
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 78,
      backgroundColor: ink,
      elevation: 0,
      indicatorColor: panelLight,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? wine : muted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 22,
          color: states.contains(WidgetState.selected) ? gold : muted,
        ),
      ),
    ),
    cardTheme: CardThemeData(
      color: panel,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: LovaskRadius.portrait,
        side: BorderSide(color: line),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: panel,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: BorderSide(color: line),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: panel,
      modalBackgroundColor: panel,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: wine,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
        elevation: 0,
        shadowColor: wine.withValues(alpha: .18),
        side: BorderSide(color: Colors.white.withValues(alpha: .14)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        textStyle: const TextStyle(
          fontFamily: 'Manrope',
          fontWeight: FontWeight.w600,
          fontSize: 16,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: ruby,
        side: const BorderSide(color: inputBorder),
        minimumSize: const Size(0, 50),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LovaskRadius.control),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: panel,
      labelStyle: const TextStyle(color: muted),
      hintStyle: const TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LovaskRadius.control),
        borderSide: const BorderSide(color: inputBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LovaskRadius.control),
        borderSide: const BorderSide(color: ruby, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LovaskRadius.control),
        borderSide: const BorderSide(color: ruby),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(LovaskRadius.control),
        borderSide: const BorderSide(color: ruby, width: 1.5),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: wine,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: pearl,
      ),
    ),
    sliderTheme: const SliderThemeData(
      activeTrackColor: wine,
      inactiveTrackColor: line,
      thumbColor: wine,
      trackHeight: 3,
      showValueIndicator: ShowValueIndicator.onlyForDiscrete,
    ),
    snackBarTheme: SnackBarThemeData(
      showCloseIcon: true,
      dismissDirection: DismissDirection.horizontal,
      backgroundColor: photoDark,
      contentTextStyle: const TextStyle(color: moon, fontFamily: 'Manrope'),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    dividerTheme: const DividerThemeData(color: line, thickness: 1, space: 1),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.linux: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.macOS: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.windows: FadeForwardsPageTransitionsBuilder(),
      },
    ),
  );
}
