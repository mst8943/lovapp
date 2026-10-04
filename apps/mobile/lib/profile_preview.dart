import 'package:flutter/material.dart';
import 'models.dart';
import 'screens/profile_detail_screen.dart';
import 'theme.dart';

void main() => runApp(MaterialApp(
  debugShowCheckedModeBanner: false,
  theme: buildLovaskTheme(),
  home: const ProfilePreviewHome(),
));

const previewProfile = DiscoveryProfile(
  id: 'preview',
  name: 'Profil Önizlemesi',
  age: 27,
  city: 'İstanbul',
  image: '',
  details: {
    'relationshipGoal': 'dating',
    'maritalStatus': 'never_married',
    'childrenPreference': 'open',
    'alcoholUse': 'occasionally',
    'smokingUse': 'never',
    'petPreference': 'likes_pets',
    'sportsHabit': 'sometimes',
    'zodiac': 'virgo',
    'educationLevel': 'bachelor',
    'hasChildren': false,
    'heightCm': 173,
    'languages': ['Türkçe', 'İngilizce'],
  },
);

class ProfilePreviewHome extends StatelessWidget {
  const ProfilePreviewHome({super.key});

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    child: Scaffold(
      appBar: AppBar(title: const Text('Profil önizlemesi')),
      body: Center(
        child: FilledButton(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const ProfileDetailScreen(
                preview: true,
                profile: previewProfile,
              ),
            ),
          ),
          child: const Text('Profili aç'),
        ),
      ),
    ),
  );
}
