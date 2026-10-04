import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/lovask_primitives.dart';

class NoirScreen extends StatefulWidget {
  const NoirScreen({super.key, this.api});
  final LovaskApi? api;

  @override
  State<NoirScreen> createState() => _NoirScreenState();
}

class _NoirScreenState extends State<NoirScreen> with WidgetsBindingObserver {
  late final api = widget.api ?? LovaskApi();
  bool _loading = true;
  String? _error;
  List<NoirPlan> _plans = [];
  List<NoirOrder> _orders = [];
  List<PaymentMethodSetting> _paymentMethods = [];
  String? _noirUntil;
  bool _shopierEnabled = false;
  List<String> _shopierPlans = [];
  String _selectedPlanSlug = 'noir-weekly';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadNoirData();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_loading) _loadNoirData();
  }

  Future<void> _loadNoirData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await api.noir();
      final plansRaw = res['plans'] as List<dynamic>? ?? [];
      final ordersRaw = res['orders'] as List<dynamic>? ?? [];
      final methodsRaw = res['paymentMethods'] as List<dynamic>? ?? [];

      if (mounted) {
        setState(() {
          _plans = plansRaw
              .whereType<Map<String, dynamic>>()
              .map(NoirPlan.fromJson)
              .toList();
          _orders = ordersRaw
              .whereType<Map<String, dynamic>>()
              .map(NoirOrder.fromJson)
              .toList();
          _paymentMethods = methodsRaw
              .whereType<Map<String, dynamic>>()
              .map(PaymentMethodSetting.fromJson)
              .toList();
          _noirUntil = res['noirUntil'] as String?;
          _shopierEnabled = res['shopierEnabled'] == true;
          _shopierPlans = (res['shopierPlans'] as List<dynamic>? ??
                  (_shopierEnabled ? ['noir-weekly', 'noir-monthly'] : []))
              .whereType<String>()
              .toList();
          if (_plans.isNotEmpty &&
              !_plans.any((p) => p.slug == _selectedPlanSlug)) {
            _selectedPlanSlug = _plans.first.slug;
          }
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  bool get _isNoirActive {
    if (_noirUntil == null) return false;
    final exp = DateTime.tryParse(_noirUntil!);
    return exp != null && exp.isAfter(DateTime.now());
  }

  Future<void> _startShopierPayment() async {
    setState(() => _busy = true);
    try {
      final res = await api.createNoirOrder(
        planSlug: _selectedPlanSlug,
        provider: 'shopier',
      );
      final checkoutUrl = res['checkoutUrl'] as String?;
      if (checkoutUrl != null && checkoutUrl.isNotEmpty) {
        final order = res['order'] as Map<String, dynamic>?;
        final reference = order?['payment_reference'] as String?;
        if (reference == null || reference.isEmpty) {
          throw const LovaskApiException(500, 'Ödeme referansı alınamadı.');
        }
        if (!mounted) return;
        final proceed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Shopier\'e geçmeden önce'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Ödeme sonrası Shopier sipariş numaranı Noir ekranındaki ödeme bildirimi formuna yaz. Sipariş Shopier panelinde doğrulanıp yönetici onaylayınca Noir açılır.'),
                const SizedBox(height: 12),
                SelectableText('Lovask referansı: $reference'),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Shopier\'e devam et')),
            ],
          ),
        );
        if (proceed != true) return;
        final uri = Uri.parse(checkoutUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          if (mounted) await _loadNoirData();
        } else {
          throw const LovaskApiException(400, 'Tarayıcı açılamadı.');
        }
      } else {
        throw const LovaskApiException(500, 'Ödeme bağlantısı alınamadı.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(duration: const Duration(seconds: 6), 
            content: Text(
              e is LovaskApiException
                  ? e.message ?? 'Ödeme başlatılamadı.'
                  : 'Ödeme başlatılamadı.',
            ),
            backgroundColor: ruby,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _startManualPayment(String provider) async {
    setState(() => _busy = true);
    try {
      final res = await api.createNoirOrder(
        planSlug: _selectedPlanSlug,
        provider: provider,
      );
      final orderData = res['order'] as Map<String, dynamic>?;
      if (orderData != null && mounted) {
        final createdOrder = NoirOrder.fromJson(orderData);
        _showBankTransferModal(createdOrder);
        await _loadNoirData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(duration: const Duration(seconds: 6), 
            content: Text(
              e is LovaskApiException
                  ? e.message ?? 'Ödeme talebi oluşturulamadı.'
                  : 'Ödeme talebi oluşturulamadı.',
            ),
            backgroundColor: ruby,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showBankTransferModal(NoirOrder order) {
    final matching = _paymentMethods
        .where((m) => m.method == order.provider && m.enabled)
        .toList();
    if (matching.isEmpty || matching.first.destination?.isNotEmpty != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(duration: Duration(seconds: 6), 
          content: Text(
            'Bu ödeme yönteminin alıcı bilgileri kullanılamıyor. Destek merkeziyle iletişime geç.',
          ),
        ),
      );
      return;
    }
    _showPaymentProofModal(order, matching.first);
  }

  void _showPaymentProofModal(NoirOrder order, PaymentMethodSetting? bankInfo) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: panel,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => _BankTransferProofSheet(
        order: order,
        bankInfo: bankInfo,
        onSubmitSuccess: () {
          Navigator.pop(ctx);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(duration: Duration(seconds: 6), 
              content: Text(
                'Ödeme bildiriminiz alındı. İncelendikten sonra Noir erişiminiz açılacaktır.',
              ),
              backgroundColor: wine,
            ),
          );
          _loadNoirData();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            LovaskCrown(size: 24),
            SizedBox(width: 8),
            Flexible(
              child: Text('Lovask Noir', overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: gold))
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, style: const TextStyle(color: ruby)),
                  const SizedBox(height: 12),
                  LovaskGhostButton(
                    label: 'Tekrar dene',
                    onPressed: _loadNoirData,
                  ),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 40),
              children: [
                // Status Badge
                if (_isNoirActive)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: gold.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: gold),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.verified, color: gold, size: 28),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Noir Üyeliğiniz Aktif',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: noirText,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Bitiş: ${_noirUntil?.split("T").first ?? ""}',
                                style: const TextStyle(
                                  color: pearl,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                const LovaskHero(
                  eyebrow: 'LOVASK · NOIR',
                  noir: true,
                  title: 'İhtimallere\nyer aç.',
                  subtitle:
                      'Seni merak edenleri gör. Bir karşılaşmaya daha şans ver. Kendi ritminde keşfet.',
                  footer: Row(
                    children: [
                      Icon(Icons.verified_outlined, color: noirGold, size: 18),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Tek ödeme. Otomatik yenileme yok.',
                          style: TextStyle(color: noirGold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Keep package and payment choices near the top.
                LovaskSurface(
                  padding: EdgeInsets.zero,
                  child: ExpansionTile(
                    title: const Text(
                      'Noir ayrıcalıkları',
                      style: TextStyle(
                        color: noirText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    subtitle: const Text(
                      'Beğenenler · Sınırsız beğeni · Haftalık Boost',
                      style: TextStyle(color: muted, fontSize: 12),
                    ),
                    iconColor: gold,
                    collapsedIconColor: gold,
                    shape: const Border(),
                    collapsedShape: const Border(),
                    childrenPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                    children: const [
                      _NoirBenefitRow(
                        title: 'Sana ilgi duyanları gör',
                        desc:
                            'Seni beğenenleri ve profil ziyaretçilerini incele.',
                      ),
                      SizedBox(height: 14),
                      _NoirBenefitRow(
                        title: 'Sınırsız beğeni',
                        desc: 'Günlük beğeni limitine takılmadan keşfet.',
                      ),
                      SizedBox(height: 14),
                      _NoirBenefitRow(
                        title: 'Geri al ve süper beğeni',
                        desc:
                            'Geçtiğin profili geri getir; ilgini özel olarak göster.',
                      ),
                      SizedBox(height: 14),
                      _NoirBenefitRow(
                        title: '30 dakika Boost',
                        desc: 'Noir aktifken haftada bir kez keşifte öne çık.',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Plans Selection
                const Text(
                  'Kendine bir zaman seç.',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: noirText,
                  ),
                ),
                const SizedBox(height: 14),

                ..._plans.map((p) {
                  final selected = p.slug == _selectedPlanSlug;
                  return Semantics(
                    selected: selected,
                    button: true,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => setState(() => _selectedPlanSlug = p.slug),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: selected ? null : panel,
                          gradient: selected ? orbitGradient : null,
                          borderRadius: LovaskRadius.surface(24),
                          border: Border.all(
                            color: selected ? gold : line,
                            width: selected ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              selected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                              color: selected ? noirGold : muted,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    p.name,
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w600,
                                      color: selected ? moon : pearl,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    p.durationMinutes != null
                                        ? '${p.durationMinutes} dakika geçerli'
                                        : '${p.durationDays} gün boyunca geçerli',
                                    style: TextStyle(
                                      color: selected ? champagne : muted,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              fit: FlexFit.loose,
                              child: Text(
                                '${p.priceAmount.toStringAsFixed(p.priceAmount % 1 == 0 ? 0 : 2)} ${p.currency}',
                                textAlign: TextAlign.end,
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: selected ? noirGold : noirText,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),

                const SizedBox(height: 20),

                const LovaskSectionTitle(
                  'Nasıl ödemek istersin?',
                  caption:
                      'Paketini seç, aşağıdaki yöntemlerden biriyle devam et.',
                ),
                // Payment Buttons
                if (_shopierEnabled && _shopierPlans.contains(_selectedPlanSlug)) ...[
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy || _plans.isEmpty
                          ? null
                          : _startShopierPayment,
                      icon: const Icon(Icons.credit_card),
                      label: Text(
                        _busy
                            ? 'Hazırlanıyor…'
                            : 'Kredi / Banka Kartı ile Öde (Shopier)',
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                for (final method in _paymentMethods.where(
                  (m) =>
                      m.enabled &&
                      [
                        'bank_transfer',
                        'papara',
                        'crypto',
                      ].contains(m.method) &&
                      m.destination?.isNotEmpty == true,
                ))
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy || _plans.isEmpty
                          ? null
                          : () => _startManualPayment(method.method),
                      icon: const Icon(Icons.account_balance),
                      label: Text(
                        _busy ? 'Hazırlanıyor…' : '${method.label} ile öde',
                      ),
                    ),
                  ),

                if (_orders.isNotEmpty) ...[
                  const SizedBox(height: 36),
                  const Text(
                    'Üyelik geçmişin',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: noirText,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ..._orders.map(
                    (o) => _OrderCard(
                      order: o,
                      onSendProof:
                          (o.status == 'awaiting_payment' ||
                              (o.status == 'pending' && o.provider == 'shopier'))
                          ? () async {
                              if (o.provider == 'shopier') {
                                _showPaymentProofModal(o, null);
                              } else if ([
                                'bank_transfer',
                                'papara',
                                'crypto',
                              ].contains(o.provider)) {
                                _showBankTransferModal(o);
                              }
                            }
                          : null,
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _NoirBenefitRow extends StatelessWidget {
  const _NoirBenefitRow({required this.title, required this.desc});
  final String title;
  final String desc;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: noirSurface, shape: BoxShape.circle),
          child: const Icon(Icons.check, color: noirText, size: 16),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  color: pearl,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 2),
              Text(desc, style: const TextStyle(color: muted, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }
}

class _BankTransferProofSheet extends StatefulWidget {
  const _BankTransferProofSheet({
    required this.order,
    required this.bankInfo,
    required this.onSubmitSuccess,
  });

  final NoirOrder order;
  final PaymentMethodSetting? bankInfo;
  final VoidCallback onSubmitSuccess;

  @override
  State<_BankTransferProofSheet> createState() =>
      _BankTransferProofSheetState();
}

class _BankTransferProofSheetState extends State<_BankTransferProofSheet> {
  final _senderNameController = TextEditingController();
  final _referenceController = TextEditingController();
  XFile? _proofFile;
  bool _submitting = false;
  String? _sheetError;
  DateTime _paymentDate = DateTime.now();

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _senderNameController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _pickProof() async {
    try {
      final file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      );
      if (file == null || !mounted) return;
      if (file.path == null) {
        throw const LovaskApiException(400, 'Dosya açılamadı.');
      }
      if (await XFile(file.path!).length() > 5 * 1024 * 1024) {
        setState(() => _sheetError = 'Dekont en fazla 5 MB olmalı.');
        return;
      }
      if (mounted) {
        setState(() => _proofFile = XFile(file.path!, name: file.name));
      }
    } catch (e) {
      if (mounted) setState(() => _sheetError = e.toString());
    }
  }

  Future<void> _submit() async {
    final name = _senderNameController.text.trim();
    final isShopier = widget.order.provider == 'shopier';
    if (name.length < 3) {
      setState(
        () => _sheetError = 'Lütfen ödeme yapanın adını ve soyadını yazınız.',
      );
      return;
    }
    if (isShopier && _referenceController.text.trim().length < 4) {
      setState(() => _sheetError = 'Shopier sipariş numarasını yazınız.');
      return;
    }

    setState(() {
      _submitting = true;
      _sheetError = null;
    });

    final now = _paymentDate;
    final dateStr =
        '${now.year}-${now.month.toString().padLeft(2, "0")}-${now.day.toString().padLeft(2, "0")}';

    try {
      await LovaskApi().submitNoirProof(
        orderId: widget.order.id,
        senderFullName: name,
        paymentDate: dateStr,
        externalReference: _referenceController.text.trim(),
        proof: _proofFile,
      );
      if (mounted) widget.onSubmitSuccess();
    } catch (e) {
      if (mounted) {
        setState(() {
          _sheetError = e is LovaskApiException
              ? e.message ?? 'Bildirim gönderilemedi.'
              : 'Bildirim gönderilemedi.';
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: muted.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              widget.order.provider == 'shopier' ? 'Shopier ödemesini bildir' : '${widget.bankInfo!.label} bilgileri',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: noirText,
              ),
            ),
            const SizedBox(height: 16),

            // LVK Reference code with Copy
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: ink,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: gold.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.order.provider == 'shopier' ? 'LOVASK TAKİP KODU' : 'AÇIKLAMAYA YAZILACAK KOD',
                          style: const TextStyle(
                            color: gold,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.order.paymentReference,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: pearl,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () {
                      Clipboard.setData(
                        ClipboardData(text: widget.order.paymentReference),
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(duration: Duration(seconds: 6), 
                          content: Text('Referans kodu kopyalandı!'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy, color: gold),
                    tooltip: 'Kopyala',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // IBAN Box
            if (widget.bankInfo?.destination != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ink,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.bankInfo?.accountName ?? 'Lovask',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: pearl,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                          widget.bankInfo!.destination!,
                            style: const TextStyle(
                              color: noirText,
                              fontSize: 14,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            Clipboard.setData(
                              ClipboardData(text: widget.bankInfo!.destination!),
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(duration: Duration(seconds: 6), 
                                content: Text('Alıcı bilgisi kopyalandı!'),
                              ),
                            );
                          },
                          icon: const Icon(Icons.copy, color: muted, size: 20),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 20),

            // Proof form
            if (widget.bankInfo?.cryptoAsset != null)
              Text(
                '${widget.bankInfo!.cryptoAsset} · Ağ: ${widget.bankInfo!.cryptoNetwork ?? ""}',
              ),
            if (widget.bankInfo?.instructions != null)
              Text(widget.bankInfo!.instructions!),
            Text(
              '${widget.order.amount} ${widget.order.currency}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            LovaskSurface(
              radius: 16,
              child: InkWell(
                onTap: _submitting
                    ? null
                    : () async {
                        final date = await showDatePicker(
                          context: context,
                          initialDate: _paymentDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now(),
                        );
                        if (date != null && mounted) {
                          setState(() => _paymentDate = date);
                        }
                      },
                child: Row(
                  children: [
                    const Icon(Icons.calendar_month_outlined, color: gold),
                    const SizedBox(width: 12),
                    const Expanded(child: Text('Ödeme tarihi')),
                    Text(
                      '${_paymentDate.day}.${_paymentDate.month}.${_paymentDate.year}',
                      style: const TextStyle(
                        color: gold,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            TextField(
              controller: _referenceController,
              maxLength: 160,
              decoration: InputDecoration(
                labelText: widget.order.provider == 'shopier' ? 'Shopier sipariş numarası' : 'Banka / işlem referansı (isteğe bağlı)',
              ),
            ),
            const Text(
              'Ödeme Bildirimi Yapın',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: noirText,
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _senderNameController,
              decoration: InputDecoration(
                labelText: widget.order.provider == 'shopier' ? 'Shopier alıcı ad soyad' : 'Havale yapan ad soyad',
                hintText: 'Ödeme yapan kişinin tam adı',
              ),
            ),
            const SizedBox(height: 12),
            LovaskGhostButton(
              onPressed: _pickProof,
              icon: Icons.receipt_long,
              label: _proofFile == null ? 'Dekont ekle' : 'Dekontu değiştir',
            ),
            if (_proofFile != null)
              Text(
                _proofFile!.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: muted, fontSize: 12),
              ),
            if (_sheetError != null) ...[
              const SizedBox(height: 10),
              Text(_sheetError!, style: const TextStyle(color: ruby)),
            ],
            if (_submitting)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: LinearProgressIndicator(color: gold),
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: LovaskPrimaryButton(
                onPressed: _submitting ? null : _submit,
                label: _submitting
                    ? 'Gönderiliyor…'
                    : 'Ödeme bildirimini tamamla',
                icon: Icons.check,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, this.onSendProof});
  final NoirOrder order;
  final VoidCallback? onSendProof;

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;
    switch (order.status) {
      case 'completed':
        statusColor = success;
        statusText = 'Tamamlandı';
        break;
      case 'approved':
        statusColor = success;
        statusText = 'Onaylandı';
        break;
      case 'paid':
        statusColor = success;
        statusText = 'Ödendi';
        break;
      case 'under_review':
        statusColor = gold;
        statusText = 'İnceleniyor';
        break;
      case 'pending':
        statusColor = noirText;
        statusText = 'Ödeme bekleniyor';
        break;
      case 'awaiting_payment':
        statusColor = noirText;
        statusText = 'Ödeme Bekleniyor';
        break;
      case 'rejected':
        statusColor = ruby;
        statusText = 'Reddedildi';
        break;
      default:
        statusColor = muted;
        statusText = order.status;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: panel,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.planName ?? 'Noir Paketi',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: pearl,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Ref: ${order.paymentReference} • ${order.amount} ${order.currency}',
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
                if (order.rejectionReason != null)
                  Text(
                    order.rejectionReason!,
                    style: const TextStyle(color: ruby),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: statusColor.withValues(alpha: 0.4)),
            ),
            child: Text(
              statusText,
              style: TextStyle(
                color: statusColor,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          if (onSendProof != null) ...[
            const SizedBox(width: 8),
            IconButton(
              onPressed: onSendProof,
              icon: const Icon(Icons.upload_file, color: gold),
              tooltip: order.provider == 'shopier' ? 'Shopier sipariş numarasını bildir' : 'Dekont gönder',
            ),
          ],
        ],
      ),
    );
  }
}
