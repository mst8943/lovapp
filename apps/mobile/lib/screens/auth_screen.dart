import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../theme.dart';
import '../api.dart';
import '../widgets/lovask_primitives.dart';
import 'application_screen.dart';
import 'package:url_launcher/url_launcher.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, this.api});
  final LovaskApi? api;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late final api = widget.api ?? LovaskApi();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _confirmationController = TextEditingController();
  bool _terms = false;
  bool _privacy = false;

  bool _busy = false;
  String _error = '';
  String _success = '';
  bool _applicationRequired = false;
  bool _googleEnabled = const bool.fromEnvironment('GOOGLE_AUTH_ENABLED');
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this)
      ..addListener(() {
        if (mounted) setState(() {});
      });
    api
        .registrationMode()
        .then((result) {
          if (mounted) {
            setState(() {
              _applicationRequired = result['enabled'] == false;
              _googleEnabled = result['googleEnabled'] == true;
            });
          }
        })
        .catchError((_) {}); // Older deployments validate the mode on submit.
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _confirmationController.dispose();
    super.dispose();
  }

  String _friendlyError(Object error, String fallback) {
    if (error is LovaskApiException) return error.toString();
    final message = error.toString().toLowerCase();
    if (message.contains('xmlhttprequest') ||
        message.contains('clientexception') ||
        message.contains('failed to fetch') ||
        message.contains('socketexception') ||
        message.contains('handshakeexception') ||
        message.contains('connection refused') ||
        message.contains('network is unreachable')) {
      return 'Sunucuya bağlanılamadı. Lütfen ağ bağlantınızı kontrol edin.';
    }
    return fallback;
  }

  Future<void> _submitLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }

    setState(() {
      _busy = true;
      _error = '';
      _success = '';
    });

    try {
      await api.login(email, password);
    } on AuthException catch (e) {
      if (mounted) {
        setState(
          () => _error = e.code == 'invalid_credentials'
              ? 'E-posta veya şifre eşleşmedi.'
              : e.code == 'email_not_confirmed'
              ? 'E-posta onayı tamamlanmamış.'
              : 'Giriş yapılamadı: ${e.message}',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _friendlyError(
            e,
            'Giriş yapılamadı. Bilgilerinizi kontrol ediniz.',
          );
          if (e is LovaskApiException && e.code == 'application_required') {
            _applicationRequired = true;
          }
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitRegister() async {
    if (_applicationRequired) {
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const ApplicationScreen()),
      );
      return;
    }
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final name = _nameController.text.trim();

    if (name.length < 3) {
      setState(() => _error = 'Ad soyad en az 3 karakter olmalı.');
      return;
    }
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      setState(() => _error = 'Geçerli bir e-posta adresi gir.');
      return;
    }
    if (password.length < 6 || password.length > 128) {
      setState(() => _error = 'Şifre 6–128 karakter arasında olmalı.');
      return;
    }
    if (password != _confirmationController.text) {
      setState(() => _error = 'Şifre tekrarı eşleşmiyor.');
      return;
    }
    if (!_terms || !_privacy) {
      setState(
        () => _error = 'Kullanım koşullarını ve gizlilik metnini onayla.',
      );
      return;
    }

    setState(() {
      _busy = true;
      _error = '';
      _success = '';
    });

    try {
      final result = await api.register({
        'fullName': name,
        'email': email,
        'password': password,
        'passwordConfirmation': _confirmationController.text,
        'termsAccepted': _terms,
        'privacyAccepted': _privacy,
        'marketingConsent': false,
      });
      if (result['requiresEmailConfirmation'] == false) {
        await api.login(email, password);
        return;
      }
      if (!mounted) return;
      setState(() {
        _success =
            'Kayıt başarılı! E-posta adresinize gelen onay bağlantısını kontrol edin.';
      });
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _friendlyError(
            e,
            'Kayıt oluşturulamadı. Lütfen tekrar deneyin.',
          );
          if (e is LovaskApiException && e.code == 'registration_closed') {
            _applicationRequired = true;
          }
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showForgotPasswordDialog() {
    final resetEmailController = TextEditingController(
      text: _emailController.text,
    );
    showLovaskSheet(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Şifre Sıfırlama',
            style: TextStyle(
              color: pearl,
              fontFamily: 'Manrope',
              fontSize: 28,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Kayıtlı e-posta adresinizi girin. Size şifre yenileme bağlantısı göndereceğiz.',
            style: TextStyle(color: pearl, fontSize: 13),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: resetEmailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-posta'),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('İptal', style: TextStyle(color: muted)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () async {
                    final em = resetEmailController.text.trim();
                    if (em.isNotEmpty) {
                      Navigator.pop(ctx);
                      try {
                        await (widget.api ?? LovaskApi()).requestPasswordReset(em);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              duration: Duration(seconds: 6),
                              content: Text(
                                'Şifre sıfırlama bağlantısı gönderildi.',
                              ),
                            ),
                          );
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
                      }
                    }
                  },
                  child: const Text('Gönder'),
                ),
              ),
            ],
          ),
        ],
      ),
    ).whenComplete(resetEmailController.dispose);
  }

  Future<void> _google() async {
    if (!_googleEnabled) return;
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await api.googleLogin(register: _tabController.index == 1);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    bool password = false,
    bool email = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: LovaskFormCard(
      child: TextField(
        controller: controller,
        enabled: !_busy,
        obscureText: password && _obscure,
        keyboardType: email ? TextInputType.emailAddress : TextInputType.text,
        autofillHints: email
            ? const [AutofillHints.email]
            : password
            ? const [AutofillHints.password]
            : const [AutofillHints.name],
        decoration: InputDecoration(
          labelText: label,
          hintText: email
              ? 'sen@ornek.com'
              : password
              ? (_tabController.index == 1 ? 'En az 6 karakter' : 'Şifren')
              : 'Ad soyad',
          prefixIcon: Icon(
            email
                ? Icons.alternate_email
                : password
                ? Icons.lock_outline
                : Icons.person_outline,
            size: 20,
          ),
          suffixIcon: password
              ? IconButton(
                  tooltip: _obscure ? 'Şifreyi göster' : 'Şifreyi gizle',
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 18,
                  ),
                )
              : null,
        ),
      ),
    ),
  );

  Widget _consent(String label, bool value, ValueChanged<bool> onChanged) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: LovaskSurface(
          radius: 15,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              Expanded(
                child: Text(label, style: const TextStyle(fontSize: 13)),
              ),
              Checkbox(
                value: value,
                onChanged: _busy ? null : (next) => onChanged(next ?? false),
              ),
            ],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: ink,
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 22, 24, 28),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: AutofillGroup(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const LovaskWordmark(),
                  const SizedBox(height: 28),
                  LovaskHero(
                    eyebrow: _applicationRequired
                        ? 'DAVETLE TANIŞ'
                        : 'BİR KARŞILAŞMA YETER',
                    title: 'Aynı anda.\nAynı histe.',
                    subtitle: _applicationRequired
                        ? 'Başvurunu bırak. Hikâyenin bir sonraki kişisi burada olabilir.'
                        : 'Kendin olduğun yerde, sana iyi gelen biriyle tanış.',
                  ),
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: panelLight,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: line),
                    ),
                    child: TabBar(
                      controller: _tabController,
                      dividerColor: Colors.transparent,
                      indicatorSize: TabBarIndicatorSize.tab,
                      indicator: BoxDecoration(
                        color: photoDark,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      labelColor: moon,
                      unselectedLabelColor: muted,
                      tabs: [
                        const Tab(height: 44, text: 'Giriş yap'),
                        Tab(
                          height: 44,
                          text: _applicationRequired
                              ? 'Başvuru yap'
                              : 'Kayıt ol',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  AnimatedBuilder(
                    animation: _tabController,
                    builder: (context, _) {
                      final register = _tabController.index == 1;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (register && _applicationRequired)
                            LovaskPrimaryButton(
                              label: 'Üyelik başvurusunu aç',
                              onPressed: _busy ? null : _submitRegister,
                              icon: Icons.arrow_forward,
                            )
                          else ...[
                            OutlinedButton(
                              onPressed: _googleEnabled && !_busy
                                  ? _google
                                  : null,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: pearl,
                                side: const BorderSide(color: line),
                                minimumSize: const Size(0, 46),
                              ),
                              child: Text(
                                _googleEnabled
                                    ? (register
                                          ? 'Google ile kaydol'
                                          : 'Google ile giriş yap')
                                    : 'Google girişi kullanılamıyor',
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 22),
                              child: Row(
                                children: [
                                  Expanded(child: Divider(color: line)),
                                  Padding(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 14,
                                    ),
                                    child: Text(
                                      'VEYA E-POSTA İLE',
                                      style: TextStyle(
                                        color: muted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  Expanded(child: Divider(color: line)),
                                ],
                              ),
                            ),
                            if (register) _field('AD SOYAD', _nameController),
                            _field('E-POSTA', _emailController, email: true),
                            _field(
                              'ŞİFRE',
                              _passwordController,
                              password: true,
                            ),
                            if (register) ...[
                              _field(
                                'ŞİFRE TEKRAR',
                                _confirmationController,
                                password: true,
                              ),
                              _consent(
                                'Kullanım koşullarını kabul ediyorum.',
                                _terms,
                                (v) => setState(() => _terms = v),
                              ),
                              _consent(
                                'Gizlilik metnini okudum ve kabul ediyorum.',
                                _privacy,
                                (v) => setState(() => _privacy = v),
                              ),
                            ],
                            if (_error.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Text(
                                  _error,
                                  style: const TextStyle(color: ruby),
                                ),
                              ),
                            if (_success.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Text(
                                  _success,
                                  style: const TextStyle(color: success),
                                ),
                              ),
                            LovaskPrimaryButton(
                              onPressed: _busy
                                  ? null
                                  : register
                                  ? _submitRegister
                                  : _submitLogin,
                              label: _busy
                                  ? 'Lütfen bekle…'
                                  : register
                                  ? 'Kayıt ol'
                                  : 'Giriş yap',
                            ),
                            if (!register)
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: _busy
                                      ? null
                                      : _showForgotPasswordDialog,
                                  child: const Text('Şifremi unuttum'),
                                ),
                              ),
                          ],
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    '18 yaş ve üzeri için. Tanışmanın ilk kuralı: karşılıklı saygı.',
                    style: TextStyle(fontSize: 12, color: muted, height: 1.7),
                  ),
                  Wrap(
                    alignment: WrapAlignment.center,
                    children: [
                      for (final e in const {
                        '/terms': 'Kullanım koşulları',
                        '/privacy': 'Gizlilik',
                        '/community-guidelines': 'Topluluk kuralları',
                      }.entries)
                        TextButton(
                          onPressed: () => launchUrl(
                            Uri.parse('${LovaskApi.baseUrl}${e.key}'),
                            mode: LaunchMode.externalApplication,
                          ),
                          child: Text(
                            e.value,
                            style: const TextStyle(fontSize: 12),
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
  );
}
