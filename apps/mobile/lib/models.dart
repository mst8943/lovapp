String mediaUrl(String value) => value.startsWith('/')
    ? Uri.parse(const String.fromEnvironment(
        'LOVASK_API_URL',
        defaultValue: 'https://lovask.com.tr',
      )).resolve(value).toString()
    : value;

class DiscoveryProfile {
  const DiscoveryProfile({
    required this.id,
    required this.name,
    required this.age,
    required this.city,
    required this.image,
    this.photos = const [],
    this.prompt = '',
    this.answer = '',
    this.badges = const [],
    this.verified = false,
    this.isBot = false,
    this.likedYou = false,
    this.superLikedYou = false,
    this.details = const {},
  });

  final String id;
  final String name;
  final int age;
  final String city;
  final String image;
  final List<String> photos;
  final String prompt;
  final String answer;
  final List<String> badges;
  final bool verified;
  final bool isBot;
  final bool likedYou;
  final bool superLikedYou;
  final Map<String, dynamic> details;

  String get distance => '${details['distance'] ?? ''}';

  List<String> get allPhotos {
    if (photos.isNotEmpty) return photos;
    if (image.isNotEmpty) return [image];
    return const [];
  }

  UserPresence get presence => UserPresence.resolve(
    id: id,
    isOnline: details['isOnline'] as bool? ?? details['is_online'] as bool?,
    lastSeenAt: details['last_seen_at'] as String? ?? details['lastSeenAt'] as String?,
  );

  factory DiscoveryProfile.fromJson(Map<String, dynamic> json) {
    final rawPhotos = json['photos'] as List<dynamic>?;
    final photoList = rawPhotos != null
        ? rawPhotos.whereType<String>().map(mediaUrl).toList()
        : <String>[];

    final rawBadges = json['badges'] as List<dynamic>?;
    final badgeList = rawBadges != null
        ? rawBadges.whereType<String>().toList()
        : <String>[];

    final mainImage = mediaUrl('${json['image'] ?? ''}');
    if (photoList.isEmpty && mainImage.isNotEmpty) {
      photoList.add(mainImage);
    }

    return DiscoveryProfile(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      age: (json['age'] as num?)?.toInt() ?? 0,
      city: '${json['city'] ?? ''}',
      image: mainImage,
      photos: photoList,
      prompt: '${json['prompt'] ?? ''}',
      answer: '${json['answer'] ?? ''}',
      badges: badgeList,
      verified: json['verified'] == true,
      isBot: json['isBot'] == true,
      likedYou: json['likedYou'] == true,
      superLikedYou: json['superLikedYou'] == true,
      details: json,
    );
  }
}

class NoirPlan {
  const NoirPlan({
    required this.slug,
    required this.name,
    required this.durationDays,
    this.durationMinutes,
    required this.priceAmount,
    required this.currency,
  });

  final String slug;
  final String name;
  final int durationDays;
  final int? durationMinutes;
  final double priceAmount;
  final String currency;

  factory NoirPlan.fromJson(Map<String, dynamic> json) => NoirPlan(
    slug: '${json['slug'] ?? ''}',
    name: '${json['name'] ?? ''}',
    durationDays: (json['duration_days'] as num?)?.toInt() ?? 1,
    durationMinutes: (json['duration_minutes'] as num?)?.toInt(),
    priceAmount: (json['price_amount'] as num?)?.toDouble() ?? 0.0,
    currency: '${json['currency'] ?? 'TRY'}',
  );
}

class NoirOrder {
  const NoirOrder({
    required this.id,
    required this.status,
    required this.paymentReference,
    required this.amount,
    required this.currency,
    required this.provider,
    this.checkoutUrl,
    required this.createdAt,
    this.rejectionReason,
    this.planName,
  });

  final String id;
  final String status;
  final String paymentReference;
  final double amount;
  final String currency;
  final String provider;
  final String? checkoutUrl;
  final String createdAt;
  final String? rejectionReason;
  final String? planName;

  factory NoirOrder.fromJson(Map<String, dynamic> json) {
    final plansMap = json['premium_plans'] as Map<String, dynamic>?;
    return NoirOrder(
      id: '${json['id'] ?? ''}',
      status: '${json['status'] ?? 'awaiting_payment'}',
      paymentReference: '${json['payment_reference'] ?? ''}',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      currency: '${json['currency'] ?? 'TRY'}',
      provider: '${json['provider'] ?? 'bank_transfer'}',
      checkoutUrl: json['checkout_url'] as String?,
      createdAt: '${json['created_at'] ?? ''}',
      rejectionReason: json['rejection_reason'] as String?,
      planName: plansMap?['name'] as String?,
    );
  }
}

class PaymentMethodSetting {
  const PaymentMethodSetting({
    required this.method,
    required this.enabled,
    this.accountName,
    this.bankName,
    this.iban,
    this.instructions,
    this.paparaNumber,
    this.cryptoAsset,
    this.cryptoNetwork,
    this.walletAddress,
  });

  final String method;
  final bool enabled;
  final String? accountName;
  final String? bankName;
  final String? iban;
  final String? instructions;
  final String? paparaNumber, cryptoAsset, cryptoNetwork, walletAddress;
  String? get destination => method == 'papara'
      ? paparaNumber
      : method == 'crypto'
      ? walletAddress
      : iban;
  String get label =>
      const {
        'bank_transfer': 'Banka havalesi / EFT',
        'papara': 'Papara',
        'crypto': 'Kripto',
      }[method] ??
      method;

  factory PaymentMethodSetting.fromJson(Map<String, dynamic> json) =>
      PaymentMethodSetting(
        method: '${json['method'] ?? ''}',
        enabled: json['enabled'] == true,
        accountName: json['account_name'] as String?,
        bankName: json['bank_name'] as String?,
        iban: json['iban'] as String?,
        instructions: json['instructions'] as String?,
        paparaNumber: json['papara_number'] as String?,
        cryptoAsset: json['crypto_asset'] as String?,
        cryptoNetwork: json['crypto_network'] as String?,
        walletAddress: json['wallet_address'] as String?,
      );
}

class ProfileVisitor {
  const ProfileVisitor({
    required this.id,
    required this.name,
    required this.age,
    required this.city,
    required this.verified,
    required this.image,
    required this.visitedAt,
  });

  final String id;
  final String name;
  final int age;
  final String city;
  final bool verified;
  final String image;
  final String visitedAt;

  factory ProfileVisitor.fromJson(Map<String, dynamic> json) => ProfileVisitor(
    id: '${json['id'] ?? ''}',
    name: '${json['name'] ?? ''}',
    age: (json['age'] as num?)?.toInt() ?? 0,
    city: '${json['city'] ?? ''}',
    verified: json['verified'] == true,
    image: mediaUrl('${json['image'] ?? ''}'),
    visitedAt: '${json['visitedAt'] ?? ''}',
  );
}

class UserPresence {
  const UserPresence({
    required this.isOnline,
    required this.label,
  });

  final bool isOnline;
  final String label;

  static UserPresence resolve({
    required String id,
    bool? isOnline,
    String? lastSeenAt,
  }) {
    if (isOnline == true) {
      return const UserPresence(isOnline: true, label: 'Çevrimiçi');
    }

    if (lastSeenAt != null && lastSeenAt.isNotEmpty) {
      final date = DateTime.tryParse(lastSeenAt)?.toLocal();
      if (date != null) {
        final now = DateTime.now();
        final diff = now.difference(date);
        final minutes = diff.inMinutes;

        if (minutes < 5) {
          return const UserPresence(isOnline: true, label: 'Çevrimiçi');
        } else if (minutes < 15) {
          return const UserPresence(isOnline: false, label: 'Az önce aktifti');
        } else if (minutes < 60) {
          return UserPresence(isOnline: false, label: '$minutes dk önce aktifti');
        } else if (date.year == now.year && date.month == now.month && date.day == now.day) {
          final hh = date.hour.toString().padLeft(2, '0');
          final mm = date.minute.toString().padLeft(2, '0');
          return UserPresence(isOnline: false, label: 'Bugün $hh:$mm');
        } else if (diff.inHours < 48) {
          return const UserPresence(isOnline: false, label: 'Dün');
        } else {
          final dd = date.day.toString().padLeft(2, '0');
          final mm = date.month.toString().padLeft(2, '0');
          return UserPresence(isOnline: false, label: '$dd.$mm');
        }
      }
    }

    return UserPresence(isOnline: false, label: isOnline == false ? 'Çevrimdışı' : 'Aktiflik bilgisi yok');
  }
}

class ConversationSummary {
  const ConversationSummary({
    required this.matchId,
    required this.profileId,
    required this.name,
    required this.image,
    required this.lastMessage,
    required this.unreadCount,
    this.updatedAt,
    this.request,
    this.pending = false,
    this.isOnline,
    this.lastSeenAt,
    this.isBot = false,
  });

  final String matchId;
  final String profileId;
  final String name;
  final String image;
  final String lastMessage;
  final int unreadCount;
  final String? updatedAt;
  final Map<String, dynamic>? request;
  final bool pending;
  final bool? isOnline;
  final String? lastSeenAt;
  final bool isBot;

  UserPresence get presence => UserPresence.resolve(
    id: profileId,
    isOnline: isOnline,
    lastSeenAt: lastSeenAt,
  );

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'] as Map<String, dynamic>? ?? const {};
    return ConversationSummary(
      matchId: '${json['matchId'] ?? json['id'] ?? ''}',
      profileId: '${profile['id'] ?? json['profileId'] ?? ''}',
      name: '${profile['name'] ?? 'Profil'}',
      image: mediaUrl('${profile['image'] ?? ''}'),
      lastMessage: '${json['lastMessage'] ?? 'Yeni sohbet'}',
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      updatedAt:
          json['lastMessageAt'] as String? ?? json['updatedAt'] as String?,
      request: json['request'] as Map<String, dynamic>?,
      pending: json['pending'] == true,
      isOnline: profile['isOnline'] as bool? ?? profile['is_online'] as bool?,
      lastSeenAt: profile['lastSeenAt'] as String? ?? profile['last_seen_at'] as String?,
      isBot: profile['isBot'] == true,
    );
  }
}

List<ChatMessage> mergeChatMessages(
  List<ChatMessage> current,
  List<ChatMessage> incoming,
) {
  final messages = {
    for (final message in [...current, ...incoming]) message.id: message,
  }.values.toList();
  messages.sort((a, b) {
    final order = a.createdAt.compareTo(b.createdAt);
    return order == 0 ? a.id.compareTo(b.id) : order;
  });
  return messages;
}

String chatTime(String timestamp) {
  final date = DateTime.tryParse(timestamp)?.toLocal();
  return date == null
      ? ''
      : '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.text,
    required this.createdAt,
    this.mediaUrl,
    this.mediaType,
    this.isMine = false,
    this.readAt,
    this.durationMs,
    this.replyToId,
    this.replyText,
    this.deleted = false,
    this.reactions = const [],
  });

  final String id;
  final String senderId;
  final String text;
  final String createdAt;
  final String? mediaUrl;
  final String? mediaType;
  final bool isMine;
  final String? readAt;
  final int? durationMs;
  final String? replyToId;
  final String? replyText;
  final bool deleted;
  final List<Map<String, dynamic>> reactions;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: '${json['id'] ?? ''}',
    senderId: '${json['senderId'] ?? json['sender_id'] ?? ''}',
    text: '${json['text'] ?? json['body'] ?? json['content'] ?? ''}',
    createdAt: '${json['createdAt'] ?? json['created_at'] ?? ''}',
    mediaUrl: (json['audioUrl'] ?? json['imageUrl'] ?? json['mediaUrl']) as String?,
    mediaType: json['audio'] == true || json['kind'] == 'audio'
        ? 'audio'
        : json['imageUrl'] != null || json['kind'] == 'image' ? 'image' : json['mediaType'] as String?,
    readAt: (json['readAt'] ?? json['read_at']) as String?,
    durationMs: (json['durationMs'] ?? json['audio_duration_ms']) as int?,
    isMine: json['from'] == 'me',
    replyToId: json['replyToId'] as String?,
    replyText: json['replyText'] as String?,
    deleted: json['deleted'] == true,
    reactions: (json['reactions'] as List? ?? [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(),
  );
}
