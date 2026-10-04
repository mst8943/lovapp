import 'package:flutter_test/flutter_test.dart';
import 'package:lovask_mobile/models.dart';

void main() {
  test('presence distinguishes offline from unavailable activity', () {
    expect(UserPresence.resolve(id: 'member', isOnline: false).label, 'Çevrimdışı');
    expect(UserPresence.resolve(id: 'member').label, 'Aktiflik bilgisi yok');
    expect(UserPresence.resolve(id: 'member', isOnline: true).label, 'Çevrimiçi');
  });
}
