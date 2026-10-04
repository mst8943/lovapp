import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';

class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});
  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final api = LovaskApi();
  final code = TextEditingController();
  Map<String, dynamic> selfie = {}, contact = {};
  bool busy = false;
  String note = '';

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { code.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([api.verificationStatus(), api.contactVerificationStatus()]);
      if (mounted) setState(() { selfie = results[0]; contact = results[1]; });
    } catch (error) { if (mounted) setState(() => note = '$error'); }
  }

  Future<void> _upload() async {
    final file = await ImagePicker().pickImage(source: ImageSource.camera);
    if (file == null) return;
    setState(() => busy = true);
    try { await api.uploadSelfie(file); await _load(); if (mounted) setState(() => note = 'Selfie incelemeye gönderildi.'); }
    catch (error) { if (mounted) setState(() => note = '$error'); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _contact(String channel, String action) async {
    setState(() => busy = true);
    try {
      await api.contactVerification(channel, action, code: action == 'confirm' ? code.text.trim() : null);
      await _load();
      if (mounted) setState(() => note = action == 'send' ? 'Kod gönderildi.' : 'Doğrulandı.');
    } catch (error) { if (mounted) setState(() => note = '$error'); }
    finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Hesabını doğrula')),
    body: ListView(padding: const EdgeInsets.all(20), children: [
      const Text('Selfie, profil fotoğrafınla karşılaştırılarak incelenir.'),
      const SizedBox(height: 16),
      Text(selfie['verified'] == true ? 'Selfie: Doğrulandı ✓' : 'Selfie: ${(selfie['selfie'] as Map?)?['status'] ?? 'Gönderilmedi'}'),
      if (selfie['verified'] != true && (selfie['selfie'] as Map?)?['status'] != 'pending')
        FilledButton(onPressed: busy ? null : _upload, child: const Text('Selfie çek ve gönder')),
      for (final channel in const ['email', 'sms'])
        if (contact['${channel}Enabled'] == true) ...[
          const Divider(),
          Text('${channel == 'email' ? 'E-posta' : 'SMS'}: ${contact['${channel}Verified'] == true ? 'Doğrulandı ✓' : 'Doğrulanmadı'}'),
          if (contact['${channel}Verified'] != true) ...[
            TextButton(onPressed: busy ? null : () => _contact(channel, 'send'), child: const Text('Kod gönder')),
            TextField(controller: code, keyboardType: TextInputType.number, maxLength: 6, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Altı haneli kod')),
            FilledButton(onPressed: busy || code.text.length != 6 ? null : () => _contact(channel, 'confirm'), child: const Text('Doğrula')),
          ],
        ],
      if (note.isNotEmpty) Text(note),
    ]),
  );
}
