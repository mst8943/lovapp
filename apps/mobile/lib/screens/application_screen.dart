import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../turkish_cities.dart';
import '../widgets/lovask_primitives.dart';

class ApplicationScreen extends StatefulWidget {
  const ApplicationScreen({super.key});
  @override
  State<ApplicationScreen> createState() => _ApplicationScreenState();
}

class _ApplicationScreenState extends State<ApplicationScreen> {
  final fields = <String, String>{};
  bool privacy = false,
      notification = false,
      marketing = false,
      busy = false,
      sent = false;
  String? error;

  Widget consent(String label, bool value, ValueChanged<bool> onChanged) =>
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
                onChanged: busy ? null : (next) => onChanged(next ?? false),
              ),
            ],
          ),
        ),
      );
  Future<void> submit() async {
    if (!privacy || !notification) {
      setState(
        () => error =
            'Aydınlatma metni ve başvuru bilgilendirme onayları gerekli.',
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final mode = await LovaskApi().registrationMode();
      if (mode['challengeRequired'] == true) {
        throw const LovaskApiException(
          403,
          'Başvuru için tarayıcı güvenlik doğrulaması gerekiyor. Aşağıdaki güvenli başvuru bağlantısını kullan.',
        );
      }
      await LovaskApi().applyMembership({
        ...fields,
        'privacyNoticeAccepted': privacy,
        'notificationConsent': notification,
        'marketingConsent': marketing,
      });
      if (mounted) setState(() => sent = true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Üyelik başvurusu')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (sent)
          const Text(
            'Başvurun alındı. Sonuç hakkında iletişim bilgilerin üzerinden bilgilendirileceksin.',
          )
        else ...[
          const LovaskHero(
            eyebrow: 'TANIŞMAYA BİR ADIM',
            title: 'Hikâyene yer var.',
            subtitle:
                'Kendinden biraz bahset. Başvurunun sonucunu sana iletelim.',
          ),
          const SizedBox(height: 24),
          LovaskFormCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final e in const {
                  'fullName': 'Ad soyad',
                  'email': 'E-posta',
                  'phone': 'Cep telefonu',
                  'instagramUsername': 'Instagram (isteğe bağlı)',
                  'occupation': 'Meslek',
                  'industry': 'Sektör',
                  'city': 'Şehir (isteğe bağlı)',
                  'applicationNote': 'Başvuru notu (isteğe bağlı)',
                }.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: e.key == 'city'
                        ? DropdownButtonFormField<String>(
                            initialValue: '',
                            isExpanded: true,
                            menuMaxHeight: 360,
                            decoration: InputDecoration(labelText: e.value),
                            items: [
                              const DropdownMenuItem(
                                value: '',
                                child: Text('Belirtmek istemiyorum'),
                              ),
                              for (final city in turkishCities)
                                DropdownMenuItem(
                                  value: city,
                                  child: Text(city),
                                ),
                            ],
                            onChanged: (city) => fields['city'] = city ?? '',
                          )
                        : TextField(
                            onChanged: (v) => fields[e.key] = v.trim(),
                            maxLength: e.key == 'applicationNote'
                                ? 800
                                : e.key == 'email'
                                ? 254
                                : e.key == 'phone'
                                ? 24
                                : e.key == 'instagramUsername'
                                ? 31
                                : e.key == 'city'
                                ? 80
                                : 120,
                            keyboardType: e.key == 'email'
                                ? TextInputType.emailAddress
                                : e.key == 'phone'
                                ? TextInputType.phone
                                : TextInputType.text,
                            decoration: InputDecoration(labelText: e.value),
                          ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          consent(
            'Aydınlatma metnini okudum.',
            privacy,
            (v) => setState(() => privacy = v),
          ),
          consent(
            'Başvurum hakkında bilgilendirilmeyi kabul ediyorum.',
            notification,
            (v) => setState(() => notification = v),
          ),
          consent(
            'Kampanya duyuruları almak istiyorum (isteğe bağlı).',
            marketing,
            (v) => setState(() => marketing = v),
          ),
          if (error != null) Text(error!),
          LovaskPrimaryButton(
            onPressed: busy ? null : submit,
            label: busy ? 'Gönderiliyor…' : 'Başvuruyu gönder',
            icon: Icons.arrow_forward,
          ),
          TextButton(
            onPressed: () async {
              await launchUrl(
                Uri.parse('${LovaskApi.baseUrl}/login?mode=apply'),
                mode: LaunchMode.externalApplication,
              );
            },
            child: const Text('Güvenli başvuru sayfasını aç'),
          ),
        ],
      ],
    ),
  );
}
