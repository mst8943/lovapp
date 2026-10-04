import 'package:flutter_test/flutter_test.dart';
import 'package:lovask_mobile/models.dart';

void main() {
  test('API image paths are usable by native image widgets', () {
    final profile = DiscoveryProfile.fromJson({
      'id': 'qa',
      'image': '/profiles/mert.webp',
      'photos': ['/profiles/mert.webp', 'https://cdn.example.com/second.webp'],
    });
    expect(profile.image, 'https://lovask.com.tr/profiles/mert.webp');
    expect(profile.allPhotos, [
      'https://lovask.com.tr/profiles/mert.webp',
      'https://cdn.example.com/second.webp',
    ]);
    expect(ConversationSummary.fromJson({
      'profile': {'image': '/profiles/mert.webp'},
    }).image, profile.image);
    expect(ProfileVisitor.fromJson({'image': '/profiles/mert.webp'}).image, profile.image);
  });

  test('chat photo responses render as images', () {
    final message = ChatMessage.fromJson({
      'id': 'photo', 'createdAt': '2026-09-29T00:00:00Z',
      'imageUrl': 'https://cdn.example.com/private.webp', 'from': 'them',
    });
    expect(message.mediaType, 'image');
    expect(message.mediaUrl, 'https://cdn.example.com/private.webp');
  });
}
