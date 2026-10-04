import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export async function processDueAccountDeletions(admin: AdminClient, limit = 5) {
  const { data: requests, error } = await admin.from("account_deletion_requests")
    .select("user_id,profile_id,attempt_count")
    .is("cancelled_at", null).is("completed_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for").limit(Math.max(1, Math.min(limit, 20)));
  if (error) throw error;

  const results: Array<{ userId: string; deleted: boolean }> = [];
  for (const request of requests ?? []) {
    try {
      const [{ data: photos }, { data: mediaMessages }, { data: selfie }] = await Promise.all([
        admin.from("profile_photos").select("storage_path,variants").eq("profile_id", request.profile_id),
        admin.from("messages").select("kind,audio_path").eq("sender_id", request.profile_id).not("audio_path", "is", null),
        admin.from("profile_verification_requests").select("selfie_path").eq("profile_id", request.profile_id),
      ]);
      const photoPaths = new Set<string>();
      for (const photo of photos ?? []) {
        if (photo.storage_path) photoPaths.add(photo.storage_path);
        const variants = photo.variants as Record<string, unknown> | null;
        for (const value of Object.values(variants ?? {})) if (typeof value === "string") photoPaths.add(value);
      }
      const voicePaths = (mediaMessages ?? []).flatMap((message) => message.kind === "audio" && message.audio_path ? [message.audio_path] : []);
      const imagePaths = (mediaMessages ?? []).flatMap((message) => message.kind === "image" && message.audio_path ? [message.audio_path] : []);
      await removeInBatches(admin, "profiles", [...photoPaths]);
      await removeInBatches(admin, "voice-messages", voicePaths);
      await removeInBatches(admin, "chat-images", imagePaths);
      await removeInBatches(admin, "verification-selfies", (selfie ?? []).flatMap((item) => item.selfie_path ? [item.selfie_path] : []));
      const { error: deleteError } = await admin.auth.admin.deleteUser(request.user_id);
      if (deleteError) throw deleteError;
      results.push({ userId: request.user_id, deleted: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "unknown_cleanup_error";
      await admin.from("account_deletion_requests").update({
        attempt_count: request.attempt_count + 1,
        last_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("user_id", request.user_id);
      results.push({ userId: request.user_id, deleted: false });
    }
  }
  return results;
}

async function removeInBatches(admin: AdminClient, bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += 500) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 500));
    if (error) throw error;
  }
}
