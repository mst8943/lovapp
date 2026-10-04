import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const gender = z.enum(["kadın", "erkek", "nonbinary", "other"]);
const relationshipGoal = z.enum([
  "marriage",
  "serious",
  "dating",
  "short_term",
  "friendship",
  "unsure",
]);
const optionalText = z.string().trim().min(1).max(40);
const schema = z
  .object({
    minAge: z.number().int().min(18).max(99),
    maxAge: z.number().int().min(18).max(99),
    verifiedOnly: z.boolean(),
    interestedGenders: z.array(gender).min(1).max(4),
    sameCityOnly: z.boolean(),
    cities: z.array(z.string().trim().min(2).max(80)).max(10),
    relationshipGoals: z.array(relationshipGoal).max(6),
    maxDistanceKm: z.number().int().min(10).max(1500).nullable(),
    maritalStatuses: z
      .array(
        z.enum([
          "never_married",
          "divorced",
          "widowed",
          "separated",
          "married",
        ]),
      )
      .max(5),
    hasChildrenValues: z.array(z.boolean()).max(2),
    childrenPreferences: z
      .array(z.enum(["want", "do_not_want", "open", "unsure"]))
      .max(4),
    alcoholValues: z
      .array(z.enum(["never", "occasionally", "socially", "regularly"]))
      .max(4),
    smokingValues: z
      .array(z.enum(["never", "occasionally", "regularly", "quitting"]))
      .max(4),
    petValues: z
      .array(z.enum(["has_pets", "likes_pets", "no_pets", "allergic"]))
      .max(4),
    sportsValues: z
      .array(z.enum(["never", "sometimes", "regularly", "daily"]))
      .max(4),
    zodiacValues: z
      .array(
        z.enum([
          "aries",
          "taurus",
          "gemini",
          "cancer",
          "leo",
          "virgo",
          "libra",
          "scorpio",
          "sagittarius",
          "capricorn",
          "aquarius",
          "pisces",
        ]),
      )
      .max(12),
    minHeightCm: z.number().int().min(120).max(230).nullable(),
    maxHeightCm: z.number().int().min(120).max(230).nullable(),
    educationValues: z
      .array(
        z.enum([
          "high_school",
          "associate",
          "bachelor",
          "master",
          "doctorate",
          "other",
        ]),
      )
      .max(6),
    languageValues: z.array(optionalText).max(10),
  })
  .refine(
    (value) =>
      value.minAge <= value.maxAge &&
      (value.minHeightCm === null ||
        value.maxHeightCm === null ||
        value.minHeightCm <= value.maxHeightCm),
  );

export async function GET() {
  const session = await createClient();
  if (!session)
    return NextResponse.json(
      { error: "Canlı bağlantı gerekli." },
      { status: 503 },
    );
  const {
    data: { user },
  } = await session.auth.getUser();
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
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile)
    return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const [{ data }, { data: entitlement }] = await Promise.all([
    admin
      .from("discovery_preferences")
      .select(
        "min_age,max_age,verified_only,interested_genders,same_city_only,cities,max_distance_km,relationship_goals,marital_statuses,has_children_values,children_preferences,alcohol_values,smoking_values,pet_values,sports_values,zodiac_values,min_height_cm,max_height_cm,education_values,language_values",
      )
      .eq("profile_id", profile.id)
      .maybeSingle(),
    admin
      .from("user_entitlements")
      .select("noir_until")
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ]);
  const premium = Boolean(
    entitlement?.noir_until && new Date(entitlement.noir_until) > new Date(),
  );
  const advanced = premium
    ? {
        verifiedOnly: Boolean(data?.verified_only),
        maritalStatuses: data?.marital_statuses ?? [],
        hasChildrenValues: data?.has_children_values ?? [],
        childrenPreferences: data?.children_preferences ?? [],
        alcoholValues: data?.alcohol_values ?? [],
        smokingValues: data?.smoking_values ?? [],
        petValues: data?.pet_values ?? [],
        sportsValues: data?.sports_values ?? [],
        zodiacValues: data?.zodiac_values ?? [],
        minHeightCm: data?.min_height_cm ?? null,
        maxHeightCm: data?.max_height_cm ?? null,
        educationValues: data?.education_values ?? [],
        languageValues: data?.language_values ?? [],
      }
    : { ...emptyAdvanced, verifiedOnly: Boolean(data?.verified_only) };
  return NextResponse.json(
    {
      premium,
      preferences: {
        minAge: data?.min_age ?? 18,
        maxAge: data?.max_age ?? 80,
        interestedGenders: data?.interested_genders ?? [
          "kadın",
          "erkek",
          "nonbinary",
          "other",
        ],
        sameCityOnly: Boolean(data?.same_city_only),
        cities: data?.cities ?? [],
        maxDistanceKm: data?.max_distance_km ?? null,
        relationshipGoals: data?.relationship_goals ?? [],
        ...advanced,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Keşfet tercihlerini kontrol et." },
      { status: 400 },
    );
  const session = await createClient();
  if (!session)
    return NextResponse.json(
      { error: "Canlı bağlantı gerekli." },
      { status: 503 },
    );
  const {
    data: { user },
  } = await session.auth.getUser();
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
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "human")
    .maybeSingle();
  if (!profile)
    return NextResponse.json({ error: "Profil gerekli." }, { status: 409 });
  const { data: entitlement } = await admin
    .from("user_entitlements")
    .select("noir_until")
    .eq("profile_id", profile.id)
    .maybeSingle();
  const premium = Boolean(
    entitlement?.noir_until && new Date(entitlement.noir_until) > new Date(),
  );
  const advancedRequested =
    parsed.data.maritalStatuses.length ||
    parsed.data.hasChildrenValues.length ||
    parsed.data.childrenPreferences.length ||
    parsed.data.alcoholValues.length ||
    parsed.data.smokingValues.length ||
    parsed.data.sportsValues.length ||
    parsed.data.zodiacValues.length ||
    parsed.data.minHeightCm !== null ||
    parsed.data.maxHeightCm !== null ||
    parsed.data.educationValues.length ||
    parsed.data.languageValues.length;
  if (!premium && advancedRequested)
    return NextResponse.json(
      { error: "Gelişmiş uyum filtreleri Noir üyeliği gerektiriyor." },
      { status: 403 },
    );
  const row = {
    profile_id: profile.id,
    min_age: parsed.data.minAge,
    max_age: parsed.data.maxAge,
    interested_genders: parsed.data.interestedGenders,
    same_city_only: parsed.data.sameCityOnly,
    cities: [...new Set(parsed.data.cities.map((city) => city.trim()))],
    max_distance_km: parsed.data.maxDistanceKm,
    relationship_goals: parsed.data.relationshipGoals,
    verified_only: parsed.data.verifiedOnly,
    updated_at: new Date().toISOString(),
    ...(premium
      ? {
          marital_statuses: parsed.data.maritalStatuses,
          has_children_values: parsed.data.hasChildrenValues,
          children_preferences: parsed.data.childrenPreferences,
          alcohol_values: parsed.data.alcoholValues,
          smoking_values: parsed.data.smokingValues,
          pet_values: parsed.data.petValues,
          sports_values: parsed.data.sportsValues,
          zodiac_values: parsed.data.zodiacValues,
          min_height_cm: parsed.data.minHeightCm,
          max_height_cm: parsed.data.maxHeightCm,
          education_values: parsed.data.educationValues,
          language_values: [...new Set(parsed.data.languageValues)],
        }
      : {}),
  };
  const { error } = await admin.from("discovery_preferences").upsert(row);
  if (error)
    return NextResponse.json(
      { error: "Tercihler kaydedilemedi." },
      { status: 503 },
    );
  return NextResponse.json({ saved: true });
}

const emptyAdvanced = {
  verifiedOnly: false,
  maritalStatuses: [],
  hasChildrenValues: [],
  childrenPreferences: [],
  alcoholValues: [],
  smokingValues: [],
  petValues: [],
  sportsValues: [],
  zodiacValues: [],
  minHeightCm: null,
  maxHeightCm: null,
  educationValues: [],
  languageValues: [],
};
