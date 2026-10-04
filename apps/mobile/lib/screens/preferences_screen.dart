import 'dart:convert';
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../turkish_cities.dart';
import '../widgets/lovask_primitives.dart';
import 'noir_screen.dart';
import 'onboarding_screen.dart' show genderOptions;

const preferenceChoices = <String, Map<String, String>>{
  'relationshipGoals': {
    'marriage': 'Evlilik',
    'serious': 'Ciddi ilişki',
    'dating': 'Flört',
    'short_term': 'Kısa süreli',
    'friendship': 'Arkadaşlık',
    'unsure': 'Kararsız',
  },
  'maritalStatuses': {
    'never_married': 'Hiç evlenmedi',
    'divorced': 'Boşanmış',
    'widowed': 'Eşi vefat etmiş',
    'separated': 'Ayrı yaşıyor',
    'married': 'Evli',
  },
  'childrenPreferences': {
    'want': 'İstiyor',
    'do_not_want': 'İstemiyor',
    'open': 'Açık',
    'unsure': 'Kararsız',
  },
  'alcoholValues': {
    'never': 'Kullanmıyorum',
    'occasionally': 'Nadiren',
    'socially': 'Sosyal ortamlarda',
    'regularly': 'Düzenli',
  },
  'smokingValues': {
    'never': 'Kullanmıyorum',
    'occasionally': 'Nadiren',
    'regularly': 'Düzenli',
    'quitting': 'Bırakıyorum',
  },
  'petValues': {
    'has_pets': 'Evcil hayvanım var',
    'likes_pets': 'Severim',
    'no_pets': 'Tercih etmiyorum',
    'allergic': 'Alerjim var',
  },
  'sportsValues': {
    'never': 'Yapmıyorum',
    'sometimes': 'Ara sıra',
    'regularly': 'Düzenli',
    'daily': 'Her gün',
  },
  'zodiacValues': {
    'aries': 'Koç',
    'taurus': 'Boğa',
    'gemini': 'İkizler',
    'cancer': 'Yengeç',
    'leo': 'Aslan',
    'virgo': 'Başak',
    'libra': 'Terazi',
    'scorpio': 'Akrep',
    'sagittarius': 'Yay',
    'capricorn': 'Oğlak',
    'aquarius': 'Kova',
    'pisces': 'Balık',
  },
  'educationValues': {
    'high_school': 'Lise',
    'associate': 'Ön lisans',
    'bachelor': 'Lisans',
    'master': 'Yüksek lisans',
    'doctorate': 'Doktora',
    'other': 'Diğer',
  },
};

Map<String, dynamic> defaultDiscoveryPreferences() => {
  'minAge': 18,
  'maxAge': 99,
  'verifiedOnly': false,
  'interestedGenders': genderOptions.keys.toList(),
  'sameCityOnly': false,
  'cities': <String>[],
  'maxDistanceKm': null,
  for (final key in preferenceChoices.keys) key: <String>[],
  'hasChildrenValues': <bool>[],
  'minHeightCm': null,
  'maxHeightCm': null,
  'languageValues': <String>[],
};

class PreferencesScreen extends StatefulWidget {
  const PreferencesScreen({super.key, this.api});
  final LovaskApi? api;
  @override
  State<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> {
  late final api = widget.api ?? LovaskApi();
  final languages = TextEditingController();
  Map<String, dynamic> draft = defaultDiscoveryPreferences();
  bool loading = true, saving = false, premium = false;
  bool loaded = false;
  int revision = 0;
  String? error;
  String? _savedDraft;
  bool _allowPop = false, _confirmingExit = false;
  String get _draftKey => jsonEncode([draft, languages.text]);

  Future<void> _leave() async {
    if (saving || _confirmingExit) return;
    _confirmingExit = true;
    final discard =
        _savedDraft == _draftKey ||
        await showLovaskSheet<bool>(
              context: context,
              builder: (dialogContext) => Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Değişikliklerin kaydedilmedi',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Tercihlerini korumak için geri dönüp filtreleri uygula.',
                  ),
                  const SizedBox(height: 24),
                  LovaskPrimaryButton(
                    label: 'Düzenlemeye devam et',
                    onPressed: () => Navigator.pop(dialogContext, false),
                  ),
                  const SizedBox(height: 12),
                  LovaskGhostButton(
                    label: 'Kaydetmeden çık',
                    onPressed: () => Navigator.pop(dialogContext, true),
                  ),
                ],
              ),
            ) ==
            true;
    _confirmingExit = false;
    if (!mounted || !discard) return;
    setState(() => _allowPop = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.pop(context);
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    languages.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      loaded = false;
      error = null;
    });
    try {
      final result = await api.preferences();
      if (!mounted) return;
      setState(() {
        draft = {
          ...defaultDiscoveryPreferences(),
          ...Map<String, dynamic>.from(result['preferences']),
        };
        premium = result['premium'] == true;
        draft['cities'] = List<String>.from(draft['cities'] as List);
        languages.text = (draft['languageValues'] as List).join(', ');
        _savedDraft = _draftKey;
        loading = false;
        loaded = true;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    }
  }

  void _selectCities() {
    final selected = List<String>.from(draft['cities'] as List);
    final options = [
      ...selected.where((city) => !turkishCities.contains(city)),
      ...turkishCities,
    ];
    showLovaskSheet<void>(
      context: context,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Diğer şehirler',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text('${selected.length}/10 şehir seçildi'),
            SizedBox(
              height: MediaQuery.sizeOf(context).height * .55,
              child: ListView.builder(
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final city = options[index];
                  return CheckboxListTile(
                    title: Text(city),
                    value: selected.contains(city),
                    onChanged: selected.length >= 10 && !selected.contains(city)
                        ? null
                        : (checked) => setSheetState(() {
                            if (checked == true) {
                              selected.add(city);
                            } else {
                              selected.remove(city);
                            }
                          }),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () {
                setState(() => draft['cities'] = selected);
                Navigator.pop(sheetContext);
              },
              child: const Text('Tamam'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> save() async {
    if (!loaded) return;
    final min = draft['minHeightCm'] as int?,
        max = draft['maxHeightCm'] as int?;
    if ((draft['interestedGenders'] as List).isEmpty ||
        (min != null && (min < 120 || min > 230)) ||
        (max != null && (max < 120 || max > 230)) ||
        (min != null && max != null && min > max)) {
      setState(
        () => error =
            'En az bir kişi tercihi seç; boy aralığını 120–230 cm arasında gir.',
      );
      return;
    }
    List<String> entries(String text) => text
        .split(',')
        .map((v) => v.trim())
        .where((v) => v.isNotEmpty)
        .take(10)
        .toList();
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await api.savePreferences({
        ...draft,
        'cities': draft['sameCityOnly'] == true
            ? <String>[]
            : (draft['cities'] as List<String>),
        'languageValues': premium ? entries(languages.text) : <String>[],
        'verifiedOnly': draft['verifiedOnly'] == true,
      });
      if (mounted) {
        setState(() => _allowPop = true);
        await WidgetsBinding.instance.endOfFrame;
        if (mounted) Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget chips(String key, String label, Map<Object, String> options) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: options.entries.map((entry) {
                final selected = (draft[key] as List).contains(entry.key);
                return LovaskPill(
                  entry.value,
                  selected: selected,
                  onPressed: saving
                      ? null
                      : () => setState(() {
                          final value = !selected;
                          final next = List<dynamic>.from(draft[key]);
                          value ? next.add(entry.key) : next.remove(entry.key);
                          draft[key] = next;
                        }),
                );
              }).toList(),
            ),
          ],
        ),
      );

  Widget toggle(String key, String label, {bool enabled = true}) =>
      LovaskSurface(
        radius: 16,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        child: Row(
          children: [
            Expanded(child: Text(label)),
            Switch(
              value: draft[key] == true,
              onChanged: !enabled || saving
                  ? null
                  : (v) => setState(() => draft[key] = v),
            ),
          ],
        ),
      );

  Widget height(String key, String label) => Expanded(
    child: TextFormField(
      key: ValueKey('$key-$revision'),
      initialValue: draft[key]?.toString() ?? '',
      keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label),
      onChanged: (v) => draft[key] = v.isEmpty ? null : int.tryParse(v) ?? 0,
    ),
  );

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !loaded || _allowPop,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop) _leave();
    },
    child: Scaffold(
      appBar: AppBar(title: const Text('Keşif pusulan')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : !loaded
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    error ?? 'Tercihler yüklenemedi.',
                    textAlign: TextAlign.center,
                  ),
                  LovaskGhostButton(label: 'Tekrar dene', onPressed: load),
                ],
              ),
            )
          : AbsorbPointer(
              absorbing: saving,
              child: ListView(
                padding: const EdgeInsets.all(22),
                children: [
                  const LovaskEyebrow('SANA GÖRE BİR KEŞİF'),
                  const SizedBox(height: 12),
                  Text(
                    'Yakın hissettiklerin.',
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Ortak bir niyet, yakın bir şehir, sana uyan bir hayat.',
                    style: TextStyle(color: muted, height: 1.5),
                  ),
                  const SizedBox(height: 28),
                  if (error != null) ...[
                    Text(error!, style: const TextStyle(color: ruby)),
                    TextButton(
                      onPressed: load,
                      child: const Text('Yeniden yükle'),
                    ),
                  ],
                  chips(
                    'interestedGenders',
                    'İlgilendiğin kişiler',
                    genderOptions,
                  ),
                  const LovaskSectionTitle('Yaş ve yakınlık'),
                  Text('Yaş aralığı  ${draft['minAge']} – ${draft['maxAge']}'),
                  RangeSlider(
                    min: 18,
                    max: 99,
                    divisions: 81,
                    values: RangeValues(
                      (draft['minAge'] as num).toDouble(),
                      (draft['maxAge'] as num).toDouble(),
                    ),
                    labels: RangeLabels(
                      '${draft['minAge']}',
                      '${draft['maxAge']}',
                    ),
                    onChanged: (v) => setState(() {
                      draft['minAge'] = v.start.round();
                      draft['maxAge'] = v.end.round();
                    }),
                  ),
                  toggle('sameCityOnly', 'Yalnızca benim şehrim'),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: draft['sameCityOnly'] == true
                        ? null
                        : _selectCities,
                    child: Text(
                      (draft['cities'] as List).isEmpty
                          ? 'Diğer şehirler: Şehir seç'
                          : 'Diğer şehirler: ${(draft['cities'] as List).join(', ')}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<int>(
                    key: ValueKey('distance-$revision'),
                    initialValue: draft['maxDistanceKm'],
                    decoration: const InputDecoration(
                      labelText: 'Şehir merkezleri arası mesafe',
                    ),
                    items: [
                      const DropdownMenuItem<int>(
                        value: null,
                        child: Text('Sınır yok'),
                      ),
                      for (final km in <int>{
                        25,
                        50,
                        100,
                        250,
                        500,
                        1000,
                        if (draft['maxDistanceKm'] != null)
                          draft['maxDistanceKm'],
                      })
                        DropdownMenuItem(value: km, child: Text('$km km')),
                    ],
                    onChanged: draft['sameCityOnly'] == true
                        ? null
                        : (v) => setState(() => draft['maxDistanceKm'] = v),
                  ),
                  const SizedBox(height: 20),
                  const LovaskSectionTitle('Ortak bir başlangıç'),
                  chips(
                    'relationshipGoals',
                    'İlişki beklentisi',
                    preferenceChoices['relationshipGoals']!,
                  ),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: noirSurface,
                      border: Border.all(color: noirBorder),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Daha ince bir uyum',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        toggle(
                          'verifiedOnly',
                          'Fotoğrafı doğrulanmış profiller',
                          enabled: true,
                        ),
                        if (!premium)
                          TextButton.icon(
                            icon: const Icon(Icons.lock_outline),
                            label: const Text('Diğer Noir filtrelerini gör'),
                            onPressed: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const NoirScreen(),
                                ),
                              );
                              if (mounted) load();
                            },
                          ),
                        if (premium) ...[
                          for (final entry in const {
                            'maritalStatuses': 'Medeni durum',
                            'childrenPreferences': 'Gelecekte çocuk',
                            'alcoholValues': 'Alkol',
                            'smokingValues': 'Sigara',
                            'petValues': 'Evcil hayvan',
                            'sportsValues': 'Spor',
                            'zodiacValues': 'Burç',
                            'educationValues': 'Eğitim',
                          }.entries)
                            chips(
                              entry.key,
                              entry.value,
                              preferenceChoices[entry.key]!,
                            ),
                          chips('hasChildrenValues', 'Çocuğu var mı?', {
                            false: 'Hayır',
                            true: 'Evet',
                          }),
                          Row(
                            children: [
                              height('minHeightCm', 'En az boy'),
                              const SizedBox(width: 10),
                              height('maxHeightCm', 'En çok boy'),
                            ],
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: languages,
                            maxLength: 180,
                            decoration: const InputDecoration(
                              labelText: 'Diller',
                              hintText: 'Türkçe, İngilizce',
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton(
                    onPressed: () => setState(() {
                      draft = defaultDiscoveryPreferences();
                      languages.clear();
                      revision++;
                    }),
                    child: const Text('Filtreleri sıfırla'),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            ),
      bottomNavigationBar: loaded
          ? SafeArea(
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: LovaskPrimaryButton(
                onPressed: saving ? null : save,
                label: saving ? 'Kaydediliyor…' : 'Filtreleri uygula',
                icon: Icons.check,
              ),
            )
          : null,
    ),
  );
}
