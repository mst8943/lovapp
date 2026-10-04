import 'dart:async';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import 'voice_message.dart';
import 'safety_sheet.dart';
import '../widgets/lovask_primitives.dart';
import '../widgets/lovask_motion.dart';
import '../widgets/boost_sheet.dart';
import '../services/notification_service.dart';

class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({
    super.key,
    this.api,
    this.onUnreadCount,
    this.onOpenNoir,
    this.active = true,
  });
  final LovaskApi? api;
  final ValueChanged<int>? onUnreadCount;
  final VoidCallback? onOpenNoir;
  final bool active;

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen>
    with WidgetsBindingObserver {
  late final api = widget.api ?? LovaskApi();
  bool _loading = true;
  String? _error;
  List<ConversationSummary> _conversations = [];
  Timer? _poll;
  bool _fetching = false;
  int _filter = 0;
  bool _searching = false;
  String _query = '';
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    WidgetsBinding.instance.addObserver(this);
    _poll = Timer.periodic(const Duration(seconds: 15), (_) {
      if (widget.active &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _loadConversations(silent: true);
      }
    });
  }

  @override
  void didUpdateWidget(covariant ConversationsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) _loadConversations(silent: true);
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (widget.active && state == AppLifecycleState.resumed) {
      _loadConversations(silent: true);
    }
  }

  Future<void> _loadConversations({bool silent = false}) async {
    if (!mounted || _fetching) return;
    _fetching = true;
    setState(() {
      _loading = !silent && _conversations.isEmpty;
      _error = null;
    });

    try {
      final res = await api.conversations();
      final items = res['conversations'] as List<dynamic>? ?? [];

      if (mounted) {
        setState(() {
          _conversations = items
              .whereType<Map<String, dynamic>>()
              .map(ConversationSummary.fromJson)
              .toList();
          _loading = false;
        });
        widget.onUnreadCount?.call(
          _conversations.fold<int>(
            0,
            (total, item) => total + item.unreadCount,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    } finally {
      _fetching = false;
    }
  }

  void _openConversation(ConversationSummary item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatScreen(
          profileId: item.profileId,
          name: item.name,
          avatarUrl: item.image,
          matchId: item.matchId,
          isBot: item.isBot,
        ),
      ),
    ).then((_) => _loadConversations());
  }

  Future<void> _deleteConversation(ConversationSummary item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sohbet silinsin mi?'),
        content: const Text(
          'Bu sohbet yalnızca senin mesaj listenden kaldırılır.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sohbeti sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await api.deleteConversation(item.matchId);
      if (mounted) {
        setState(
          () => _conversations.removeWhere(
            (value) => value.matchId == item.matchId,
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text('$error'),
          ),
        );
      }
    }
  }

  Widget _indexHeader() {
    final compact = MediaQuery.sizeOf(context).height < 700;
    final matches = _conversations
        .where((item) => item.request == null && !item.pending)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
          child: Row(
            children: [
              for (final entry in [
                'Tümü (${_conversations.length})',
                'Eşleşmeler',
                'İstekler',
              ].asMap().entries)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 5),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: () => setState(() => _filter = entry.key),
                      child: Container(
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _filter == entry.key ? photoDark : panel,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          entry.value,
                          style: TextStyle(
                            color: _filter == entry.key ? Colors.white : muted2,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_searching)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              autofocus: true,
              onChanged: (value) =>
                  setState(() => _query = value.trim().toLowerCase()),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Sohbetlerde ara',
              ),
            ),
          ),
        if (_query.isEmpty && matches.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'İlk sözü bekleyenler',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (matches.isNotEmpty)
                  TextButton(
                    onPressed: () => setState(() => _filter = 1),
                    child: const Text(
                      'Tümünü gör →',
                      style: TextStyle(color: muted, fontSize: 11),
                    ),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: compact
                ? 76
                : 104 + (MediaQuery.textScalerOf(context).scale(11) - 11),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              itemCount: matches.length,
              separatorBuilder: (_, _) => SizedBox(width: compact ? 10 : 14),
              itemBuilder: (context, index) {
                final item = matches[index];
                return InkWell(
                  onTap: () => _openConversation(item),
                  child: SizedBox(
                    width: compact ? 58 : 70,
                    child: Column(
                      children: [
                        LovaskAvatar(
                          url: item.image,
                          size: compact ? 44 : 68,
                          online: item.presence.isOnline,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 11, color: pearl),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final visible = _conversations.where((item) {
      if (_filter == 1 && (item.request != null || item.pending)) return false;
      if (_filter == 2 && item.request == null && !item.pending) return false;
      if (_unreadOnly && item.unreadCount == 0) return false;
      return _query.isEmpty || item.name.toLowerCase().contains(_query);
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mesajlar'),
        actions: [
          BoostIconButton(
            onPressed: () => showBoostSheet(
              context,
              api: api,
              onOpenNoir: widget.onOpenNoir ?? () {},
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Sohbet ara',
            style: IconButton.styleFrom(backgroundColor: panelLight),
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) _query = '';
            }),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 12, left: 4),
            child: PopupMenuButton<String>(
              tooltip: 'Mesaj seçenekleri',
              icon: const Icon(Icons.more_vert),
              style: IconButton.styleFrom(backgroundColor: panelLight),
              onSelected: (value) {
                if (value == 'refresh') {
                  _loadConversations();
                } else {
                  setState(() => _unreadOnly = !_unreadOnly);
                }
              },
              itemBuilder: (_) => [
                CheckedPopupMenuItem(
                  value: 'unread',
                  checked: _unreadOnly,
                  child: const Text('Yalnızca okunmamışlar'),
                ),
                const PopupMenuItem(
                  value: 'refresh',
                  child: Text('Sohbetleri yenile'),
                ),
              ],
            ),
          ),
        ],
        bottom: _fetching && _conversations.isNotEmpty
            ? const PreferredSize(
                preferredSize: Size.fromHeight(2),
                child: LinearProgressIndicator(minHeight: 2, color: ruby),
              )
            : null,
      ),
      body: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Güzel bir sohbetin devamı burada.',
                style: TextStyle(color: muted, fontSize: 13),
              ),
            ),
          ),
          _indexHeader(),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: gold))
                : _error != null
                ? Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: ruby),
                          ),
                          const SizedBox(height: 12),
                          LovaskGhostButton(
                            label: 'Tekrar dene',
                            onPressed: _loadConversations,
                          ),
                        ],
                      ),
                    ),
                  )
                : visible.isEmpty
                ? LovaskEmptyState(
                    title: _conversations.isEmpty
                        ? 'Bir merhaba ile başlar.'
                        : 'Henüz bir ses yok.',
                    message: _conversations.isEmpty
                        ? 'Eşleşmelerin ve mesaj isteklerin burada buluşacak.'
                        : 'Diğer sekmelere bakabilir veya aramanı değiştirebilirsin.',
                  )
                : RefreshIndicator(
                    color: gold,
                    onRefresh: _loadConversations,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: visible.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final item = visible[index];
                        return Material(
                          color: panel,
                          elevation: 2,
                          shadowColor: const Color(0x2055227C),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                            side: const BorderSide(color: line),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: InkWell(
                            onTap: () => _openConversation(item),
                            onLongPress: () => _deleteConversation(item),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10,
                              ),
                              child: Row(
                                children: [
                                  LovaskAvatar(
                                    url: item.image,
                                    size: 64,
                                    online: item.presence.isOnline,
                                  ),
                                  const SizedBox(width: 13),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                item.name,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontFamily:
                                                      'CormorantGaramond',
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Flexible(
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Container(
                                                    width: 6,
                                                    height: 6,
                                                    decoration: BoxDecoration(
                                                      color:
                                                          item.presence.isOnline
                                                          ? const Color(
                                                              0xFF22C55E,
                                                            )
                                                          : const Color(
                                                              0xFF94A3B8,
                                                            ),
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Flexible(
                                                    child: Text(
                                                      item.presence.label,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                        color:
                                                            item
                                                                .presence
                                                                .isOnline
                                                            ? const Color(
                                                                0xFF4ADE80,
                                                              )
                                                            : muted,
                                                        fontSize: 11,
                                                        fontWeight:
                                                            FontWeight.w500,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          item.lastMessage.trim().isNotEmpty &&
                                                  item.lastMessage !=
                                                      'Yeni sohbet'
                                              ? item.lastMessage
                                              : item.request != null
                                              ? (item.request!['incoming'] ==
                                                        true
                                                    ? 'Gelen mesaj isteği'
                                                    : (item.request!['status'] ==
                                                              'draft'
                                                          ? 'Mesaj isteğini yaz'
                                                          : 'Mesaj isteği gönderildi'))
                                              : item.pending
                                              ? 'Yanıt bekleniyor…'
                                              : 'Yeni sohbet',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: muted,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (item.updatedAt != null)
                                        Text(
                                          chatTime(item.updatedAt!),
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: muted,
                                          ),
                                        ),
                                      const SizedBox(height: 6),
                                      item.unreadCount > 0
                                          ? Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 4,
                                                  ),
                                              decoration: BoxDecoration(
                                                gradient: actionGradient,
                                                borderRadius:
                                                    BorderRadius.circular(999),
                                              ),
                                              child: Text(
                                                '${item.unreadCount}',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            )
                                          : const SizedBox(width: 20),
                                    ],
                                  ),
                                  const SizedBox(width: 5),
                                  const Icon(
                                    Icons.chevron_right,
                                    size: 18,
                                    color: wine,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    required this.profileId,
    required this.name,
    this.avatarUrl,
    this.matchId,
    this.isBot = false,
    this.api,
    super.key,
  });

  final String profileId;
  final String name;
  final String? avatarUrl;
  final String? matchId;
  final bool isBot;
  final LovaskApi? api;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  late final api = widget.api ?? LovaskApi();
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  RealtimeChannel? _realtimeChannel;

  List<ChatMessage> _messages = [];
  bool _loading = true;
  String? _error;
  bool _sending = false;
  bool _matched = false, _wingmanBusy = false;
  String? _myProfileId;
  String? _matchId;
  Map<String, dynamic>? _request;
  Map<String, dynamic>? _cursor;
  bool _hasMore = false, _olderBusy = false, _fetching = false, _typing = false;
  bool _online = false;
  String _presenceLabel = 'Çevrimiçi';
  bool _newMessages = false;
  String? _sendError;
  Timer? _poll;
  String? _retryText, _clientId;
  ChatMessage? _replyTo;

  bool get _canSend =>
      _request == null ||
      (_request!['incoming'] != true && _request!['status'] == 'draft');

  @override
  void initState() {
    super.initState();
    NotificationService.activeChatMatchId = widget.matchId;
    _scrollController.addListener(() {
      if (_newMessages && _scrollController.position.extentAfter < 100) {
        setState(() => _newMessages = false);
      }
    });
    _loadMessages();
    WidgetsBinding.instance.addObserver(this);
    _poll = Timer.periodic(const Duration(seconds: 8), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        _loadMessages(silent: true);
      }
    });
  }

  @override
  void dispose() {
    NotificationService.activeChatMatchId = null;
    _touchActiveChat(false);
    _inputController.dispose();
    _scrollController.dispose();
    _realtimeChannel?.unsubscribe();
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadMessages(silent: true);
    } else {
      _touchActiveChat(false);
    }
  }

  Future<void> _touchActiveChat(bool open) async {
    final id = _matchId;
    if (id == null) return;
    try {
      await api.activeChat(id, open);
    } catch (_) {}
  }

  void _setupRealtime([String? resolvedMatchId]) {
    final id = resolvedMatchId ?? widget.matchId;
    if (id != null && id.isNotEmpty && _realtimeChannel == null) {
      try {
        _realtimeChannel = api.messageChannel(id, (newRecord) {
          if (mounted) {
            // The API supplies sender direction, signed audio URLs and marks
            // incoming messages read; raw realtime rows do not.
            _loadMessages(silent: true);
          }
        });
      } catch (_) {}
    }
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!mounted || _fetching) return;
    _fetching = true;
    final nearBottom =
        !_scrollController.hasClients ||
        _scrollController.position.extentAfter < 100;
    setState(() {
      _loading = !silent && _messages.isEmpty;
      _error = null;
    });

    try {
      final res = await api.messages(widget.profileId);
      final list = res['messages'] as List<dynamic>? ?? [];

      if (mounted) {
        _setupRealtime(res['matchId'] as String?);
        setState(() {
          _myProfileId = res['currentProfileId'] as String?;
          _matchId = res['matchId'] as String? ?? widget.matchId;
          _request = res['request'] as Map<String, dynamic>?;
          _matched = res['matched'] == true;
          _typing = (res['botState'] as Map?)?['typing'] == true;
          final presenceMap = res['presence'] as Map<String, dynamic>?;
          final resolvedPresence = UserPresence.resolve(
            id: widget.profileId,
            isOnline: presenceMap?['is_online'] as bool?,
            lastSeenAt: presenceMap?['last_seen_at'] as String?,
          );
          _online = resolvedPresence.isOnline;
          _presenceLabel = resolvedPresence.label;
          if (!silent || _cursor == null) {
            _cursor = res['nextCursor'] as Map<String, dynamic>?;
            _hasMore = res['hasMore'] == true;
          }
          final incoming = list
              .whereType<Map<String, dynamic>>()
              .map(ChatMessage.fromJson)
              .toList();
          final previousIds = _messages.map((message) => message.id).toSet();
          if (silent &&
              !nearBottom &&
              incoming.any((message) => !previousIds.contains(message.id))) {
            _newMessages = true;
          }
          _messages = mergeChatMessages(silent ? _messages : [], incoming);
          _loading = false;
        });
        _touchActiveChat(true);
        if (!silent || nearBottom) _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    } finally {
      _fetching = false;
    }
  }

  Future<void> _askWingman() async {
    if (_wingmanBusy) return;
    setState(() => _wingmanBusy = true);
    try {
      final result = await api.wingman(widget.profileId);
      if (!mounted) return;
      final suggestions = (result['suggestions'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList();
      await showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (sheetContext) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.auto_awesome,
                      color: Color(0xFF7C3AED),
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Sohbet Açılış Önerileri',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF261935),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (suggestions.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'Şu an için öneri üretilemedi. Kendin bir mesaj yazabilirsin.',
                      style: TextStyle(color: muted),
                    ),
                  )
                else
                  for (final suggestion in suggestions)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFAF6FD),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFEADBFA)),
                      ),
                      child: ListTile(
                        dense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 2,
                        ),
                        title: Text(
                          suggestion,
                          style: const TextStyle(
                            fontSize: 13.5,
                            color: Color(0xFF261935),
                          ),
                        ),
                        trailing: const Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 14,
                          color: Color(0xFF7C3AED),
                        ),
                        onTap: () {
                          _inputController.text = suggestion;
                          _inputController.selection = TextSelection.collapsed(
                            offset: suggestion.length,
                          );
                          Navigator.pop(sheetContext);
                        },
                      ),
                    ),
              ],
            ),
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text('$error'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _wingmanBusy = false);
    }
  }

  Future<void> _loadOlder() async {
    if (_olderBusy || !_hasMore || _cursor == null) return;
    setState(() => _olderBusy = true);
    final oldExtent = _scrollController.hasClients
        ? _scrollController.position.maxScrollExtent
        : 0.0;
    final oldOffset = _scrollController.hasClients
        ? _scrollController.offset
        : 0.0;
    try {
      final result = await api.messages(
        widget.profileId,
        before: _cursor!['createdAt'],
        beforeId: _cursor!['id'],
      );
      if (!mounted) return;
      setState(() {
        _messages = mergeChatMessages(
          _messages,
          (result['messages'] as List)
              .map((m) => ChatMessage.fromJson(Map<String, dynamic>.from(m)))
              .toList(),
        );
        _cursor = result['nextCursor'] as Map<String, dynamic>?;
        _hasMore = result['hasMore'] == true;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(
            (oldOffset + _scrollController.position.maxScrollExtent - oldExtent)
                .clamp(0, _scrollController.position.maxScrollExtent),
          );
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text(e.toString()),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _olderBusy = false);
    }
  }

  Future<void> _respond(String action) async {
    if (_matchId == null || _sending) return;
    setState(() => _sending = true);
    try {
      await api.respondRequest(_matchId!, action);
      if (!mounted) return;
      if (action == 'reject') {
        Navigator.pop(context);
      } else {
        await _loadMessages(silent: true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text(e.toString()),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToBottom() {
    if (mounted && _newMessages) setState(() => _newMessages = false);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _showCannotSendNotice() async {
    if (_request != null) {
      final incoming = _request!['incoming'] == true;
      final status = _request!['status'];
      if (incoming) {
        await showLovaskNoticeSheet(
          context,
          title: 'Mesaj İsteği Bekliyor',
          message:
              'Bu üyeden gelen bir mesaj isteğin var. Yanıt verebilmek için önce isteği kabul etmelisin.',
          icon: Icons.mail_outline_rounded,
        );
        return;
      }
      if (status == 'pending') {
        await showLovaskNoticeSheet(
          context,
          title: 'İstek Yanıtı Bekleniyor',
          message:
              'Mesaj isteğin karşı tarafa iletildi. Karşı taraf kabul ettiğinde sohbete devam edebilirsin.',
          icon: Icons.hourglass_top_rounded,
        );
        return;
      }
    }
    await showLovaskNoticeSheet(
      context,
      title: 'Mesaj Gönderilemiyor',
      message:
          'Bu sohbet şu anda yeni mesaj alımına kapalı veya sınırlandırılmış durumda.',
      icon: Icons.info_outline_rounded,
    );
  }

  Future<void> _send() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _sending) return;
    if (!_canSend) {
      _showCannotSendNotice();
      return;
    }
    if (text.length > 1200) return;

    setState(() {
      _sending = true;
      _sendError = null;
    });

    try {
      if (_retryText != text) {
        _retryText = text;
        _clientId = const Uuid().v4();
      }
      await api.sendMessage(
        widget.profileId,
        text,
        clientId: _clientId,
        replyToId: _replyTo?.id,
      );
      _retryText = null;
      _clientId = null;
      if (_inputController.text.trim() == text) _inputController.clear();
      if (mounted) setState(() => _replyTo = null);
      await _loadMessages(silent: true);
      if (mounted) {
        setState(() {
          _sending = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _sending = false;
          _sendError = e.toString();
        });
      }
    }
  }

  Future<void> _messageActions(ChatMessage message, bool isMine) async {
    if (message.deleted) return;
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Yanıtla'),
              onTap: () => Navigator.pop(sheetContext, 'reply'),
            ),
            for (final emoji in ['❤️', '😂', '✨', '👍', '😮'])
              ListTile(
                leading: Text(emoji, style: const TextStyle(fontSize: 22)),
                title: Text('$emoji tepki ver'),
                onTap: () => Navigator.pop(sheetContext, emoji),
              ),
            if (message.reactions.any(
              (item) => item['profileId'] == _myProfileId,
            ))
              ListTile(
                leading: const Icon(Icons.close),
                title: const Text('Tepkimi kaldır'),
                onTap: () => Navigator.pop(sheetContext, 'remove'),
              ),
            if (isMine)
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: const Text('Mesajı herkesten sil'),
                onTap: () => Navigator.pop(sheetContext, 'delete'),
              ),
            if (!isMine)
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: const Text('Mesajı şikâyet et'),
                onTap: () => Navigator.pop(sheetContext, 'report'),
              ),
          ],
        ),
      ),
    );
    if (!mounted || action == null) return;
    if (action == 'reply') {
      setState(() => _replyTo = message);
      return;
    }
    try {
      if (action == 'report') {
        await api.safety({
          'action': 'report',
          'targetProfileId': widget.profileId,
          'reason': 'inappropriate_content',
          'details': 'Sohbet mesajı: ${message.id}',
          'matchId': _matchId,
          'block': false,
        });
      } else if (action == 'delete') {
        await api.deleteMessage(message.id);
      } else {
        await api.reactToMessage(
          message.id,
          action == 'remove' ? null : action,
        );
      }
      if (action != 'report') await _loadMessages(silent: true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 6),
            content: Text('$error'),
          ),
        );
      }
    }
  }

  void _showQuickActionsMenu() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_outlined),
                title: const Text('Fotoğraf gönder'),
                enabled: _canSend && _matchId != null && !_sending,
                onTap: () async {
                  Navigator.pop(sheetContext);
                  final file = await ImagePicker().pickImage(
                    source: ImageSource.gallery,
                  );
                  if (file == null || _matchId == null) return;
                  setState(() => _sending = true);
                  try {
                    await api.sendChatImage(_matchId!, file);
                    await _loadMessages(silent: true);
                  } catch (error) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          duration: const Duration(seconds: 6),
                          content: Text('$error'),
                        ),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _sending = false);
                  }
                },
              ),
              ListTile(
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF3E7FC),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    color: Color(0xFF7C3AED),
                    size: 20,
                  ),
                ),
                title: const Text(
                  'Sohbet Açılışı Öner',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: const Text(
                  'Wingman ile yaratıcı bir mesaj taslağı oluştur.',
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  if (!_wingmanBusy) _askWingman();
                },
              ),
              ListTile(
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF3EDF8),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.mic_none_rounded,
                    color: Color(0xFF261935),
                    size: 20,
                  ),
                ),
                title: const Text(
                  'Sesli Mesaj Gönder',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: const Text('Sesini kaydedip doğrudan gönder.'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  showModalBottomSheet(
                    context: context,
                    useSafeArea: true,
                    isScrollControlled: true,
                    showDragHandle: true,
                    builder: (sheetCtx) => Padding(
                      padding: const EdgeInsets.all(24),
                      child: VoiceComposer(
                        profileId: widget.profileId,
                        onSent: () {
                          Navigator.pop(sheetCtx);
                          _loadMessages(silent: true);
                        },
                      ),
                    ),
                  );
                },
              ),
              ListTile(
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFEE2E2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.shield_outlined,
                    color: Color(0xFFDC2626),
                    size: 20,
                  ),
                ),
                title: const Text(
                  'Güvenlik ve Şikayet',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: const Text(
                  'Profili engelle, bildir veya ipuçlarını oku.',
                ),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  final closed = await showSafetySheet(
                    context,
                    widget.profileId,
                    matchId: _matchId,
                  );
                  if (mounted && closed == true) {
                    Navigator.pop(context);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFCF9FE),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: 0,
        leadingWidth: 62,
        leading: Padding(
          padding: const EdgeInsets.only(left: 14),
          child: Center(
            child: InkWell(
              onTap: () => Navigator.maybePop(context),
              borderRadius: BorderRadius.circular(99),
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: Color(0xFFF3EDF8),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.chevron_left_rounded,
                  color: Color(0xFF261935),
                  size: 26,
                ),
              ),
            ),
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: Center(
              child: Tooltip(
                message: 'Güvenlik ve Seçenekler',
                child: InkWell(
                  onTap: () async {
                    final closed = await showSafetySheet(
                      context,
                      widget.profileId,
                      matchId: _matchId,
                    );
                    if (!context.mounted) return;
                    if (closed == true) {
                      Navigator.pop(context);
                    }
                  },
                  borderRadius: BorderRadius.circular(99),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF3EDF8),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.more_horiz_rounded,
                      color: Color(0xFF261935),
                      size: 22,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
        title: Row(
          children: [
            LovaskAvatar(url: widget.avatarUrl, size: 40, online: _online),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Manrope',
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF261935),
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    _typing
                        ? 'Yazıyor…'
                        : (_online ? 'Şu an aktif' : _presenceLabel),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF8E8499),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Stack(
        children: [
          const Positioned.fill(
            child: CustomPaint(painter: _ChatBackgroundPainter()),
          ),
          Column(
            children: [
              if (_request != null)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Text(
                        _request!['incoming'] == true
                            ? 'Mesaj isteğini kabul ederek sohbete başlayabilirsin.'
                            : _request!['status'] == 'draft'
                            ? 'İlk mesajın bir sohbet isteği olarak gönderilecek.'
                            : 'Mesaj isteğinin kabul edilmesi bekleniyor. 24 saat sonra arşive kalkar.',
                        style: const TextStyle(color: Color(0xFF261935)),
                      ),
                      if (_request!['incoming'] == true)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 10,
                            runSpacing: 8,
                            children: [
                              LovaskGhostButton(
                                icon: Icons.close,
                                label: 'Reddet',
                                onPressed: _sending
                                    ? null
                                    : () => _respond('reject'),
                              ),
                              LovaskPrimaryButton(
                                icon: Icons.check,
                                label: 'Kabul et',
                                onPressed: _sending
                                    ? null
                                    : () => _respond('accept'),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              if (_matched || _request == null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _wingmanBusy ? null : _askWingman,
                      borderRadius: BorderRadius.circular(20),
                      child: Ink(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [Color(0xFFFAF5FE), Color(0xFFF3E5FC)],
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: const Color(0xFFEADBFA),
                            width: 1,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x086B21A8),
                              blurRadius: 8,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.auto_awesome,
                              size: 19,
                              color: Color(0xFF8B3FD6),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _wingmanBusy
                                    ? 'Öneriler hazırlanıyor…'
                                    : 'Sohbet açılışı öner',
                                style: const TextStyle(
                                  color: Color(0xFF6B21A8),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -0.1,
                                ),
                              ),
                            ),
                            if (_wingmanBusy)
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF8B3FD6),
                                ),
                              )
                            else
                              const Icon(
                                Icons.chevron_right_rounded,
                                size: 22,
                                color: Color(0xFF8B3FD6),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              if (_hasMore)
                TextButton(
                  onPressed: _olderBusy ? null : _loadOlder,
                  child: Text(_olderBusy ? 'Yükleniyor…' : 'Önceki mesajlar'),
                ),
              if (_typing) const LovaskTyping(),
              if (_error != null && _messages.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Bağlantı kesildi. Mesajların burada korunuyor.',
                          style: TextStyle(color: muted, fontSize: 12),
                        ),
                      ),
                      TextButton(
                        onPressed: () => _loadMessages(silent: true),
                        child: const Text('Yenile'),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(color: wine),
                      )
                    : _error != null && _messages.isEmpty
                    ? Center(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!, style: const TextStyle(color: ruby)),
                              const SizedBox(height: 12),
                              LovaskGhostButton(
                                label: 'Tekrar dene',
                                onPressed: _loadMessages,
                              ),
                            ],
                          ),
                        ),
                      )
                    : _messages.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 54,
                                height: 54,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFF3E7FC),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.favorite_outline,
                                  color: Color(0xFF7C3AED),
                                  size: 28,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                '${widget.name} ile yeni bir sohbet başlat.',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Color(0xFF8E8499),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final msg = _messages[index];
                          final isMine =
                              msg.isMine ||
                              (_myProfileId != null &&
                                  msg.senderId == _myProfileId);

                          final date = DateTime.tryParse(
                            msg.createdAt,
                          )?.toLocal();
                          final previousDate = index == 0
                              ? null
                              : DateTime.tryParse(
                                  _messages[index - 1].createdAt,
                                )?.toLocal();
                          final newDay =
                              date != null &&
                              (previousDate == null ||
                                  date.year != previousDate.year ||
                                  date.month != previousDate.month ||
                                  date.day != previousDate.day);
                          final grouped =
                              index > 0 &&
                              !newDay &&
                              _messages[index - 1].isMine == msg.isMine &&
                              _messages[index - 1].senderId == msg.senderId;

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (newDay)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 18,
                                  ),
                                  child: Row(
                                    children: [
                                      const SizedBox(width: 36),
                                      const Expanded(
                                        child: Divider(
                                          color: Color(0xFFE5D8EE),
                                          thickness: 0.8,
                                          height: 1,
                                        ),
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 14,
                                        ),
                                        child: Text(
                                          '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: Color(0xFFAAA0B8),
                                            letterSpacing: 0.3,
                                          ),
                                        ),
                                      ),
                                      const Expanded(
                                        child: Divider(
                                          color: Color(0xFFE5D8EE),
                                          thickness: 0.8,
                                          height: 1,
                                        ),
                                      ),
                                      const SizedBox(width: 36),
                                    ],
                                  ),
                                ),
                              Align(
                                alignment: isMine
                                    ? Alignment.centerRight
                                    : Alignment.centerLeft,
                                child: GestureDetector(
                                  onLongPress: () =>
                                      _messageActions(msg, isMine),
                                  child: Container(
                                    margin: EdgeInsets.only(
                                      top: grouped ? 2 : 6,
                                      bottom: 2,
                                      left: isMine ? 48 : 8,
                                      right: isMine ? 8 : 48,
                                    ),
                                    constraints: BoxConstraints(
                                      maxWidth:
                                          MediaQuery.of(context).size.width *
                                          0.74,
                                    ),
                                    child: CustomPaint(
                                      painter: _ChatBubblePainter(
                                        isMine: isMine,
                                        gradient: isMine
                                            ? const LinearGradient(
                                                begin: Alignment.topLeft,
                                                end: Alignment.bottomRight,
                                                colors: [
                                                  Color(0xFF4C1D54),
                                                  Color(0xFF280735),
                                                ],
                                              )
                                            : null,
                                        color: isMine ? null : Colors.white,
                                      ),
                                      child: Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          14,
                                          9,
                                          14,
                                          8,
                                        ),
                                        child: IntrinsicWidth(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.stretch,
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              if (msg.replyText != null)
                                                Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                        bottom: 6,
                                                      ),
                                                  child: Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 8,
                                                          vertical: 4,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: isMine
                                                          ? const Color(
                                                              0x22FFFFFF,
                                                            )
                                                          : const Color(
                                                              0x1055227C,
                                                            ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            8,
                                                          ),
                                                      border: Border(
                                                        left: BorderSide(
                                                          color: isMine
                                                              ? const Color(
                                                                  0xFFE9CFFF,
                                                                )
                                                              : const Color(
                                                                  0xFF7C3AED,
                                                                ),
                                                          width: 3,
                                                        ),
                                                      ),
                                                    ),
                                                    child: Text(
                                                      msg.replyText!,
                                                      maxLines: 2,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                        color: isMine
                                                            ? const Color(
                                                                0xFFE9CFFF,
                                                              )
                                                            : const Color(
                                                                0xFF6B21A8,
                                                              ),
                                                        fontSize: 12,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              if (msg.mediaType == 'image' &&
                                                  msg.mediaUrl != null)
                                                ClipRRect(
                                                  borderRadius:
                                                      BorderRadius.circular(12),
                                                  child: Image.network(
                                                    msg.mediaUrl!,
                                                    width: 220,
                                                    height: 260,
                                                    fit: BoxFit.cover,
                                                  ),
                                                )
                                              else if (msg.mediaType == 'audio')
                                                msg.mediaUrl != null
                                                    ? VoicePlayer(
                                                        key: ValueKey(msg.id),
                                                        url: msg.mediaUrl!,
                                                        durationMs:
                                                            msg.durationMs,
                                                        foreground: isMine
                                                            ? Colors.white
                                                            : const Color(
                                                                0xFF261935,
                                                              ),
                                                      )
                                                    : const Text(
                                                        'Ses yükleniyor…',
                                                        style: TextStyle(
                                                          fontSize: 13,
                                                        ),
                                                      )
                                              else
                                                Text(
                                                  msg.text,
                                                  style: TextStyle(
                                                    color: isMine
                                                        ? Colors.white
                                                        : const Color(
                                                            0xFF261935,
                                                          ),
                                                    fontSize: 14.5,
                                                    height: 1.35,
                                                    fontWeight: isMine
                                                        ? FontWeight.w500
                                                        : FontWeight.w400,
                                                  ),
                                                ),
                                              if (msg.reactions.isNotEmpty)
                                                Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                        top: 4,
                                                      ),
                                                  child: Text(
                                                    msg.reactions
                                                        .map(
                                                          (item) =>
                                                              item['emoji'],
                                                        )
                                                        .join(' '),
                                                    style: const TextStyle(
                                                      fontSize: 15,
                                                    ),
                                                  ),
                                                ),
                                              const SizedBox(height: 4),
                                              if (isMine)
                                                Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.end,
                                                  mainAxisSize:
                                                      MainAxisSize.min,
                                                  children: [
                                                    Text(
                                                      '${chatTime(msg.createdAt)} · ${msg.readAt != null ? "Okundu" : "Gönderildi"}',
                                                      style: const TextStyle(
                                                        fontSize: 10.5,
                                                        color: Color(
                                                          0xFFCBBAD8,
                                                        ),
                                                        fontWeight:
                                                            FontWeight.w400,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Icon(
                                                      Icons.done_all_rounded,
                                                      size: 14,
                                                      color: msg.readAt != null
                                                          ? const Color(
                                                              0xFFE9CFFF,
                                                            )
                                                          : const Color(
                                                              0xFFCBBAD8,
                                                            ),
                                                    ),
                                                  ],
                                                )
                                              else
                                                Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.start,
                                                  mainAxisSize:
                                                      MainAxisSize.min,
                                                  children: [
                                                    Text(
                                                      chatTime(msg.createdAt),
                                                      style: const TextStyle(
                                                        fontSize: 10.5,
                                                        color: Color(
                                                          0xFFA595B5,
                                                        ),
                                                        fontWeight:
                                                            FontWeight.w400,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
              ),

              if (_newMessages)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Center(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF4C1D54),
                        elevation: 3,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      onPressed: _scrollToBottom,
                      icon: const Icon(Icons.arrow_downward_rounded, size: 16),
                      label: const Text(
                        'Yeni mesajlar',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ),
                ),
              if (_sendError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  child: Semantics(
                    liveRegion: true,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Mesaj gönderilemedi. Taslağın korundu.\n$_sendError',
                            style: const TextStyle(color: ruby, fontSize: 12),
                          ),
                        ),
                        TextButton(
                          onPressed: _sending ? null : _send,
                          child: const Text('Tekrar gönder'),
                        ),
                      ],
                    ),
                  ),
                ),
              // Reply preview bar
              if (_replyTo != null)
                Container(
                  margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFEADBFA)),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0A261935),
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.reply,
                        color: Color(0xFF7C3AED),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _replyTo!.mediaType == 'audio'
                              ? 'Sesli mesaja yanıt'
                              : _replyTo!.text,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF261935),
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () => setState(() => _replyTo = null),
                        child: const Icon(
                          Icons.close,
                          size: 18,
                          color: Color(0xFF8E8499),
                        ),
                      ),
                    ],
                  ),
                ),

              // Floating Bottom Input Capsule
              SafeArea(
                top: false,
                child: Container(
                  margin: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x12261935),
                        blurRadius: 16,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      // Plus button
                      InkWell(
                        onTap: _showQuickActionsMenu,
                        borderRadius: BorderRadius.circular(99),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF4EDF9),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.add_rounded,
                            color: Color(0xFF261935),
                            size: 22,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Text Field inner capsule with divider & mic
                      Expanded(
                        child: Container(
                          height: 42,
                          padding: const EdgeInsets.only(left: 14, right: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7F3FA),
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  enabled:
                                      _canSend &&
                                      !_loading &&
                                      !_sending &&
                                      _error == null,
                                  maxLength: 1200,
                                  controller: _inputController,
                                  textInputAction: TextInputAction.send,
                                  onSubmitted: (_) => _send(),
                                  style: const TextStyle(
                                    color: Color(0xFF261935),
                                    fontSize: 14.5,
                                  ),
                                  decoration: const InputDecoration(
                                    hintText: 'Bir mesaj yaz…',
                                    hintStyle: TextStyle(
                                      color: Color(0xFFA59BB2),
                                      fontSize: 14,
                                      fontWeight: FontWeight.w400,
                                    ),
                                    counterText: '',
                                    isDense: true,
                                    border: InputBorder.none,
                                    contentPadding: EdgeInsets.symmetric(
                                      vertical: 10,
                                    ),
                                  ),
                                ),
                              ),
                              Container(
                                width: 1,
                                height: 18,
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                color: const Color(0xFFE2D9E8),
                              ),
                              IconButton(
                                tooltip: 'Sesli mesaj',
                                icon: const Icon(Icons.mic_none_rounded),
                                iconSize: 20,
                                color: const Color(0xFF261935),
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(
                                  minWidth: 32,
                                  minHeight: 32,
                                ),
                                onPressed: () => showModalBottomSheet(
                                  context: context,
                                  useSafeArea: true,
                                  isScrollControlled: true,
                                  showDragHandle: true,
                                  builder: (sheetContext) => Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: VoiceComposer(
                                      profileId: widget.profileId,
                                      onSent: () {
                                        Navigator.pop(sheetContext);
                                        _loadMessages(silent: true);
                                      },
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Circular Send Button
                      Tooltip(
                        message: _canSend
                            ? 'Mesaj gönder'
                            : 'Sohbet isteği bekleniyor',
                        child: InkWell(
                          onTap: _sending || _loading || _error != null
                              ? null
                              : () {
                                  if (!_canSend) {
                                    _showCannotSendNotice();
                                    return;
                                  }
                                  _send();
                                },
                          borderRadius: BorderRadius.circular(99),
                          child: Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color:
                                  _sending ||
                                      !_canSend ||
                                      _loading ||
                                      _error != null
                                  ? const Color(0xFF7A6882)
                                  : const Color(0xFF4C1D54),
                              shape: BoxShape.circle,
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x404C1D54),
                                  blurRadius: 8,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Center(
                              child: _sending
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.arrow_upward_rounded,
                                      color: Colors.white,
                                      size: 22,
                                    ),
                            ),
                          ),
                        ),
                      ),
                    ],
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

class _ChatBubblePainter extends CustomPainter {
  const _ChatBubblePainter({required this.isMine, this.color, this.gradient});

  final bool isMine;
  final Color? color;
  final Gradient? gradient;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    const r = 16.0;
    const tailW = 6.0;

    final path = Path();
    if (isMine) {
      path.moveTo(r, 0);
      path.lineTo(w - r, 0);
      path.quadraticBezierTo(w, 0, w, r);
      path.lineTo(w, h - 10);
      path.quadraticBezierTo(w + 1, h - 3, w + tailW, h);
      path.quadraticBezierTo(w - 2, h - 0.5, w - 8, h);
      path.lineTo(r, h);
      path.quadraticBezierTo(0, h, 0, h - r);
      path.lineTo(0, r);
      path.quadraticBezierTo(0, 0, r, 0);
    } else {
      path.moveTo(r, 0);
      path.lineTo(w - r, 0);
      path.quadraticBezierTo(w, 0, w, r);
      path.lineTo(w, h - r);
      path.quadraticBezierTo(w, h, w - r, h);
      path.lineTo(8, h);
      path.quadraticBezierTo(2, h - 0.5, -tailW, h);
      path.quadraticBezierTo(-1, h - 3, 0, h - 10);
      path.lineTo(0, r);
      path.quadraticBezierTo(0, 0, r, 0);
    }
    path.close();

    canvas.drawShadow(
      path,
      isMine ? const Color(0x353B1245) : const Color(0x12401050),
      3.0,
      false,
    );

    final paint = Paint()..style = PaintingStyle.fill;
    if (gradient != null) {
      paint.shader = gradient!.createShader(Rect.fromLTWH(0, 0, w, h));
    } else if (color != null) {
      paint.color = color!;
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _ChatBubblePainter oldDelegate) =>
      oldDelegate.isMine != isMine ||
      oldDelegate.color != color ||
      oldDelegate.gradient != gradient;
}

class _ChatBackgroundPainter extends CustomPainter {
  const _ChatBackgroundPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final rect = Rect.fromLTWH(0, 0, w, h);
    final bgPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFFCF9FE), Color(0xFFFAF4FD), Color(0xFFF3E7FB)],
        stops: [0.0, 0.45, 1.0],
      ).createShader(rect);
    canvas.drawRect(rect, bgPaint);

    final wave1 = Path()
      ..moveTo(0, h * 0.68)
      ..cubicTo(w * 0.22, h * 0.74, w * 0.50, h * 0.77, w * 0.90, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(wave1, Paint()..color = const Color(0x38E6D3F5));

    final wave2 = Path()
      ..moveTo(0, h * 0.77)
      ..cubicTo(w * 0.20, h * 0.82, w * 0.42, h * 0.85, w * 0.72, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(wave2, Paint()..color = const Color(0x40DFBEF0));

    final wave3 = Path()
      ..moveTo(0, h * 0.85)
      ..cubicTo(w * 0.16, h * 0.89, w * 0.32, h * 0.92, w * 0.52, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(wave3, Paint()..color = const Color(0x48D7AEEA));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
