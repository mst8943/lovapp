import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';
import '../theme.dart';

class DatePlansSection extends StatefulWidget {
  const DatePlansSection({super.key, required this.api});
  final LovaskApi api;

  @override
  State<DatePlansSection> createState() => _DatePlansSectionState();
}

class _DatePlansSectionState extends State<DatePlansSection> {
  List<Map<String, dynamic>> plans = [];
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await widget.api.datePlans();
      if (mounted) {
        setState(() {
          plans = (data['plans'] as List? ?? []).whereType<Map<String, dynamic>>().toList();
          error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = 'Planlar yüklenemedi.');
    }
  }

  Future<DateTime?> pickTime(DateTime initial) async {
    final day = await showDatePicker(context: context, initialDate: initial, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 90)));
    if (day == null || !mounted) return null;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
    if (time == null) return null;
    return DateTime(day.year, day.month, day.day, time.hour, time.minute);
  }

  Future<void> create() async {
    final city = TextEditingController();
    final venue = TextEditingController();
    var start = DateTime.now().add(const Duration(days: 1));
    var end = start.add(const Duration(hours: 2));
    final draft = await showModalBottomSheet<Map<String, dynamic>>(
      context: context, isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(builder: (sheetContext, setSheetState) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.viewInsetsOf(sheetContext).bottom + 24),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Buluşma planım', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          TextField(controller: city, maxLength: 80, decoration: const InputDecoration(labelText: 'Şehir')),
          TextField(controller: venue, maxLength: 160, decoration: const InputDecoration(labelText: 'Mekân')),
          ListTile(contentPadding: EdgeInsets.zero, title: const Text('Başlangıç'), subtitle: Text(formatDate(start)), onTap: () async { final value = await pickTime(start); if (value != null) setSheetState(() { start = value; if (!end.isAfter(start)) end = start.add(const Duration(hours: 2)); }); }),
          ListTile(contentPadding: EdgeInsets.zero, title: const Text('Tahmini bitiş'), subtitle: Text(formatDate(end)), onTap: () async { final value = await pickTime(end); if (value != null) setSheetState(() => end = value); }),
          const Text('Plan yalnızca hesabına kaydedilir. Paylaşmayı sen başlatırsın.', style: TextStyle(color: muted)),
          const SizedBox(height: 12),
          FilledButton(onPressed: () { if (city.text.trim().length < 2 || venue.text.trim().length < 2 || !end.isAfter(start)) return; Navigator.pop(sheetContext, {'city': city.text.trim(), 'venue': venue.text.trim(), 'startsAt': start.toUtc().toIso8601String(), 'expectedEndAt': end.toUtc().toIso8601String()}); }, child: const Text('Planı kaydet')),
        ])),
      )),
    );
    city.dispose(); venue.dispose();
    if (draft == null) return;
    setState(() => busy = true);
    try { await widget.api.createDatePlan(draft); await load(); }
    catch (cause) { showError(cause); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> update(String id, String action, {int? rating, String? note}) async {
    setState(() => busy = true);
    final payload = <String, dynamic>{'id': id, 'action': action};
    if (rating != null) payload['rating'] = rating;
    if (note != null) payload['note'] = note;
    try { await widget.api.updateDatePlan(payload); await load(); }
    catch (cause) { showError(cause); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> complete(String id) async {
    final note = TextEditingController();
    var rating = 5;
    final result = await showDialog<(int, String)>(context: context, builder: (dialogContext) => StatefulBuilder(builder: (dialogContext, setDialogState) => AlertDialog(
      title: const Text('Buluşmayı değerlendir'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<int>(initialValue: rating, items: [1, 2, 3, 4, 5].map((value) => DropdownMenuItem(value: value, child: Text('$value / 5'))).toList(), onChanged: (value) { if (value != null) setDialogState(() => rating = value); }),
        TextField(controller: note, maxLength: 500, decoration: const InputDecoration(labelText: 'Not (isteğe bağlı)')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Vazgeç')), FilledButton(onPressed: () => Navigator.pop(dialogContext, (rating, note.text.trim())), child: const Text('Kaydet'))],
    )));
    note.dispose();
    if (result != null) await update(id, 'complete', rating: result.$1, note: result.$2);
  }

  void showError(Object cause) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(cause.toString())));
  }

  String formatDate(DateTime date) {
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(date.day)}.${two(date.month)}.${date.year} ${two(date.hour)}:${two(date.minute)}';
  }

  Future<void> share(Map<String, dynamic> plan) async {
    final start = DateTime.parse(plan['starts_at'] as String).toLocal();
    final end = DateTime.parse(plan['expected_end_at'] as String).toLocal();
    await Clipboard.setData(ClipboardData(text: 'Buluşma planım: ${plan['venue']}, ${plan['city']}. Başlangıç: ${formatDate(start)}. Tahmini bitiş: ${formatDate(end)}.'));
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Plan metni kopyalandı; güvendiğin kişiye sen gönderebilirsin.')));
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Buluşma planım', style: Theme.of(context).textTheme.titleLarge),
    const SizedBox(height: 6),
    const Text('Yer ve zamanı kaydet. İstersen metni kopyalayıp güvendiğin kişiye kendin gönder; otomatik bildirim gönderilmez.', style: TextStyle(color: muted)),
    const SizedBox(height: 10),
    FilledButton.icon(onPressed: busy ? null : create, icon: const Icon(Icons.add), label: const Text('Yeni plan')),
    if (error != null) TextButton.icon(onPressed: load, icon: const Icon(Icons.refresh), label: Text(error!)),
    for (final plan in plans) Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('${plan['venue']} · ${plan['city']}', style: const TextStyle(fontWeight: FontWeight.w800)),
      Text(formatDate(DateTime.parse(plan['starts_at'] as String).toLocal())),
      Text(plan['status'] == 'scheduled' ? 'Planlandı' : plan['status'] == 'checked_in' ? 'Güvendeyim kaydı alındı' : plan['status'] == 'completed' ? 'Tamamlandı · ${plan['feedback_rating']}/5' : 'İptal edildi'),
      if (plan['status'] == 'scheduled' || plan['status'] == 'checked_in') Wrap(spacing: 6, children: [
        TextButton(onPressed: busy ? null : () => share(plan), child: const Text('Metni kopyala')),
        if (plan['status'] == 'scheduled') TextButton(onPressed: busy ? null : () => update(plan['id'] as String, 'checkin'), child: const Text('Güvendeyim')),
        TextButton(onPressed: busy ? null : () => complete(plan['id'] as String), child: const Text('Tamamla')),
        TextButton(onPressed: busy ? null : () => update(plan['id'] as String, 'cancel'), child: const Text('İptal et')),
      ]),
    ]))),
  ]);
}
