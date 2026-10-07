import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CallSession } from "@/lib/calls";

export async function callContext() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return null;
  const { data: profile } = await admin.from("profiles").select("id,display_name").eq("user_id", user.id).eq("kind", "human").is("deleted_at", null).maybeSingle();
  return profile ? { admin, profileId: profile.id as string, name: (profile.display_name as string) ?? "Bir üye" } : null;
}
export type CallContext = NonNullable<Awaited<ReturnType<typeof callContext>>>;

export const unauthorized = () => NextResponse.json({ error: "Oturum ve profil gerekli." }, { status: 401 });

export async function loadParticipantSession(ctx: CallContext, id: string) {
  const { data } = await ctx.admin.from("call_sessions").select("id,match_id,caller_id,callee_id,kind,status,created_at,answered_at,ended_at").eq("id", id).maybeSingle();
  const session = data as CallSession | null;
  if (!session || (session.caller_id !== ctx.profileId && session.callee_id !== ctx.profileId)) return null;
  return session;
}

// STUN is public. TURN is optional: time-limited credentials follow coturn's "use-auth-secret" scheme.
export function buildIceServers(profileId: string, now = Date.now()) {
  const stun = (process.env.STUN_URLS ?? "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302").split(",").map((url) => url.trim()).filter(Boolean);
  const servers: { urls: string[]; username?: string; credential?: string }[] = [{ urls: stun }];
  const turnUrls = (process.env.TURN_URLS ?? "").split(",").map((url) => url.trim()).filter(Boolean);
  if (turnUrls.length) {
    if (process.env.TURN_SECRET) {
      const username = `${Math.floor(now / 1000) + 3600}:${profileId}`;
      servers.push({ urls: turnUrls, username, credential: createHmac("sha1", process.env.TURN_SECRET).update(username).digest("base64") });
    } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      servers.push({ urls: turnUrls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    }
  }
  return { iceServers: servers, relayAvailable: servers.length > 1 };
}
