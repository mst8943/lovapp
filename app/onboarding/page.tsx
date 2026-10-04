import { redirect } from "next/navigation";
import { OnboardingFlow, type InitialOnboardingProfile } from "@/components/onboarding-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import "./onboarding-light.css";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await createClient();
  if (!session) return <OnboardingFlow demoMode />;

  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  const admin = createAdminClient();
  if (!admin) return <OnboardingFlow />;

  const { data: profile } = await admin.from("profiles")
    .select("id,display_name,birth_date,gender,city,onboarding_completed,relationship_goal,marital_status,has_children,children_preference,district,alcohol_use,smoking_use,pet_preference,sports_habit,height_cm,education_level,languages")
    .eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile && user.app_metadata.approved_member !== true) redirect("/login?error=application_required");
  if (!profile) return <OnboardingFlow />;

  const [{ data: privateData }, { data: intentions }, { data: answers }, { data: photos }, { data: preferences }] = await Promise.all([
    admin.from("private_profile_data").select("phone").eq("profile_id", profile.id).maybeSingle(),
    admin.from("profile_intentions").select("intent_badges(slug)").eq("profile_id", profile.id),
    admin.from("profile_answers").select("answer,icebreaker_prompts(prompt)").eq("profile_id", profile.id).order("sort_order").limit(1),
    admin.from("profile_photos").select("id,variants,moderation_status").eq("profile_id", profile.id).order("sort_order"),
    admin.from("discovery_preferences").select("min_age,max_age,interested_genders,same_city_only").eq("profile_id", profile.id).maybeSingle(),
  ]);
  const signedPhotos = await Promise.all((photos ?? []).map(async (photo) => {
    const variants = photo.variants as Record<string, string> | null;
    const path = variants?.["960"] ?? variants?.["480"];
    if (!path) return null;
    const { data } = await admin.storage.from("profiles").createSignedUrl(path, 900);
    return data?.signedUrl ? { id: photo.id, url: data.signedUrl, status: photo.moderation_status } : null;
  }));
  const answer = answers?.[0];
  const initialProfile: InitialOnboardingProfile = {
    name: profile.display_name,
    birthDate: profile.birth_date,
    gender: profile.gender,
    city: profile.city ?? "",
    phone: privateData?.phone ?? "",
    badgeSlugs: (intentions ?? []).flatMap((row) => {
      const badge = row.intent_badges as unknown as { slug: string } | null;
      return badge?.slug ? [badge.slug] : [];
    }),
    prompt: ((answer?.icebreaker_prompts as unknown as { prompt: string } | null)?.prompt) ?? "",
    answer: answer?.answer ?? "",
    photos: signedPhotos.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)),
    completed: profile.onboarding_completed,
    minAge: preferences?.min_age ?? 18,
    maxAge: preferences?.max_age ?? 80,
    interestedGenders: preferences?.interested_genders ?? ["kadın", "erkek", "nonbinary", "other"],
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
  };
  return <OnboardingFlow initialProfile={initialProfile} />;
}
