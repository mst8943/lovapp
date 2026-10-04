import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries(
  (await readFile(path.join(root, ".env.production.local"), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line && line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// City districts mapping
const cityDistricts = {
  "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Nişantaşı", "Üsküdar", "Bakırköy", "Sarıyer", "Ataşehir", "Beyoğlu", "Moda", "Suadiye", "Maltepe"],
  "Ankara": ["Çankaya", "Tunalı", "Gaziosmanpaşa", "Bahçelievler", "Ümitköy", "Çayyolu", "Batıkent", "Yenimahalle"],
  "İzmir": ["Karşıyaka", "Alsancak", "Bornova", "Bostanlı", "Urla", "Çeşme", "Bayraklı", "Göztepe", "Konak"],
  "Antalya": ["Muratpaşa", "Konyaaltı", "Lara", "Alanya", "Kaş"],
  "Bursa": ["Nilüfer", "Osmangazi", "Mudanya", "Bademli"],
  "Eskişehir": ["Tepebaşı", "Odunpazarı"],
  "Kocaeli": ["İzmit", "Değirmendere", "Gebze", "Başiskele"],
  "Muğla": ["Bodrum", "Fethiye", "Marmaris", "Menteşe", "Datça"],
  "Adana": ["Çukurova", "Seyhan", "Barajyolu"],
  "Mersin": ["Yenişehir", "Mezitli", "Marina"],
  "Gaziantep": ["Şehitkamil", "Şahinbey", "İbrahimli"],
  "Kayseri": ["Melikgazi", "Talas"],
  "Konya": ["Selçuklu", "Meram"],
  "Samsun": ["Atakum", "İlkadım"],
  "Trabzon": ["Ortahisar", "Yomra"],
  "Denizli": ["Pamukkale", "Merkezefendi", "Çamlık"],
  "Çanakkale": ["Merkez", "Kordon", "Bozcaada"],
  "Balıkesir": ["Ayvalık", "Edremit", "Altınoluk", "Bandırma"],
  "Aydın": ["Kuşadası", "Didim", "Efeler"],
  "Tekirdağ": ["Süleymanpaşa", "Çorlu", "Değirmenaltı"],
  "Edirne": ["Merkez", "Karaağaç"],
  "Sakarya": ["Serdivan", "Adapazarı"],
  "Yalova": ["Merkez", "Çınarcık"],
  "Manisa": ["Yunusemre", "Şehzadeler"],
  "Bolu": ["Merkez"],
  "Rize": ["Merkez"],
  "Ordu": ["Altınordu"],
  "Zonguldak": ["Merkez", "Kdz. Ereğli"],
  "Sivas": ["Merkez"],
  "Mardin": ["Artuklu", "Midyat"],
};

const archetypes = [
  {
    theme: "creative",
    bios: [
      "Tasarım, analog fotoğraflar ve sakin kahve köşeleri. Küçük ayrıntılarda saklı güzellikleri keşfetmeyi seviyorum.",
      "Görsel sanatlar, sergiler ve sahil yürüyüşleri. Hayatı biraz estetik, biraz da spontane yaşamaktan yanayım.",
      "İç mimarlık, tasarım ve akustik müzik. Şehrin ilham veren mekanlarını keşfetmek benim için bir tutku.",
      "Kreatif projeler, yeni sergiler ve güzel bir kahve eşliğinde yapılan derin sohbetler."
    ],
    relationshipGoals: ["dating", "serious"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["open", "want", "unsure"],
    alcoholUses: ["socially", "occasionally"],
    smokingUses: ["never", "occasionally"],
    petPreferences: ["likes_pets", "has_pets"],
    sportsHabits: ["sometimes", "regularly"],
    educationLevels: ["bachelor", "master"],
    badgeSlugs: ["coffee", "live-music", "foodie"],
    promptPrompt: "Benimle çıkmanın küçük bir lüksü…",
    answers: [
      "Şehirdeki en tatlı kahve dükkanını ve en iyi çalma listesini bulurum.",
      "Sakin ve gizli kalmış en güzel terasları bilirim.",
      "Asla sıradan bir mekana gitmeyiz, her zaman keyifli bir hikayesi olan yerler seçerim."
    ]
  },
  {
    theme: "corporate",
    bios: [
      "Gündüzleri planlı ve disiplinli, akşamları ise keyifli bir sohbetin ve iyi bir yemeğin peşinde.",
      "Hukuk, iş dünyası ve şehir temposu. Hafta sonları ise sakinlik, iyi kahve ve tiyatro.",
      "Finans dünyasında analitik bir tempo, özel hayatta ise samimi, esprili ve dengeli bir yaşam.",
      "Kariyerime odaklıyım ama hayatın keyifli anlarını kaçırmayacak kadar da yaşamayı seviyorum."
    ],
    relationshipGoals: ["serious", "marriage"],
    maritalStatuses: ["never_married", "divorced"],
    childrenPreferences: ["want", "open"],
    alcoholUses: ["socially", "occasionally", "never"],
    smokingUses: ["never"],
    petPreferences: ["likes_pets"],
    sportsHabits: ["regularly", "daily"],
    educationLevels: ["bachelor", "master"],
    badgeSlugs: ["serious", "foodie", "coffee"],
    promptPrompt: "Beni etkilemenin en kısa yolu…",
    answers: [
      "Zeki bir mizah anlayışı ve yapmacıksız, içten bir sohbet.",
      "Kendine güvenen, dürüst ve ne istediğini bilen bir duruş.",
      "Gereksiz oyunlara girmeden açık ve net iletişim kurmak."
    ]
  },
  {
    theme: "adventure",
    bios: [
      "Hafta sonu plansız yolculuklar, kamp ateşleri ve yeni rotalar. Şehrin gürültüsünden kaçıp deniz havası almak favorim.",
      "Seyahat etmeyi, yeni kültürler keşfetmeyi ve sırt çantamı alıp yola çıkmayı çok seviyorum.",
      "Deniz tutkunu, doğa aşığı ve spontane planların insanı. Anı biriktirmeyi eşyalardan çok önemsiyorum.",
      "Yol hikayeleri, trekking ve gün batımında kahve. Rutinlerden uzak kalmayı başaranlara selam!"
    ],
    relationshipGoals: ["dating", "serious"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["open", "want", "unsure"],
    alcoholUses: ["socially", "occasionally"],
    smokingUses: ["never"],
    petPreferences: ["has_pets", "likes_pets"],
    sportsHabits: ["regularly", "daily"],
    educationLevels: ["bachelor"],
    badgeSlugs: ["adventure", "travel", "fun"],
    promptPrompt: "Birlikte mutlaka denemeliyiz…",
    answers: [
      "Gün doğumunda deniz kenarında sessiz bir yürüyüş ve plansız bir sahil rotası.",
      "Hafta sonu bavulunu alıp hiç gitmediğimiz bir sahil kasabasına kaçmak.",
      "Yıldızların altında kamp yapıp sabaha kadar müzik dinlemek."
    ]
  },
  {
    theme: "wellness",
    bios: [
      "Pilates, taze demlenmiş bitki çayları ve pozitif enerji. Dengeli yaşamayı ama küçük kaçamakları da ihmal etmemeyi seviyorum.",
      "Beslenme uzmanlığı, sağlıklı yaşam ve iyi bir uyku düzeni. Kendine iyi bakan insanları takdir ediyorum.",
      "Sabah koşuları, yoga ve sakin bir zihin. Pozitif kalmak ve kaliteli insanlarla vakit geçirmek en büyük önceliğim.",
      "Zihnen ve bedenen dengede kalmaya çalışan, küçük şeylerden mutlu olabilen biriyim."
    ],
    relationshipGoals: ["serious", "dating"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["want", "open"],
    alcoholUses: ["occasionally", "never"],
    smokingUses: ["never"],
    petPreferences: ["likes_pets"],
    sportsHabits: ["daily", "regularly"],
    educationLevels: ["bachelor"],
    badgeSlugs: ["coffee", "adventure", "serious"],
    promptPrompt: "En gizli yeteneğim…",
    answers: [
      "En stresli günde bile ortamın enerjisini bir anda yükseltebilmek.",
      "İçimdeki huzuru ve sakinliği karşımdakine de kolayca geçirebilmek.",
      "Evdeki en sade malzemelerle bile harika ve sağlıklı bir sofra kurmak."
    ]
  },
  {
    theme: "culture",
    bios: [
      "Sahaflar, bağımsız sinema ve uzun vapur sohbetleri. Anlatacak hikayesi olan insanları dinlemeyi çok severim.",
      "Edebiyat, tiyatro ve plaklar. Şehrin tarihi dokusunda kaybolmak ve kahve içmek günümü güzelleştirir.",
      "Psikoloji, sanat tarihi ve derin sohbetler. Yüzeysel konuşmalar yerine samimi paylaşımları tercih ederim.",
      "İyi bir kitap, sakin bir caz tınısı ve zamansız sohbetler benim huzur alanım."
    ],
    relationshipGoals: ["serious", "dating"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["open", "want"],
    alcoholUses: ["socially", "never"],
    smokingUses: ["never", "quitting"],
    petPreferences: ["has_pets", "likes_pets"],
    sportsHabits: ["sometimes"],
    educationLevels: ["bachelor", "master"],
    badgeSlugs: ["coffee", "night-owl", "live-music"],
    promptPrompt: "Beni etkilemenin en kısa yolu…",
    answers: [
      "Gerçekten dinlediğini hissettirmek ve sevdiğin bir kitaptan samimiyetle bahsetmek.",
      "Kelimeleri özenle seçmek ve yapaylıktan uzak olmak.",
      "Beklenmedik bir anda akıllıca ve ince bir espri yapmak."
    ]
  },
  {
    theme: "foodie",
    bios: [
      "Yeni mekanlar ve dünya mutfaklarını denemek vazgeçilmezim. İyi bir masa etrafında saatlerce süren sohbetlere bayılırım.",
      "Gastronomi merakı, kahve tadımları ve hafta sonu brunchları. Lezzeti ve paylaşmayı çok seviyorum.",
      "Yemek yapmayı da keşfetmeyi de çok seven biriyim. İyi bir tatlı ve güzel bir kahve her sorunu çözer.",
      "Yeni tatlar denemek, sokak lezzetlerinden gurme mekanlara uzanan küçük gastronomi turları yapmak vazgeçilmezim."
    ],
    relationshipGoals: ["dating", "serious"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["open", "unsure"],
    alcoholUses: ["socially", "occasionally"],
    smokingUses: ["never", "occasionally"],
    petPreferences: ["likes_pets"],
    sportsHabits: ["sometimes", "regularly"],
    educationLevels: ["bachelor"],
    badgeSlugs: ["foodie", "fun", "travel"],
    promptPrompt: "Benimle çıkmanın küçük bir lüksü…",
    answers: [
      "Asla kötü bir yerde yemek yemeyiz, her zaman gizli kalmış harika bir lezzet noktası bilirim.",
      "En kalabalık günde bile en keyifli masayı bulup rezervasyon yaptırabilirim.",
      "Sana daha önce hiç denemediğin bir lezzeti tattırıp favorin yapabilirim."
    ]
  },
  {
    theme: "nightlife_music",
    bios: [
      "Akustik konserler, plaklar ve gece yürüyüşleri. Hayatı hafif yaşamayı ve spontane anların tadını çıkarmayı seviyorum.",
      "Canlı müzik mekanları, festivaller ve pozitif enerji. Gülmeyi, dans etmeyi ve eğlenmeyi seven biriyim.",
      "Geceleri üretmeyi, müzik dinlemeyi ve şehrin ışıklarını izlemeyi severim. Samimi ve sıcak sohbetler favorim.",
      "Müzik zevki iyi olan ve hayata neşeyle bakan insanların aurası bambaşka oluyor."
    ],
    relationshipGoals: ["dating", "serious"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["open", "unsure"],
    alcoholUses: ["socially"],
    smokingUses: ["never", "occasionally"],
    petPreferences: ["likes_pets"],
    sportsHabits: ["sometimes"],
    educationLevels: ["bachelor", "associate"],
    badgeSlugs: ["live-music", "night-owl", "fun"],
    promptPrompt: "Birlikte mutlaka denemeliyiz…",
    answers: [
      "Yağmurlu bir akşamda sakin bir caz kulübünde saatlerce sohbet etmek.",
      "Sevdiğimiz bir grubun canlı konserine gidip şarkılara avazımız çıktığı kadar eşlik etmek.",
      "Gece yarısı sahilde oturup müzik dinleyerek sohbet etmek."
    ]
  },
  {
    theme: "heartfelt",
    bios: [
      "Huzurlu akşamlar, sevdiklerimle geçirilen zamanlar ve samimi bağlar. Gerçek ve güven veren bir bağ kurmak istiyorum.",
      "Hayatımda huzura, dürüstlüğe ve karşılıklı saygıya çok önem veririm. Küçük jestler ve samimiyet benim için çok değerli.",
      "Aileme, dostlarıma ve işime değer veren, ayakları yere basan ve geleceğe umutla bakan biriyim.",
      "Gereksiz telaşlardan uzak, sakin, dürüst ve derin bağlar kurabileceğim insanlarla yol almak istiyorum."
    ],
    relationshipGoals: ["serious", "marriage"],
    maritalStatuses: ["never_married"],
    childrenPreferences: ["want", "open"],
    alcoholUses: ["never", "occasionally"],
    smokingUses: ["never"],
    petPreferences: ["likes_pets"],
    sportsHabits: ["sometimes"],
    educationLevels: ["bachelor"],
    badgeSlugs: ["serious", "coffee", "foodie"],
    promptPrompt: "Beni etkilemenin en kısa yolu…",
    answers: [
      "Dürüst, net ve olduğu gibi davranan biri olmak.",
      "Sözünün arkasında durmak ve nezaketi bir yaşam biçimi olarak görmek.",
      "Beni gerçekten anlamak için dinlemek ve içten bir gülümseme."
    ]
  }
];

const heights = [160, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 178];
const languageOptions = [
  ["Türkçe", "İngilizce"],
  ["Türkçe", "İngilizce"],
  ["Türkçe", "İngilizce"],
  ["Türkçe"],
  ["Türkçe", "İngilizce", "Almanca"],
  ["Türkçe", "İngilizce", "Fransızca"],
  ["Türkçe", "İspanyolca"],
  ["Türkçe", "İtalyanca"],
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

export async function runApply({ limit = null, profileId = null } = {}) {
  let query = admin.from("profiles").select("id, display_name, city, gender, birth_date").eq("kind", "bot");
  if (profileId) query = query.eq("id", profileId);
  if (limit) query = query.limit(limit);

  const { data: dbBots, error: botErr } = await query;
  if (botErr || !dbBots) throw new Error("Botlar yüklenemedi: " + botErr?.message);

  const { data: dbBadges } = await admin.from("intent_badges").select("id, slug, label");
  const { data: dbPrompts } = await admin.from("icebreaker_prompts").select("id, prompt");

  const badgeMapBySlug = new Map((dbBadges || []).map(b => [b.slug, b.id]));
  const promptMapByPrompt = new Map((dbPrompts || []).map(p => [p.prompt, p.id]));

  console.log(`Güncellenecek bot sayısı: ${dbBots.length}`);

  let updatedCount = 0;
  const concurrency = 10;
  
  async function processBot(bot) {
    const seed = hashCode(bot.id);
    const archetype = pick(archetypes, seed);

    const city = bot.city || "İstanbul";
    const districts = cityDistricts[city] || [city];
    const district = pick(districts, seed + 1);

    const birthYear = new Date(bot.birth_date).getFullYear();
    const age = 2026 - birthYear;

    const heightCm = pick(heights, seed + 2);
    const relationshipGoal = pick(archetype.relationshipGoals, seed + 3);
    let maritalStatus = pick(archetype.maritalStatuses, seed + 4);
    let hasChildren = false;
    if (age >= 31 && seed % 10 === 0) {
      maritalStatus = "divorced";
      if (seed % 2 === 0) hasChildren = true;
    }
    const childrenPreference = hasChildren ? "open" : pick(archetype.childrenPreferences, seed + 5);
    const alcoholUse = pick(archetype.alcoholUses, seed + 6);
    const smokingUse = pick(archetype.smokingUses, seed + 7);
    const petPreference = pick(archetype.petPreferences, seed + 8);
    const sportsHabit = pick(archetype.sportsHabits, seed + 9);
    const educationLevel = pick(archetype.educationLevels, seed + 10);
    const languages = pick(languageOptions, seed + 11);
    const bio = pick(archetype.bios, seed + 12);

    // 1. Update profiles table
    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        district,
        height_cm: heightCm,
        relationship_goal: relationshipGoal,
        marital_status: maritalStatus,
        has_children: hasChildren,
        children_preference: childrenPreference,
        alcohol_use: alcoholUse,
        smoking_use: smokingUse,
        pet_preference: petPreference,
        sports_habit: sportsHabit,
        education_level: educationLevel,
        languages,
        bio,
      })
      .eq("id", bot.id)
      .eq("kind", "bot");

    if (updateErr) {
      console.error(`Bot ${bot.display_name} (${bot.id}) güncellenemedi:`, updateErr);
      return;
    }

    // 2. Profile Intentions (Badges)
    const badgeIds = archetype.badgeSlugs.map(slug => badgeMapBySlug.get(slug)).filter(Boolean);
    if (badgeIds.length > 0) {
      await admin.from("profile_intentions").delete().eq("profile_id", bot.id);
      await admin.from("profile_intentions").insert(
        badgeIds.map(badge_id => ({ profile_id: bot.id, badge_id }))
      );
    }

    // 3. Profile Answers
    const promptId = promptMapByPrompt.get(archetype.promptPrompt) || dbPrompts?.[0]?.id;
    const answer = pick(archetype.answers, seed + 13);
    if (promptId && answer) {
      await admin.from("profile_answers").delete().eq("profile_id", bot.id);
      await admin.from("profile_answers").insert({
        profile_id: bot.id,
        prompt_id: promptId,
        answer: answer.slice(0, 240),
        sort_order: 0,
      });
    }

    updatedCount++;
    if (updatedCount % 50 === 0 || updatedCount === dbBots.length) {
      console.log(`İlerleme: ${updatedCount}/${dbBots.length} bot güncellendi.`);
    }
  }

  for (let i = 0; i < dbBots.length; i += concurrency) {
    const chunk = dbBots.slice(i, i + concurrency);
    await Promise.all(chunk.map(processBot));
  }

  return { total: dbBots.length, updatedCount };

}

if (process.argv[1]?.endsWith("apply-bot-data.mjs")) {
  const isOne = process.argv.includes("--one");
  const result = await runApply({ limit: isOne ? 1 : null });
  console.log("Tamamlandı:", result);
}
