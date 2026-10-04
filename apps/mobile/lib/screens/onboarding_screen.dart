import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../profile_photo_picker.dart';
import '../theme.dart';
import '../turkish_cities.dart';
import '../widgets/lovask_primitives.dart';

const genderOptions = {
  'kadın': 'Kadın',
  'erkek': 'Erkek',
  'nonbinary': 'Non-binary',
  'other': 'Diğer',
};
const badgeOptions = {
  'serious': 'Ciddi düşünüyor',
  'fun': 'Eğlence arıyor',
  'adventure': 'Maceracı',
  'coffee': 'Kahve sever',
  'night-owl': 'Gece kuşu',
  'live-music': 'Canlı müzik',
  'foodie': 'Yeni tatlar',
  'travel': 'Seyahat tutkunu',
};
const promptOptions = [
  'En gizli yeteneğim…',
  'Benimle çıkmanın küçük bir lüksü…',
  'Beni etkilemenin en kısa yolu…',
  'Birlikte mutlaka denemeliyiz…',
];

String? validateOnboarding(
  Map<String, dynamic> f,
  int step,
  int photoCount,
  DateTime now,
) {
  if (step == 0) {
    if ((f['name'] as String).trim().length < 2) {
      return 'İsmini en az iki karakterle yaz.';
    }
    final birth = DateTime.tryParse(f['birthDate'] as String);
    if (birth == null) return 'Doğum tarihini seç.';
    var age = now.year - birth.year;
    if (now.month < birth.month ||
        (now.month == birth.month && now.day < birth.day)) {
      age--;
    }
    if (age < 18 || age > 100) {
      return 'Lovask yalnızca 18 yaş ve üzeri içindir.';
    }
    if (!genderOptions.containsKey(f['gender'])) return 'Cinsiyetini seç.';
    if ((f['city'] as String).trim().length < 2) return 'Şehir seç.';
  }
  if (step == 1 && (f['interestedGenders'] as List).isEmpty) {
    return 'En az bir tercih seç.';
  }
  if (step == 2 && photoCount < 1) return 'En az bir fotoğraf eklemelisin.';
  if (step == 3 && (f['badgeSlugs'] as List).isEmpty) {
    return 'En az bir rozet seç.';
  }
  if (step == 4 &&
      f['heightCm'] != null &&
      (f['heightCm'] < 120 || f['heightCm'] > 230)) {
    return 'Boy bilgisini 120–230 cm arasında gir.';
  }
  if (step == 5 && (f['answer'] as String).trim().isEmpty) {
    return 'İmza cevabını yaz.';
  }
  return null;
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({
    super.key,
    required this.onCompleted,
    this.initialProfile,
  });
  final VoidCallback onCompleted;
  final Map<String, dynamic>? initialProfile;
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final api = LovaskApi();
  late Map<String, dynamic> form;
  late List<Map<String, dynamic>> existing;
  final files = <XFile>[];
  int step = 0;
  bool saving = false;
  int uploaded = 0, uploadTotal = 0;
  String? error;
  bool completed = false;
  int get usablePhotoCount =>
      existing.where((photo) => photo['status'] != 'rejected').length +
      files.length;

  @override
  void initState() {
    super.initState();
    form = {
      'name': '',
      'birthDate': '',
      'gender': '',
      'city': '',
      'phone': '',
      'badgeSlugs': <String>[],
      'prompt': promptOptions.first,
      'answer': '',
      'minAge': 18,
      'maxAge': 80,
      'interestedGenders': genderOptions.keys.toList(),
      'sameCityOnly': false,
      'relationshipGoal': '',
      'maritalStatus': '',
      'hasChildren': null,
      'childrenPreference': '',
      'district': '',
      'alcoholUse': '',
      'smokingUse': '',
      'petPreference': '',
      'sportsHabit': '',
      'heightCm': null,
      'educationLevel': '',
      'languages': <String>[],
      ...?widget.initialProfile,
    };
    existing = (form.remove('photos') as List? ?? [])
        .map((p) => Map<String, dynamic>.from(p))
        .toList();
    completed = form.remove('completed') == true;
  }

  void update(String key, dynamic value) => setState(() {
    form[key] = value;
    error = null;
  });

  void goBack() {
    if (step == 0 || saving) return;
    setState(() {
      step--;
      error = null;
    });
  }

  Widget field(
    String key,
    String label, {
    int maxLength = 80,
    bool number = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      key: ValueKey(key),
      initialValue: form[key]?.toString() ?? '',
      maxLength: maxLength,
      keyboardType: number ? TextInputType.number : TextInputType.text,
      decoration: InputDecoration(labelText: label, counterText: ''),
      onChanged: (v) =>
          form[key] = number ? (v.isEmpty ? null : int.tryParse(v) ?? 0) : v,
    ),
  );

  Widget choice(
    String key,
    String label,
    Map<String, String> options, {
    bool optional = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: DropdownButtonFormField<String>(
      key: ValueKey(key),
      initialValue: options.containsKey(form[key]) ? form[key] : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: [
        if (optional)
          const DropdownMenuItem(
            value: '',
            child: Text('Belirtmek istemiyorum'),
          ),
        ...options.entries.map(
          (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
        ),
      ],
      onChanged: (v) => update(key, v ?? ''),
    ),
  );

  Widget chips(String key, Map<String, String> options, {int? max}) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: options.entries
        .map(
          (e) => LovaskPill(
            e.value,
            selected: (form[key] as List).contains(e.key),
            onPressed: () {
              final selected = !(form[key] as List).contains(e.key);
              final next = List<String>.from(form[key]);
              if (selected && max != null && next.length >= max) {
                setState(
                  () => error = 'En fazla $max seçenek işaretleyebilirsin.',
                );
                return;
              }
              selected ? next.add(e.key) : next.remove(e.key);
              update(key, next);
            },
          ),
        )
        .toList(),
  );

  Future<void> pick() async {
    if (existing.length + files.length >= 6) return;
    try {
      final picked = await pickCroppedProfilePhoto();
      if (picked == null) return;
      final size = await picked.length();
      if (!mounted) return;
      setState(() {
        if (size > 12 * 1024 * 1024) {
          error = 'Fotoğraf en fazla 12 MB olabilir.';
        } else {
          files.add(picked);
          error = null;
        }
      });
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'Fotoğraf seçilemedi veya kırpılamadı. Başka bir fotoğraf dene.',
        );
      }
    }
  }

  Future<void> remove(int index) async {
    if (completed &&
        index < existing.length &&
        existing[index]['status'] == 'approved' &&
        !existing.asMap().entries.any(
          (entry) => entry.key != index && entry.value['status'] == 'approved',
        )) {
      setState(
        () =>
            error = 'Tamamlanmış profilinde en az bir onaylı fotoğraf kalmalı.',
      );
      return;
    }
    if (index >= existing.length) {
      setState(() => files.removeAt(index - existing.length));
      return;
    }
    setState(() => saving = true);
    try {
      await api.deletePhoto(existing[index]['id']);
      if (mounted) setState(() => existing.removeAt(index));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> complete() async {
    for (var i = 0; i < 6; i++) {
      final problem = validateOnboarding(
        form,
        i,
        usablePhotoCount,
        DateTime.now(),
      );
      if (problem != null) {
        setState(() {
          step = i;
          error = problem;
        });
        return;
      }
    }
    setState(() {
      saving = true;
      error = null;
      uploaded = 0;
      uploadTotal = files.length;
    });
    try {
      final saved = await api.saveProfile({...form, 'action': 'save'});
      if (saved['profileId'] == null) {
        throw const LovaskApiException(400, 'Profil oluşturulamadı.');
      }
      while (files.isNotEmpty) {
        final result = await api.uploadPhoto(files.first);
        if (result['photo'] is! Map) {
          throw const LovaskApiException(502, 'Fotoğraf yanıtı alınamadı.');
        }
        existing.add(Map<String, dynamic>.from(result['photo']));
        files.removeAt(0);
        if (mounted) setState(() => uploaded++);
      }
      final result = await api.saveProfile({'action': 'finalize'});
      if (result['completed'] != true) {
        throw const LovaskApiException(400, 'Profil tamamlanamadı.');
      }
      if (mounted) widget.onCompleted();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  List<Widget> content() {
    switch (step) {
      case 0:
        return [
          field('name', 'İsmin', maxLength: 60),
          Semantics(
            button: true,
            label: 'Doğum tarihi seç',
            child: InkWell(
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Doğum tarihi',
                  suffixIcon: Icon(Icons.calendar_month_outlined, size: 20),
                ),
                child: Text(
                  form['birthDate'] == '' ? 'Tarih seç' : form['birthDate'],
                  style: TextStyle(
                    color: form['birthDate'] == '' ? muted : pearl,
                  ),
                ),
              ),
              onTap: () async {
                final now = DateTime.now();
                final last = DateTime(now.year - 18, now.month, now.day);
                final value = await showDatePicker(
                  context: context,
                  firstDate: DateTime(now.year - 100),
                  lastDate: last,
                  initialDate: DateTime.tryParse(form['birthDate']) ?? last,
                );
                if (value != null && mounted) {
                  update('birthDate', value.toIso8601String().substring(0, 10));
                }
              },
            ),
          ),
          const SizedBox(height: 16),
          choice('gender', 'Cinsiyet', genderOptions),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: DropdownButtonFormField<String>(
              key: const ValueKey('city'),
              initialValue: form['city'] == '' ? null : form['city'] as String,
              isExpanded: true,
              menuMaxHeight: 360,
              decoration: const InputDecoration(labelText: 'Şehir'),
              items: [
                if (form['city'] != '' && !turkishCities.contains(form['city']))
                  DropdownMenuItem(
                    value: form['city'] as String,
                    child: Text(form['city'] as String),
                  ),
                for (final city in turkishCities)
                  DropdownMenuItem(value: city, child: Text(city)),
              ],
              onChanged: (city) => update('city', city ?? ''),
            ),
          ),
        ];
      case 1:
        return [
          const Text('Kimlerle tanışmak istersin?'),
          chips('interestedGenders', genderOptions),
          const SizedBox(height: 24),
          Text("Yaş aralığı: ${form['minAge']} – ${form['maxAge']}"),
          RangeSlider(
            min: 18,
            max: 99,
            divisions: 81,
            values: RangeValues(
              (form['minAge'] as num).toDouble(),
              (form['maxAge'] as num).toDouble(),
            ),
            onChanged: (v) => setState(() {
              form['minAge'] = v.start.round();
              form['maxAge'] = v.end.round();
            }),
          ),
          LovaskSurface(
            radius: 16,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Expanded(child: Text('Yalnızca aynı şehir')),
                Switch(
                  value: form['sameCityOnly'],
                  onChanged: (v) => update('sameCityOnly', v),
                ),
              ],
            ),
          ),
        ];
      case 2:
        final count = existing.length + files.length;
        return [
          const Text('En az 1, en fazla 6 fotoğraf ekle.'),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: .8,
            ),
            itemCount: count + (count < 6 ? 1 : 0),
            itemBuilder: (context, i) => i == count
                ? OutlinedButton(
                    onPressed: pick,
                    child: const Icon(Icons.add_a_photo_outlined),
                  )
                : ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        i < existing.length
                            ? Image.network(
                                existing[i]['url'],
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => const ColoredBox(
                                  color: photoDark,
                                  child: Center(
                                    child: Icon(
                                      Icons.broken_image_outlined,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              )
                            : Image.file(
                                File(files[i - existing.length].path),
                                fit: BoxFit.cover,
                              ),
                        Positioned(
                          top: 0,
                          right: 0,
                          child: IconButton(
                            tooltip: 'Fotoğrafı kaldır',
                            onPressed: () => remove(i),
                            icon: const Icon(Icons.close, color: Colors.white),
                          ),
                        ),
                        if (i == 0)
                          const Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: ColoredBox(
                              color: photoDark,
                              child: Padding(
                                padding: EdgeInsets.all(5),
                                child: Text(
                                  'Profil kapağı',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
          ),
        ];
      case 3:
        return [
          choice('relationshipGoal', 'Ne arıyorsun?', {
            'marriage': 'Evlilik',
            'serious': 'Ciddi ilişki',
            'dating': 'Tanışma',
            'short_term': 'Kısa süreli ilişki',
            'friendship': 'Arkadaşlık',
            'unsure': 'Henüz emin değilim',
          }),
          choice('maritalStatus', 'Medeni durum', {
            'never_married': 'Hiç evlenmedim',
            'divorced': 'Boşandım',
            'widowed': 'Dulum',
            'separated': 'Ayrıyım',
            'married': 'Evliyim',
          }),
          DropdownButtonFormField<bool>(
            key: const ValueKey('hasChildren'),
            initialValue: form['hasChildren'],
            decoration: const InputDecoration(labelText: 'Çocuğun var mı?'),
            items: const [
              DropdownMenuItem(value: true, child: Text('Var')),
              DropdownMenuItem(value: false, child: Text('Yok')),
            ],
            onChanged: (v) => update('hasChildren', v),
          ),
          const SizedBox(height: 16),
          choice('childrenPreference', 'Çocuk beklentin', {
            'want': 'İstiyorum',
            'do_not_want': 'İstemiyorum',
            'open': 'Açığım',
            'unsure': 'Emin değilim',
          }),
          const Text('Seni anlatan en fazla üç rozet'),
          chips('badgeSlugs', badgeOptions, max: 3),
        ];
      case 4:
        return [
          field('district', 'İlçe'),
          choice('alcoholUse', 'Alkol', {
            'never': 'Kullanmıyorum',
            'occasionally': 'Nadiren',
            'socially': 'Sosyal ortamlarda',
            'regularly': 'Düzenli',
          }, optional: true),
          choice('smokingUse', 'Sigara', {
            'never': 'Kullanmıyorum',
            'occasionally': 'Nadiren',
            'regularly': 'Düzenli',
            'quitting': 'Bırakıyorum',
          }, optional: true),
          choice('petPreference', 'Evcil hayvan', {
            'has_pets': 'Evcil hayvanım var',
            'likes_pets': 'Severim',
            'no_pets': 'Tercih etmiyorum',
            'allergic': 'Alerjim var',
          }, optional: true),
          choice('sportsHabit', 'Spor', {
            'never': 'Yapmıyorum',
            'sometimes': 'Ara sıra',
            'regularly': 'Düzenli',
            'daily': 'Her gün',
          }, optional: true),
          field('heightCm', 'Boy (cm)', maxLength: 3, number: true),
          choice('educationLevel', 'Eğitim', {
            'high_school': 'Lise',
            'associate': 'Ön lisans',
            'bachelor': 'Lisans',
            'master': 'Yüksek lisans',
            'doctorate': 'Doktora',
            'other': 'Diğer',
          }, optional: true),
          TextFormField(
            key: const ValueKey('languages'),
            initialValue: (form['languages'] as List).join(', '),
            decoration: const InputDecoration(
              labelText: 'Diller (virgülle ayır)',
            ),
            onChanged: (v) => form['languages'] = v
                .split(',')
                .map((s) => s.trim())
                .where((s) => s.isNotEmpty)
                .toSet()
                .toList(),
          ),
        ];
      default:
        return [
          choice('prompt', 'Bir soru seç', {
            for (final p in {...promptOptions, form['prompt'] as String}) p: p,
          }),
          TextFormField(
            key: const ValueKey('answer'),
            initialValue: form['answer'],
            maxLength: 160,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'İmza cevabın'),
            onChanged: (v) => form['answer'] = v,
          ),
        ];
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: step == 0 && !saving,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) goBack();
    },
    child: Scaffold(
      appBar: AppBar(
        leading: step > 0
            ? IconButton(
                tooltip: 'Önceki adıma dön',
                onPressed: saving ? null : goBack,
                icon: const Icon(Icons.arrow_back),
              )
            : null,
        title: const LovaskWordmark(),
        actions: [
          Center(
            child: Text(
              '${step + 1}/6',
              style: const TextStyle(color: muted, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 20),
        ],
      ),
      body: SafeArea(
        child: AbsorbPointer(
          absorbing: saving,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: List.generate(
                    6,
                    (i) => Expanded(
                      child: AnimatedContainer(
                        duration: MediaQuery.disableAnimationsOf(context)
                            ? Duration.zero
                            : const Duration(milliseconds: 180),
                        curve: Curves.easeOutCubic,
                        height: 5,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: i <= step ? wine : line,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (saving)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  child: Column(
                    children: [
                      LinearProgressIndicator(
                        value: uploadTotal > 0 ? uploaded / uploadTotal : null,
                        color: ruby,
                      ),
                      Text(
                        uploadTotal > 0
                            ? 'Fotoğraflar yükleniyor: $uploaded/$uploadTotal'
                            : 'Profilin kaydediliyor…',
                        style: const TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 22,
                    vertical: 8,
                  ),
                  child: Semantics(
                    liveRegion: true,
                    child: LovaskSurface(
                      color: panelLight,
                      radius: 16,
                      child: Text(error!, style: const TextStyle(color: ruby)),
                    ),
                  ),
                ),
              Expanded(
                child: ListView(
                  key: ValueKey(step),
                  padding: const EdgeInsets.all(22),
                  children: [
                    LovaskEyebrow(
                      [
                        'TANIŞALIM',
                        'SENİN YÖRÜNGEN',
                        'İLK BAKIŞ',
                        'AYNI NİYET',
                        'KÜÇÜK AYRINTILAR',
                        'BİR SOHBET BAŞLASIN',
                      ][step],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      [
                        'Her hikâye bir isimle başlar.',
                        'Kimi keşfetmek istersin?',
                        'Fotoğrafların seni anlatsın.',
                        'Aynı şeyi aramak.',
                        'Hayatından ayrıntılar.',
                        'Söze sen başla.',
                      ][step],
                      style: Theme.of(context).textTheme.displayMedium,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      [
                        'Tanışmaya temel bilgilerinden başlayalım.',
                        'Tercihlerini daha sonra istediğin zaman değiştirebilirsin.',
                        'En az bir fotoğraf gerekli. Onaydan sonra keşifte görünürsün.',
                        'Seni anlatan etiketlerle ortak noktalarınızı görünür kıl.',
                        'Paylaşmak istediğin ayrıntıları seç; diğerlerini boş bırakabilirsin.',
                        'Bir soru seç ve sana özgü bir cevapla sohbetin ilk adımını at.',
                      ][step],
                      style: const TextStyle(color: muted, height: 1.45),
                    ),
                    const SizedBox(height: 24),
                    if (step == 0 || step >= 3)
                      LovaskFormCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: content(),
                        ),
                      )
                    else
                      ...content(),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
                child: Row(
                  children: [
                    if (step > 0)
                      TextButton(onPressed: goBack, child: const Text('Geri')),
                    const SizedBox(width: 12),
                    Expanded(
                      child: LovaskPrimaryButton(
                        onPressed: () {
                          if (step == 5) {
                            complete();
                            return;
                          }
                          final problem = validateOnboarding(
                            form,
                            step,
                            usablePhotoCount,
                            DateTime.now(),
                          );
                          setState(() {
                            error = problem;
                            if (problem == null) step++;
                          });
                        },
                        label: saving
                            ? 'Hazırlanıyor…'
                            : step == 5
                            ? 'Profili tamamla'
                            : 'Devam et',
                        icon: step == 5 ? Icons.check : Icons.arrow_forward,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
