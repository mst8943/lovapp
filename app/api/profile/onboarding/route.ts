import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const saveSchema = z
  .object({
    action: z.literal("save"),
    name: z.string().trim().min(2).max(60),
    birthDate: z.string().date(),
    gender: z.enum(["kadın", "erkek", "nonbinary", "other"]),
    city: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(24),
    badgeSlugs: z.array(z.string().trim().min(1).max(50)).min(1).max(3),
    prompt: z.string().trim().min(1).max(240),
    answer: z.string().trim().min(1).max(160),
    minAge: z.number().int().min(18).max(99),
    maxAge: z.number().int().min(18).max(99),
    interestedGenders: z
      .array(z.enum(["kadın", "erkek", "nonbinary", "other"]))
      .min(1)
      .max(4),
    sameCityOnly: z.boolean(),
    relationshipGoal: z.enum([
      "",
      "marriage",
      "serious",
      "dating",
      "short_term",
      "friendship",
      "unsure",
    ]),
    maritalStatus: z.enum([
      "",
      "never_married",
      "divorced",
      "widowed",
      "separated",
      "married",
    ]),
    hasChildren: z.boolean().nullable(),
    childrenPreference: z.enum(["", "want", "do_not_want", "open", "unsure"]),
    district: z.string().trim().max(80),
    alcoholUse: z.enum(["", "never", "occasionally", "socially", "regularly"]),
    smokingUse: z.enum(["", "never", "occasionally", "regularly", "quitting"]),
    petPreference: z.enum([
      "",
      "has_pets",
      "likes_pets",
      "no_pets",
      "allergic",
    ]),
    sportsHabit: z.enum(["", "never", "sometimes", "regularly", "daily"]),
    heightCm: z.number().int().min(120).max(230).nullable(),
    educationLevel: z.enum([
      "",
      "high_school",
      "associate",
      "bachelor",
      "master",
      "doctorate",
      "other",
    ]),
    languages: z.array(z.string().trim().min(1).max(40)).max(10),
  })
  .refine((value) => value.minAge <= value.maxAge, {
    message: "Yaş aralığını kontrol et.",
    path: ["minAge"],
  });
const finalizeSchema = z.object({ action: z.literal("finalize") });
const payloadSchema = z.discriminatedUnion("action", [
  saveSchema,
  finalizeSchema,
]);

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const fields: Record<string, string> = {
      name: "İsim",
      birthDate: "Doğum tarihi",
      gender: "Cinsiyet",
      city: "Şehir",
      phone: "Telefon",
      badgeSlugs: "Niyet rozeti",
      prompt: "İmza sorusu",
      answer: "İmza cevabı",
      minAge: "En az yaş",
      maxAge: "En çok yaş",
      interestedGenders: "Tanışma tercihi",
      relationshipGoal: "İlişki beklentisi",
      maritalStatus: "Medeni durum",
      hasChildren: "Çocuk bilgisi",
      childrenPreference: "Çocuk tercihi",
      heightCm: "Boy",
      languages: "Diller",
    };
    const field = fields[String(issue?.path[0] ?? "")];
    return NextResponse.json(
      {
        error:
          issue?.message === "Yaş aralığını kontrol et."
            ? issue.message
            : field
              ? `${field} bilgisini kontrol et: eksik veya geçersiz.`
              : "Profil bilgilerini kontrol et: eksik veya geçersiz alan var.",
      },
      { status: 400 },
    );
  }

  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!session || !user)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "Sunucu bağlantısı yapılandırılmamış." },
      { status: 503 },
    );
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!existingProfile && user.app_metadata.approved_member !== true)
    return NextResponse.json(
      { error: "Üyelik başvurusu ve davetiye gerekli." },
      { status: 403 },
    );

  if (parsed.data.action === "finalize") {
    const { error } = await session.rpc("finalize_onboarding");
    if (error) return rpcError(error.message);
    return NextResponse.json({ completed: true });
  }

  const birthDate = new Date(`${parsed.data.birthDate}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() < birthDate.getUTCDate())
  )
    age--;
  if (!Number.isFinite(age) || age < 18 || age > 100) {
    return NextResponse.json(
      { error: "Lovask yalnızca 18 yaş ve üzeri içindir." },
      { status: 400 },
    );
  }

  const { data, error } = await session.rpc("save_onboarding_profile", {
    profile_name: parsed.data.name,
    profile_birth_date: parsed.data.birthDate,
    profile_gender: parsed.data.gender,
    profile_city: parsed.data.city,
    profile_phone: parsed.data.phone,
    badge_slugs: parsed.data.badgeSlugs,
    icebreaker_prompt: parsed.data.prompt,
    icebreaker_answer: parsed.data.answer,
  });
  if (error) return rpcError(error.message);
  const { error: detailsError } = await admin
    .from("profiles")
    .update({
      relationship_goal: parsed.data.relationshipGoal || null,
      marital_status: parsed.data.maritalStatus || null,
      has_children: parsed.data.hasChildren,
      children_preference: parsed.data.childrenPreference || null,
      district: parsed.data.district || null,
      alcohol_use: parsed.data.alcoholUse || null,
      smoking_use: parsed.data.smokingUse || null,
      pet_preference: parsed.data.petPreference || null,
      sports_habit: parsed.data.sportsHabit || null,
      height_cm: parsed.data.heightCm,
      education_level: parsed.data.educationLevel || null,
      languages: [...new Set(parsed.data.languages)],
      updated_at: new Date().toISOString(),
    })
    .eq("id", data);
  if (detailsError)
    return NextResponse.json(
      { error: "İlişki tercihleri kaydedilemedi." },
      { status: 503 },
    );
  const { error: preferenceError } = await session
    .from("discovery_preferences")
    .upsert({
      profile_id: data,
      min_age: parsed.data.minAge,
      max_age: parsed.data.maxAge,
      interested_genders: parsed.data.interestedGenders,
      same_city_only: parsed.data.sameCityOnly,
      updated_at: new Date().toISOString(),
    });
  if (preferenceError)
    return NextResponse.json(
      { error: "Keşfet tercihleri kaydedilemedi." },
      { status: 503 },
    );
  return NextResponse.json({ profileId: data });
}

export async function GET() {
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user)
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "Sunucu bağlantısı yapılandırılmamış." },
      { status: 503 },
    );
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id,display_name,birth_date,gender,city,onboarding_completed,relationship_goal,marital_status,has_children,children_preference,district,alcohol_use,smoking_use,pet_preference,sports_habit,height_cm,education_level,languages",
    )
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile) return NextResponse.json({ profile: null });

  const [
    { data: privateData },
    { data: intentions },
    { data: answers },
    { data: photos },
    { data: preferences },
  ] = await Promise.all([
    admin
      .from("private_profile_data")
      .select("phone")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    admin
      .from("profile_intentions")
      .select("intent_badges(slug)")
      .eq("profile_id", profile.id),
    admin
      .from("profile_answers")
      .select("answer,icebreaker_prompts(prompt)")
      .eq("profile_id", profile.id)
      .order("sort_order")
      .limit(1),
    admin
      .from("profile_photos")
      .select("id,variants,sort_order,moderation_status")
      .eq("profile_id", profile.id)
      .order("sort_order"),
    admin
      .from("discovery_preferences")
      .select("min_age,max_age,interested_genders,same_city_only")
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ]);

  const signedPhotos = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const variants = photo.variants as Record<string, string> | null;
      const path = variants?.["960"] ?? variants?.["480"];
      if (!path) return null;
      const { data } = await admin.storage
        .from("profiles")
        .createSignedUrl(path, 900);
      return data?.signedUrl
        ? { id: photo.id, url: data.signedUrl, status: photo.moderation_status }
        : null;
    }),
  );

  return NextResponse.json({
    profile: {
      name: profile.display_name,
      birthDate: profile.birth_date,
      gender: profile.gender,
      city: profile.city ?? "",
      phone: privateData?.phone ?? "",
      badgeSlugs: (intentions ?? []).flatMap((row) => {
        const badge = row.intent_badges as unknown as { slug: string } | null;
        return badge?.slug ? [badge.slug] : [];
      }),
      prompt:
        (
          answers?.[0]?.icebreaker_prompts as unknown as {
            prompt: string;
          } | null
        )?.prompt ?? "",
      answer: answers?.[0]?.answer ?? "",
      photos: signedPhotos.filter(Boolean),
      completed: profile.onboarding_completed,
      minAge: preferences?.min_age ?? 18,
      maxAge: preferences?.max_age ?? 80,
      interestedGenders: preferences?.interested_genders ?? [
        "kadın",
        "erkek",
        "nonbinary",
        "other",
      ],
      sameCityOnly: preferences?.same_city_only ?? false,
      relationshipGoal: profile.relationship_goal ?? "",
      maritalStatus: profile.marital_status ?? "",
      hasChildren: profile.has_children ?? null,
      childrenPreference: profile.children_preference ?? "",
      district: profile.district ?? "",
      alcoholUse: profile.alcohol_use ?? "",
      smokingUse: profile.smoking_use ?? "",
      petPreference: profile.pet_preference ?? "",
      sportsHabit: profile.sports_habit ?? "",
      heightCm: profile.height_cm ?? null,
      educationLevel: profile.education_level ?? "",
      languages: profile.languages ?? [],
    },
  });
}

function rpcError(message: string) {
  const known: Record<string, string> = {
    birth_date_support_required:
      "Doğum tarihi değişikliği için destek ekibine ulaşmalısın.",
    name_change_cooldown: "İsim 30 günde bir değiştirilebilir.",
    photo_required:
      "Profili tamamlamak için en az bir geçerli fotoğraf gerekli.",
  };
  const key = Object.keys(known).find((item) => message.includes(item));
  return NextResponse.json(
    {
      error: key ? known[key] : "Profil kaydedilemedi. Bilgilerini kontrol et.",
    },
    { status: 400 },
  );
}
