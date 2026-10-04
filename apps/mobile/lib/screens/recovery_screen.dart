import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../api.dart';
import '../widgets/lovask_primitives.dart';

class RecoveryScreen extends StatefulWidget {
  const RecoveryScreen({super.key, this.scheduledFor, required this.onDone});
  final String? scheduledFor;
  final VoidCallback onDone;
  @override
  State<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends State<RecoveryScreen> {
  final password = TextEditingController(),
      confirmation = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    password.dispose();
    confirmation.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (widget.scheduledFor == null &&
        (password.text.length < 6 ||
            password.text.length > 128 ||
            password.text != confirmation.text)) {
      setState(() => error = '6–128 karakterli, eşleşen şifreler gir.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (widget.scheduledFor != null) {
        await LovaskApi().recoverAccount();
      } else {
        await LovaskApi().changePassword(password.text);
      }
      if (mounted) widget.onDone();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: LovaskOrbit(size: 88)),
              const SizedBox(height: 24),
              Text(
                widget.scheduledFor != null
                    ? 'Hesabın hâlâ kurtarılabilir.'
                    : 'Yeni şifreni belirle',
                style: const TextStyle(
                  fontFamily: 'CormorantGaramond',
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 20),
              if (widget.scheduledFor != null)
                Text(
                  'Profilin keşfetten kaldırıldı. Verilerin ${widget.scheduledFor} tarihinden sonra kalıcı olarak silinecek. 30 günlük güvenlik süresi içinde talebini iptal edebilirsin.',
                )
              else ...[
                TextField(
                  controller: password,
                  obscureText: true,
                  maxLength: 128,
                  decoration: const InputDecoration(labelText: 'Yeni şifre'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: confirmation,
                  obscureText: true,
                  maxLength: 128,
                  decoration: const InputDecoration(
                    labelText: 'Yeni şifre tekrar',
                  ),
                ),
              ],
              if (error != null) Text(error!),
              const SizedBox(height: 20),
              LovaskPrimaryButton(
                onPressed: busy ? null : submit,
                icon: Icons.check,
                label: busy
                    ? 'İşleniyor…'
                    : widget.scheduledFor != null
                    ? 'Hesabımı kurtar'
                    : 'Şifremi güncelle',
              ),
              TextButton(
                onPressed: busy
                    ? null
                    : () => Supabase.instance.client.auth.signOut(),
                child: const Text('Oturumu kapat'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
