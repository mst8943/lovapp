"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Flame,
  Heart,
  LockKeyhole,
  MessageCircle,
  Baby,
  Cigarette,
  Download,
  Dumbbell,
  Globe2,
  GraduationCap,
  Info,
  LoaderCircle,
  Mic,
  MoreVertical,
  PawPrint,
  Play,
  RotateCcw,
  Ruler,
  Search,
  Send,
  Sparkles,
  Square,
  Star,
  Trash2,
  UserRound,
  Users,
  WifiOff,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  FormEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Brand } from "@/components/brand";
import { CampaignBanner } from "@/components/campaign-banner";
import { DailyQuestionCard } from "@/components/daily-question-card";
import { EndorsementBadges } from "@/components/endorsement-badges";
import { readJson } from "@/lib/http-json";
import { SafetyMenu } from "@/components/safety-menu";
import { PremiumNotice } from "@/components/premium-notice";
import { useDialog } from "@/lib/use-dialog";
import "./lovask-app.css";
import "./lovask-app-light.css";
import {
  DiscoveryHeader,
  StoryStrip,
  MeetingView,
  communityRequest,
} from "./community";
import "./community.css";
import { profiles as demoProfiles, type Profile } from "@/lib/demo-data";
import { lifestyleOptions, zodiacOptions } from "@/lib/profile-options";
import { turkishCities } from "@/lib/turkish-cities";
import { resolvePresence } from "@/lib/presence";

type Tab = "swipe" | "discover" | "likes" | "messages" | "profile" | "meetings";
type ChatMessage = {
  id: string;
  from: "me" | "them";
  text?: string;
  audio?: boolean;
  audioUrl?: string;
  imageUrl?: string;
  durationMs?: number;
  waveform?: number[];
  createdAt?: string;
  readAt?: string | null;
  delivery?: "sending" | "sent" | "failed";
  replyToId?: string | null;
  replyText?: string | null;
  deleted?: boolean;
  reactions?: Array<{ emoji: string; profileId: string }>;
};
type DiscoveryPreferences = {
  minAge: number;
  maxAge: number;
  verifiedOnly: boolean;
  interestedGenders: Array<"kadın" | "erkek" | "nonbinary" | "other">;
  sameCityOnly: boolean;
  cities: string[];
  maxDistanceKm: number | null;
  relationshipGoals: string[];
  maritalStatuses: string[];
  hasChildrenValues: boolean[];
  childrenPreferences: string[];
  alcoholValues: string[];
  smokingValues: string[];
  petValues: string[];
  sportsValues: string[];
  zodiacValues: string[];
  minHeightCm: number | null;
  maxHeightCm: number | null;
  educationValues: string[];
  languageValues: string[];
};
type MessageRequest = {
  status: "draft" | "pending";
  incoming: boolean;
  expiresAt?: string;
};
type ConversationSummary = {
  matchId: string;
  profile: Profile;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
  pending: boolean;
  matched: boolean;
  request?: MessageRequest | null;
};
type SuperLikeAllowance = {
  remaining: number;
  limit: number;
  resetsAt: string;
  premium: boolean;
};
const genderChoices = [
  ["kadın", "Kadın"],
  ["erkek", "Erkek"],
  ["nonbinary", "Non-binary"],
  ["other", "Diğer"],
] as const;
const relationshipChoices = [
  ["marriage", "Evlilik"],
  ["serious", "Ciddi ilişki"],
  ["dating", "Flört"],
  ["short_term", "Kısa süreli"],
  ["friendship", "Arkadaşlık"],
  ["unsure", "Kararsız"],
] as const;
const maritalChoices = [
  ["never_married", "Hiç evlenmedi"],
  ["divorced", "Boşanmış"],
  ["widowed", "Eşi vefat etmiş"],
  ["separated", "Ayrı yaşıyor"],
  ["married", "Evli"],
] as const;
const childrenChoices = [
  ["want", "İstiyor"],
  ["do_not_want", "İstemiyor"],
  ["open", "Açık"],
  ["unsure", "Kararsız"],
] as const;
const defaultPreferences: DiscoveryPreferences = {
  minAge: 18,
  maxAge: 80,
  verifiedOnly: false,
  interestedGenders: ["kadın", "erkek", "nonbinary", "other"],
  sameCityOnly: false,
  cities: [],
  maxDistanceKm: null,
  relationshipGoals: [],
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
const LazyProfileView = dynamic(
  () =>
    import("@/components/lovask-profile-view").then(
      (module) => module.LovaskProfileView,
    ),
  {
    loading: () => (
      <div
        className="screen profile-screen profile-loading"
        role="status"
        aria-busy="true"
      >
        <LoaderCircle className="spin" /> Profilin hazırlanıyor…
      </div>
    ),
  },
);
export type ViewerProfile = {
  name: string;
  age: number;
  city: string;
  image: string;
  xp: number;
  level: number;
  matchCount: number;
  likeCount: number;
  unreadLikeCount: number;
  unreadSuperLikeCount: number;
  badges: string[];
  prompt: string;
  answer: string;
  isAdmin: boolean;
  isNoir: boolean;
  discoverable?: boolean;
};

const demoViewer: ViewerProfile = {
  name: "Deniz",
  age: 27,
  city: "İstanbul",
  image: "/profiles/lara.webp",
  xp: 1840,
  level: 5,
  matchCount: 12,
  likeCount: 47,
  unreadLikeCount: 3,
  unreadSuperLikeCount: 1,
  badges: ["Maceracı", "Kahve sever", "Ciddi düşünüyor"],
  prompt: "Birlikte mutlaka denemeliyiz…",
  answer: "Plansız bir sahil kaçamağı.",
  isAdmin: false,
  isNoir: false,
};

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    from: "them",
    text: "Şehir uyurken manzara avına çıkma teklifim hâlâ geçerli ✨",
  },
  { id: "m2", from: "me", text: "Kahve rotası senden olursa neden olmasın?" },
  { id: "m3", from: "them", audio: true },
];

const demoConversationSummaries: ConversationSummary[] = [
  {
    matchId: "demo-defne",
    profile: demoProfiles[0],
    lastMessage: "Sana bir sesli mesaj gönderdi",
    lastMessageAt: "2026-08-10T09:00:00.000Z",
    unreadCount: 1,
    pending: false,
    matched: true,
  },
];

function scheduleIdle(task: () => void, timeout = 2_000) {
  const browserWindow = window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (browserWindow.requestIdleCallback) {
    const id = browserWindow.requestIdleCallback(task, { timeout });
    return () => browserWindow.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, 1);
  return () => window.clearTimeout(id);
}

export function LovaskApp({
  initialTab = "swipe",
  initialProfiles = demoProfiles,
  initialProfilesReady = true,
  initialMatches,
  initialQuestProgress = 0,
  initialChatQuestComplete = false,
  initialSuperLike,
  liveMode = false,
  viewer = demoViewer,
}: {
  initialTab?: Tab;
  initialProfiles?: Profile[];
  initialProfilesReady?: boolean;
  initialMatches?: Profile[];
  initialQuestProgress?: number;
  initialChatQuestComplete?: boolean;
  initialSuperLike?: SuperLikeAllowance;
  liveMode?: boolean;
  viewer?: ViewerProfile;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [activeChat, setActiveChat] = useState<Profile | null>(null);
  const [matched, setMatched] = useState<Profile | null>(null);
  const [newMatchNotice, setNewMatchNotice] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<Profile[]>(
    initialMatches ?? (liveMode ? [] : [demoProfiles[0]]),
  );
  const [conversationSummaries, setConversationSummaries] = useState<
    ConversationSummary[]
  >(() => (liveMode ? [] : demoConversationSummaries));
  const [questProgress, setQuestProgress] = useState(initialQuestProgress);
  const [chatQuestComplete, setChatQuestComplete] = useState(
    initialChatQuestComplete,
  );
  const [viewerState, setViewerState] = useState(viewer);
  const [matchCount, setMatchCount] = useState(
    initialMatches?.length ?? viewer.matchCount,
  );
  const [chatDraft, setChatDraft] = useState("");
  const [online, setOnline] = useState(true);
  const [unreadLikes, setUnreadLikes] = useState(viewer.unreadLikeCount);
  const [unreadSuperLikes, setUnreadSuperLikes] = useState(
    viewer.unreadSuperLikeCount,
  );
  const [inboxLoading, setInboxLoading] = useState(liveMode);
  const [inboxError, setInboxError] = useState("");
  const [showApkNudge, setShowApkNudge] = useState(true);
  const knownMatchIds = useRef<Set<string> | null>(null);
  const conversationsInFlight = useRef(false);
  const conversationsQueued = useRef(false);
  const notificationsInFlight = useRef(false);
  const inboxRealtimeReady = useRef(false);
  const realtimeMatchKey = useMemo(
    () =>
      conversationSummaries
        .map((item) => item.matchId)
        .sort()
        .join(","),
    [conversationSummaries],
  );

  useEffect(() => {
    const image = new window.Image();
    image.src = viewerState.image;
    void image.decode().catch(() => undefined);
  }, [viewerState.image]);

  const markConversationRead = useCallback((profileId: string) => {
    setConversationSummaries((current) =>
      current.map((item) =>
        item.profile.id === profileId ? { ...item, unreadCount: 0 } : item,
      ),
    );
  }, []);

  const loadConversations = useCallback(async () => {
    if (!liveMode) return;
    if (conversationsInFlight.current) {
      conversationsQueued.current = true;
      return;
    }
    do {
      conversationsQueued.current = false;
      conversationsInFlight.current = true;
      setInboxLoading(true);
      try {
        const response = await fetch("/api/conversations", {
          cache: "no-store",
        });
        const data = await readJson(
          response,
          {} as {
            conversations?: ConversationSummary[];
            newMatchIds?: string[];
          },
        );
        if (!response.ok) throw new Error("inbox_unavailable");
        setInboxError("");
        const next = data.conversations ?? [];
        const previousIds = knownMatchIds.current;
        const actualMatches = next.filter((item) => item.matched);
        const detectedNew = previousIds
          ? actualMatches.find((item) => !previousIds.has(item.matchId))
          : null;
        knownMatchIds.current = new Set(
          actualMatches.map((item) => item.matchId),
        );
        setConversationSummaries(next);
        setMatches(actualMatches.map((item) => item.profile));
        setMatchCount(actualMatches.length);
        const newMatch =
          next.find((item) => data.newMatchIds?.includes(item.matchId)) ??
          detectedNew;
        if (newMatch) setNewMatchNotice(newMatch.profile);
      } catch {
        setInboxError(
          "Sohbetlerin yüklenemedi. Bağlantını kontrol edip tekrar dene.",
        );
      } finally {
        conversationsInFlight.current = false;
        setInboxLoading(false);
      }
    } while (conversationsQueued.current);
  }, [liveMode]);

  const loadLikeNotifications = useCallback(async () => {
    if (!liveMode || notificationsInFlight.current) return;
    notificationsInFlight.current = true;
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await readJson(
        response,
        {} as { unreadLikes?: number; unreadSuperLikes?: number },
      );
      setUnreadLikes(data.unreadLikes ?? 0);
      setUnreadSuperLikes(data.unreadSuperLikes ?? 0);
    } catch {
      // Keep the last known badge counts while offline.
    } finally {
      notificationsInFlight.current = false;
    }
  }, [liveMode]);

  useEffect(() => {
    if (!liveMode) return;
    const params = new URLSearchParams(window.location.search);
    if (initialTab === "messages" || params.has("open")) {
      return scheduleIdle(() => {
        void loadConversations();
      }, 0);
    }
    return scheduleIdle(() => {
      void loadConversations();
    });
  }, [initialTab, liveMode, loadConversations]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    const pop = () => {
      const params = new URLSearchParams(window.location.search);
      if (["chat", "match"].includes(params.get("open") ?? "")) {
        const target =
          conversationSummaries.find(
            (item) =>
              item.matchId === params.get("match") ||
              item.profile.id === params.get("profile"),
          )?.profile ??
          (!liveMode
            ? demoProfiles.find((item) => item.id === params.get("profile"))
            : undefined);
        if (params.get("open") === "match" && target) {
          setMatched(target);
          window.history.replaceState(null, "", "?tab=messages");
        } else if (target) setActiveChat(target);
        setTab("messages");
        return;
      }
      setActiveChat(null);
      const requested = params.get("tab");
      setTab(
        params.get("open") === "messages"
          ? "messages"
          : [
                "swipe",
                "discover",
                "likes",
                "messages",
                "profile",
                "meetings",
              ].includes(requested ?? "")
            ? (requested as Tab)
            : initialTab,
      );
    };
    pop();
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [conversationSummaries, initialTab, liveMode]);

  useEffect(() => {
    if (!liveMode || !realtimeMatchKey) return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (disposed) return;
      const supabase = createClient();
      if (!supabase) return;
      let channel = supabase.channel(`lovask-inbox:${realtimeMatchKey}`);
      for (const matchId of realtimeMatchKey.split(",")) {
        channel = channel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `match_id=eq.${matchId}`,
            },
            () => {
              void loadConversations();
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "messages",
              filter: `match_id=eq.${matchId}`,
            },
            () => {
              void loadConversations();
            },
          );
      }
      channel.subscribe((status) => {
        inboxRealtimeReady.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") void loadConversations();
      });
      disconnect = () => {
        inboxRealtimeReady.current = false;
        void supabase.removeChannel(channel);
      };
      if (disposed) disconnect();
    });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [liveMode, loadConversations, realtimeMatchKey]);

  useEffect(() => {
    if (!liveMode) return;
    const refreshVisibleInbox = (force = false) => {
      if (document.visibilityState !== "visible") return;
      void Promise.all([
        force || tab === "messages" || !inboxRealtimeReady.current
          ? loadConversations()
          : Promise.resolve(),
        loadLikeNotifications(),
      ]);
    };
    const refreshOnFocus = () => refreshVisibleInbox(true);
    const timer = window.setInterval(
      () => refreshVisibleInbox(),
      tab === "messages" ? 5_000 : 60_000,
    );
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [liveMode, loadConversations, loadLikeNotifications, tab]);

  // New matches are not in realtimeMatchKey yet; RLS limits these rows to the viewer.
  useEffect(() => {
    if (!liveMode) return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (disposed) return;
      const supabase = createClient();
      if (!supabase) return;
      const refresh = () => {
        void loadConversations();
        void loadLikeNotifications();
      };
      const channel = supabase
        .channel("lovask-matches")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, refresh)
        .subscribe();
      disconnect = () => void supabase.removeChannel(channel);
      if (disposed) disconnect();
    });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [liveMode, loadConversations, loadLikeNotifications]);

  useEffect(() => {
    if (!liveMode) return;
    const touch = () => {
      if (document.visibilityState === "visible")
        void fetch("/api/presence", { method: "POST" }).catch(() => undefined);
    };
    touch();
    document.addEventListener("visibilitychange", touch);
    const timer = window.setInterval(touch, 3 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", touch);
      window.clearInterval(timer);
    };
  }, [liveMode]);

  const openChat = (profile: Profile, draft = "") => {
    setChatDraft(draft);
    if (!liveMode) markConversationRead(profile.id);
    setActiveChat(profile);
    setTab("messages");
    const summary = conversationSummaries.find(
      (item) => item.profile.id === profile.id,
    );
    const params = new URLSearchParams({
      tab: "messages",
      open: "chat",
      profile: profile.id,
    });
    if (summary?.matchId) params.set("match", summary.matchId);
    window.history.pushState({ lovaskChat: true }, "", `?${params.toString()}`);
    if (liveMode) void loadConversations();
  };

  const changeTab = (next: Tab) => {
    if (next === tab && !activeChat) return;
    setActiveChat(null);
    setTab(next);
    if (next === "messages" && liveMode) void loadConversations();
    if (next === "likes" && (unreadLikes > 0 || unreadSuperLikes > 0)) {
      setUnreadLikes(0);
      setUnreadSuperLikes(0);
      if (liveMode)
        void fetch("/api/notifications", { method: "PATCH" })
          .then((response) => {
            if (!response.ok) void loadLikeNotifications();
          })
          .catch(() => {
            void loadLikeNotifications();
          });
    }
    const params = new URLSearchParams();
    params.set("tab", next);
    window.history.pushState(null, "", `?${params.toString()}`);
  };
  const unreadTotal = conversationSummaries.reduce(
    (sum, item) => sum + item.unreadCount,
    0,
  );

  useEffect(() => {
    if (!newMatchNotice) return;
    const timer = window.setTimeout(() => setNewMatchNotice(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [newMatchNotice]);

  const handleDeleteConversation = async (matchId: string) => {
    if (liveMode) {
      const res = await fetch(
        `/api/conversations?matchId=${encodeURIComponent(matchId)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Sohbet kaldırılamadı.");
      }
    }
    setConversationSummaries((prev) =>
      prev.filter((item) => item.matchId !== matchId),
    );
    setMatches((prev) =>
      prev.filter((p) => {
        const summary = conversationSummaries.find(
          (s) => s.matchId === matchId,
        );
        return !summary || summary.profile.id !== p.id;
      }),
    );
  };

  return (
    <main className="app-stage">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="app-shell">
        <DesktopSidebar
          active={tab}
          viewer={viewerState}
          unreadMessages={unreadTotal}
          unreadLikes={unreadLikes}
          onChange={changeTab}
        />
        <header className="desktop-topbar">
          <span>Kişisel alanın</span>
          <i>›</i>
          <strong>
            {tab === "swipe"
              ? "Keşfet"
              : tab === "discover"
                ? "Profil listesi"
                : tab === "likes"
                  ? "Seni beğenenler"
                  : tab === "messages"
                    ? "Mesajlar"
                    : tab === "meetings"
                      ? "Buluşma"
                      : "Profilim"}
          </strong>
          <Link href="/noir" className="desktop-membership">
            <span>{viewerState.isNoir ? "Noir üye" : "Standart"}</span>
            <Crown size={14} /> Noir
          </Link>
          <button
            type="button"
            className="desktop-avatar"
            onClick={() => changeTab("profile")}
            aria-label="Profilimi aç"
          >
            {viewerState.name.slice(0, 1).toLocaleUpperCase("tr-TR")}
          </button>
        </header>
        <AnimatePresence mode="wait">
          {tab === "swipe" ? (
            <DiscoverView
              key="discover"
              profiles={initialProfiles}
              liveMode={liveMode}
              initialSuperLike={initialSuperLike}
              questProgress={questProgress}
              chatQuestComplete={chatQuestComplete}
              viewer={viewerState}
              onExplore={() => changeTab("discover")}
              onBoost={() => changeTab("profile")}
              onOpenChat={openChat}
              onQuestProgress={(progress, xpAwarded) => {
                setQuestProgress(progress);
                if (xpAwarded)
                  setViewerState((current) => ({
                    ...current,
                    xp: current.xp + xpAwarded,
                    level: Math.max(
                      1,
                      Math.floor(Math.sqrt((current.xp + xpAwarded) / 100)) + 1,
                    ),
                  }));
              }}
              onMatch={(profile) => {
                setMatched(profile);
                setMatches((current) =>
                  current.some((item) => item.id === profile.id)
                    ? current
                    : [profile, ...current],
                );
              }}
            />
          ) : null}
          {tab === "discover" ? (
            <ExploreView
              key="explore"
              profiles={initialProfiles}
              initialProfilesReady={initialProfilesReady}
              liveMode={liveMode}
              viewer={viewerState}
              onSwipe={() => changeTab("swipe")}
              onOpenChat={openChat}
              onMatched={(profile) => {
                setMatched(profile);
                setMatches((current) =>
                  current.some((item) => item.id === profile.id)
                    ? current
                    : [profile, ...current],
                );
              }}
            />
          ) : null}
          {tab === "likes" ? (
            <ExploreView
              key="likes"
              profiles={initialProfiles}
              initialProfilesReady={initialProfilesReady}
              liveMode={liveMode}
              viewer={viewerState}
              likesOnly
              onOpenChat={openChat}
              onMatched={(profile) => {
                setMatched(profile);
                setMatches((current) =>
                  current.some((item) => item.id === profile.id)
                    ? current
                    : [profile, ...current],
                );
              }}
            />
          ) : null}
          {tab === "messages" ? (
            activeChat ? (
              <ChatView
                key={activeChat.id}
                profile={activeChat}
                matched={
                  conversationSummaries.find(
                    (item) => item.profile.id === activeChat.id,
                  )?.matched ?? false
                }
                liveMode={liveMode}
                initialDraft={chatDraft}
                onRead={markConversationRead}
                onQuestCompleted={(xpAwarded) => {
                  setChatQuestComplete(true);
                  if (xpAwarded)
                    setViewerState((current) => ({
                      ...current,
                      xp: current.xp + xpAwarded,
                      level: Math.max(
                        1,
                        Math.floor(Math.sqrt((current.xp + xpAwarded) / 100)) +
                          1,
                      ),
                    }));
                }}
                onBack={() => {
                  setActiveChat(null);
                  setTab("messages");
                  window.history.replaceState(null, "", "?tab=messages");
                  if (liveMode) void loadConversations();
                }}
              />
            ) : (
              <MessagesView
                key="messages"
                matches={matches}
                summaries={conversationSummaries}
                loading={inboxLoading}
                error={inboxError}
                onRetry={() => void loadConversations()}
                liveMode={liveMode}
                likeCount={viewerState.likeCount}
                premium={viewerState.isNoir}
                onLikes={() => changeTab("likes")}
                onDiscover={() => changeTab("swipe")}
                onOpen={openChat}
                onDeleteConversation={handleDeleteConversation}
              />
            )
          ) : null}
          {tab === "meetings" ? (
            <MeetingPanel
              key="meetings"
              onOpenChat={openChat}
              onMatched={setMatched}
            />
          ) : null}
          {tab === "profile" ? (
            <LazyProfileView
              key="profile"
              liveMode={liveMode}
              viewer={{ ...viewerState, matchCount }}
            />
          ) : null}
        </AnimatePresence>
        {!online ? (
          <div className="offline-strip" role="status">
            <WifiOff size={14} /> Bağlantı yok · Yeniden bağlandığında
            güncellenecek
          </div>
        ) : null}
        <AnimatePresence>
          {newMatchNotice ? (
            <motion.div
              className="new-match-toast"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 80) setNewMatchNotice(null);
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMatched(newMatchNotice);
                  setNewMatchNotice(null);
                }}
              >
                <Heart size={17} fill="currentColor" />
                <span>
                  <strong>Yeni bir eşleşmen var</strong>
                  <small>{newMatchNotice.name} ile eşleştin</small>
                </span>
              </button>
              <button
                type="button"
                aria-label="Eşleşme bildirimini kapat"
                onClick={() => setNewMatchNotice(null)}
              >
                <X size={16} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {activeChat === null && showApkNudge ? (
          <div className="apk-nudge" role="status">
            <Download size={18} />
            <a href="/api/download/android?utm_source=web-app">
              <strong>Daha rahat deneyim için Android uygulamasını indir</strong>
              <small>Tam ekran keşif ve anlık bildirimlerle devam et</small>
            </a>
            <button
              type="button"
              aria-label="Uygulama bildirimini kapat"
              onClick={() => setShowApkNudge(false)}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        {activeChat === null ? (
          <BottomNav
            active={tab}
            unreadMessages={unreadTotal}
            unreadLikes={unreadLikes}
            unreadSuperLikes={unreadSuperLikes}
            onChange={changeTab}
          />
        ) : null}
      </section>
      <AnimatePresence>
        {matched ? (
          <MatchMoment
            profile={matched}
            viewerImage={viewerState.image}
            onClose={() => setMatched(null)}
            onMessage={(draft) => {
              openChat(matched, draft);
              setMatched(null);
            }}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function Screen({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={`screen ${className}`}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      {children}
    </motion.div>
  );
}

function DesktopSidebar({
  active,
  viewer,
  unreadMessages,
  unreadLikes,
  onChange,
}: {
  active: Tab;
  viewer: ViewerProfile;
  unreadMessages: number;
  unreadLikes: number;
  onChange: (tab: Tab) => void;
}) {
  const items: Array<[Tab, string, React.ReactNode, number]> = [
    ["swipe", "Keşfet", <Flame size={19} key="swipe" />, 0],
    ["likes", "Seni beğenenler", <Heart size={19} key="likes" />, unreadLikes],
    ["meetings", "Buluşma", <Brand compact key="meetings" />, 0],
    [
      "messages",
      "Mesajlar",
      <MessageCircle size={19} key="messages" />,
      unreadMessages,
    ],
    ["profile", "Profilim", <UserRound size={19} key="profile" />, 0],
  ];
  return (
    <aside className="desktop-sidebar">
      <button
        type="button"
        className="sidebar-brand"
        onClick={() => onChange("swipe")}
        aria-label="Ana ekran"
      >
        <Brand />
      </button>
      <small className="sidebar-label">SANA ÖZEL</small>
      <nav aria-label="Ana menü">
        {items.map(([tab, label, icon, badge]) => (
          <button
            type="button"
            key={tab}
            className={
              active === tab || (tab === "swipe" && active === "discover")
                ? "sidebar-nav-button active"
                : "sidebar-nav-button"
            }
            onClick={() => onChange(tab)}
          >
            {icon}
            <span>{label}</span>
            {badge ? <b>{badge > 99 ? "99+" : badge}</b> : null}
          </button>
        ))}
      </nav>
      {!viewer.isNoir ? (
        <Link className="sidebar-noir" href="/noir">
          <Crown size={22} />
          <strong>Biraz daha fazlası.</strong>
          <span>
            Beğenenleri ve ziyaretçilerini gör; haftada bir 30 dakika Boost
            kullan.
          </span>
          <b>Noir’i keşfet →</b>
        </Link>
      ) : null}
      <button
        type="button"
        className="sidebar-user"
        onClick={() => onChange("profile")}
      >
        <span>{viewer.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
        <strong>
          {viewer.name}
          <small>
            Seviye {viewer.level} · {viewer.xp} XP
          </small>
        </strong>
        <i>›</i>
      </button>
    </aside>
  );
}

function ExploreView({
  profiles,
  liveMode,
  viewer,
  likesOnly = false,
  onSwipe,
  onOpenChat,
  onMatched,
}: {
  profiles: Profile[];
  initialProfilesReady: boolean;
  liveMode: boolean;
  viewer: ViewerProfile;
  likesOnly?: boolean;
  onSwipe?: () => void;
  onOpenChat: (profile: Profile) => void;
  onMatched: (profile: Profile) => void;
}) {
  const [candidates, setCandidates] = useState<Profile[]>(
    liveMode ? [] : profiles,
  );
  const [processing, setProcessing] = useState(liveMode);
  const inFlight = useRef(liveMode);
  const [likedProfiles, setLikedProfiles] = useState<Profile[]>(() =>
    liveMode ? [] : profiles.filter((profile) => profile.likedYou),
  );
  const [likeCount, setLikeCount] = useState(viewer.likeCount);
  const [premium, setPremium] = useState(viewer.isNoir);
  const [subTab, setSubTab] = useState<"likes" | "visitors">("likes");
  const [visitorProfiles, setVisitorProfiles] = useState<Profile[]>([]);
  const [visitorCount, setVisitorCount] = useState(0);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferences, setPreferences] =
    useState<DiscoveryPreferences>(defaultPreferences);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!liveMode) return;
    let cancelled = false;
    const urls = likesOnly
      ? [
          "/api/discovery",
          "/api/discovery/likes",
          "/api/discovery/preferences",
          "/api/profile/visitors",
        ]
      : [
          "/api/discovery",
          "/api/discovery/likes",
          "/api/discovery/preferences",
        ];
    void Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return null;
        return response.json();
      }),
    )
      .then(([deck, likes, preferenceData, visitorsData]) => {
        if (cancelled) return;
        if (deck && preferenceData) {
          setCandidates(
            filterProfiles(
              deck.profiles ?? [],
              preferenceData.preferences,
              new Set(),
              viewer.city,
            ),
          );
          setPreferences(preferenceData.preferences);
        }
        if (likes) {
          setLikeCount(likes.count ?? 0);
          setPremium(Boolean(likes.premium));
          setLikedProfiles(likes.profiles ?? []);
        }
        if (visitorsData) {
          setVisitorCount(
            visitorsData.count ?? visitorsData.visitors?.length ?? 0,
          );
          if (visitorsData.premium) setPremium(true);
          if (Array.isArray(visitorsData.visitors)) {
            setVisitorProfiles(
              visitorsData.visitors.map(
                (
                  v: Pick<
                    Profile,
                    "id" | "name" | "age" | "image" | "city" | "verified"
                  >,
                ) => ({
                  id: v.id,
                  name: v.name,
                  age: v.age,
                  image: v.image ?? "/icon.svg",
                  city: v.city ?? "Türkiye",
                  distance: v.city ?? "Türkiye",
                  verified: v.verified,
                  badges: [],
                  prompt: "Profilini ziyaret etti",
                  answer: "",
                }),
              ),
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            "Profiller yüklenemedi. Bağlantını kontrol edip tekrar dene.",
          );
      })
      .finally(() => {
        if (!cancelled) {
          inFlight.current = false;
          setProcessing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [liveMode, viewer.city, likesOnly]);
  const applyPreferences = async (next: DiscoveryPreferences) => {
    if (inFlight.current) return;
    if (!liveMode) {
      setPreferences(next);
      setPreferencesOpen(false);
      setCandidates(filterProfiles(profiles, next, new Set(), viewer.city));
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    try {
      const response = await fetch("/api/discovery/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const body = await readJson(response, {} as { error?: string });
        setNotice(body.error ?? "Filtreler kaydedilemedi.");
        return;
      }
      setPreferences(next);
      setPreferencesOpen(false);
      setCandidates((current) =>
        filterProfiles(current, next, new Set(), viewer.city),
      );
      const deckResponse = await fetch("/api/discovery", { cache: "no-store" });
      if (!deckResponse.ok) throw new Error("discovery_unavailable");
      const deck = await deckResponse.json();
      setCandidates(
        filterProfiles(deck.profiles, next, new Set(), viewer.city),
      );
    } catch {
      setNotice("Filtreler uygulanamadı. Bağlantını kontrol edip tekrar dene.");
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };
  const startMessage = async (profile: Profile) => {
    if (inFlight.current) return;
    if (!liveMode) {
      setSelected(null);
      onOpenChat(profile);
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfileId: profile.id }),
      });
      const body = await readJson(response, {} as { error?: string });
      if (!response.ok) {
        setNotice(body.error ?? "Sohbet başlatılamadı.");
        return;
      }
      setCandidates((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      setLikedProfiles((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      setSelected(null);
      onOpenChat(profile);
    } catch {
      setNotice("Sohbet başlatılamadı. Bağlantını kontrol edip tekrar dene.");
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };
  const decide = async (
    profile: Profile,
    direction: "left" | "right" | "super",
    openAfterMatch = false,
  ) => {
    if (inFlight.current) return;
    if (!liveMode) {
      setCandidates((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      setSelected(null);
      if (openAfterMatch) onOpenChat(profile);
      else if (direction !== "left") onMatched(profile);
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfileId: profile.id, direction }),
      });
      const body = await readJson(
        response,
        {} as { matched?: boolean; error?: string },
      );
      if (!response.ok)
        return setNotice(body.error ?? "Kararın kaydedilemedi.");
      setCandidates((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      setLikedProfiles((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      setSelected(null);
      if (body.matched) {
        if (openAfterMatch) onOpenChat(profile);
        else onMatched(profile);
      } else if (openAfterMatch)
        setNotice(
          "Beğenin gönderildi. Mesajlaşmak için karşılıklı eşleşmeniz gerekiyor.",
        );
    } catch {
      setNotice("Kararın kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };
  return (
    <Screen className={`explore-screen${likesOnly ? " likes-screen" : ""}`}>
      {likesOnly ? (
        <header className="section-header">
          <h1>Sana gelen izler</h1>
        </header>
      ) : (
        <>
          <DiscoveryHeader
            list
            onSwitch={onSwipe}
            onFilter={() => setPreferencesOpen(true)}
          />
          <StoryStrip live={liveMode} />
          {liveMode ? <CampaignBanner /> : null}
        </>
      )}
      {likesOnly ? (
        <div className="likes-tabs" role="tablist">
          <button
            className={subTab === "likes" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={subTab === "likes"}
            onClick={() => setSubTab("likes")}
          >
            Beğeniler ({likeCount})
          </button>
          <button
            className={subTab === "visitors" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={subTab === "visitors"}
            onClick={() => setSubTab("visitors")}
          >
            Ziyaretçiler ({visitorCount})
          </button>
        </div>
      ) : null}

      {likesOnly ? (
        <AnimatePresence mode="wait">
          {subTab === "likes" ? (
            <motion.div
              key="likes-tab-content"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.2 }}
            >
              <ExploreSection
                title="Seni beğenenler"
                subtitle={
                  premium && likeCount
                    ? `${likeCount} kişi seni merak ediyor`
                    : premium
                      ? "Yeni bir beğeni geldiğinde burada görünür"
                      : likeCount
                        ? `${likeCount} kişi seni beğendi · profilleri Noir ile gör`
                        : "Noir üyelerine özel"
                }
                profiles={premium ? likedProfiles : []}
                locked={!premium}
                lockedTitle="İlk izler burada buluşacak."
                lockedSubtitle="Seni merak eden biri var mı? Beğenilerini Noir ile gör, ilk adımı sen at."
                benefits={[
                  "Seni beğenenleri gör",
                  "Sınırsız beğeni gönder",
                  "Gelişmiş filtreler",
                  "Haftada 1 kez 30 dakika Boost",
                  "Özel rozet ve ayrıcalıklar",
                ]}
                emptyMessage="Henüz seni beğenen bir profil yok."
                onSelect={setSelected}
              />
            </motion.div>
          ) : (
            <motion.div
              key="visitors-tab-content"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.2 }}
            >
              <ExploreSection
                title="Seni merak edenler"
                subtitle={
                  premium && visitorCount
                    ? `${visitorCount} kişi profilini ziyaret etti`
                    : premium
                      ? "Profilini ziyaret edenler burada görünür"
                      : visitorCount
                        ? `${visitorCount} kişi profilini ziyaret etti · Noir ile gör`
                        : "Noir üyelerine özel"
                }
                profiles={premium ? visitorProfiles : []}
                locked={!premium}
                lockedTitle="Ziyaretçilerin burada seni bekliyor"
                lockedSubtitle="Seni ziyaret edenleri Noir ile gör, ilk adımı sen at."
                benefits={[
                  "Profilini ziyaret edenleri gör",
                  "Ziyaret zamanlarını incele",
                  "Öncelikli eşleşme avantajı",
                ]}
                emptyMessage="Henüz profilini ziyaret eden bir kullanıcı yok."
                onSelect={setSelected}
              />
            </motion.div>
          )}
        </AnimatePresence>
      ) : null}

      {processing ? (
        <p role="status">Profiller güncelleniyor…</p>
      ) : !likesOnly && !candidates.length ? (
        <p role="status">Tercihlerine uygun yeni profil bulunamadı.</p>
      ) : null}
      {!likesOnly ? (
        <ExploreSection
          title=""
          subtitle=""
          profiles={candidates}
          onSelect={setSelected}
        />
      ) : null}
      <AnimatePresence>
        {notice ? (
          <PremiumNotice message={notice} onClose={() => setNotice("")} />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {selected ? (
          <ProfileDetail
            profile={selected}
            onClose={() => setSelected(null)}
            onDecision={(direction) => void decide(selected, direction)}
            onMessage={() => void startMessage(selected)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {preferencesOpen ? (
          <PreferencesSheet
            initial={preferences}
            premium={viewer.isNoir}
            onClose={() => setPreferencesOpen(false)}
            onApply={(next) => void applyPreferences(next)}
          />
        ) : null}
      </AnimatePresence>
    </Screen>
  );
}

function ExploreSection({
  title,
  subtitle,
  profiles,
  locked = false,
  lockedTitle = "Beğenilerin burada seni bekliyor",
  lockedSubtitle = "Noir ile profilleri gör",
  benefits = [
    "Seni beğenenleri gör",
    "Sınırsız beğeni gönder",
    "Gelişmiş filtreler",
    "Haftada 1 kez 30 dakika Boost",
  ],
  emptyMessage,
  onSelect,
}: {
  title: string;
  subtitle: string;
  profiles: Profile[];
  locked?: boolean;
  lockedTitle?: string;
  lockedSubtitle?: string;
  benefits?: string[];
  emptyMessage?: string;
  onSelect: (profile: Profile) => void;
}) {
  if (!profiles.length && !locked) {
    return (
      <section className="explore-section">
        {title ? (
          <header>
            <div>
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
          </header>
        ) : null}
        <p className="explore-empty" role="status">
          {emptyMessage || "Henüz görüntülenecek profil bulunmuyor."}
        </p>
      </section>
    );
  }
  return (
    <section className="explore-section">
      {title ? (
        <header>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {locked ? <LockKeyhole size={17} /> : null}
        </header>
      ) : null}
      {locked ? (
        <>
          <Link className="likes-lock" href="/noir">
            <span className="blurred-faces">
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>{lockedTitle}</strong>
              <small>{lockedSubtitle}</small>
              <span className="likes-lock-cta">Noir ile kilitleri aç</span>
            </div>
            <Crown size={17} />
          </Link>
          <div className="likes-benefits">
            <strong>Noir ile neler kazanırsın?</strong>
            {benefits.map((b, idx) => (
              <span key={idx}>✓ {b}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="profile-grid">
          {profiles.map((profile) => {
            const presence = resolvePresence({
              id: profile.id,
              isOnline: profile.isOnline,
              lastSeenAt: profile.lastSeenAt,
            });
            return (
              <button
                type="button"
                key={profile.id}
                onClick={() => onSelect(profile)}
              >
                <span>
                  <Image
                    src={profile.image}
                    alt={`${profile.name}, ${profile.age}`}
                    fill
                    sizes="(max-width:480px) 44vw, 210px"
                    unoptimized={profile.image.startsWith("http")}
                  />
                  <i />
                </span>
                <strong>
                  {profile.name}, {profile.age}
                  {profile.verified ? <BadgeCheck size={14} /> : null}
                </strong>
                <small>
                  {profile.superLikedYou
                    ? "Sana Süper Beğeni gönderdi"
                    : profile.distance}
                </small>
                <div
                  className={`grid-presence-row ${presence.isOnline ? "online" : "offline"}`}
                >
                  <span
                    className={`presence-dot ${presence.isOnline ? "online" : "offline"}`}
                  />
                  <small>{presence.text}</small>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

type DailyPick = { profileId: string; reason: string; day: string; viewerId: string };

function dailyPickStorageKey(pick: DailyPick) {
  return `lovask-daily-pick:${pick.viewerId}:${pick.day}`;
}

function visibleDailyPick(pick: DailyPick | null | undefined) {
  if (!pick) return null;
  try { return localStorage.getItem(dailyPickStorageKey(pick)) ? null : pick; }
  catch { return pick; }
}

function DiscoverView({
  profiles,
  liveMode,
  initialSuperLike,
  questProgress,
  chatQuestComplete,
  viewer,
  onQuestProgress,
  onMatch,
  onExplore,
  onBoost,
  onOpenChat,
}: {
  profiles: Profile[];
  liveMode: boolean;
  initialSuperLike?: SuperLikeAllowance;
  questProgress: number;
  chatQuestComplete: boolean;
  viewer: ViewerProfile;
  onQuestProgress: (progress: number, xpAwarded?: number) => void;
  onMatch: (profile: Profile) => void;
  onExplore: () => void;
  onBoost: () => void;
  onOpenChat: (profile: Profile) => void;
}) {
  const [allProfiles, setAllProfiles] = useState(profiles);
  const [deckProfiles, setDeckProfiles] = useState<Profile[]>(
    liveMode ? [] : profiles,
  );
  const [decidedIds, setDecidedIds] = useState<Set<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const [processing, setProcessing] = useState(liveMode);
  const inFlight = useRef(liveMode);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [detailProfile, setDetailProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] =
    useState<DiscoveryPreferences>(defaultPreferences);
  const [superLike, setSuperLike] = useState<SuperLikeAllowance>(
    initialSuperLike ?? {
      remaining: 1,
      limit: 1,
      resetsAt: "",
      premium: viewer.isNoir,
    },
  );
  const [superInfoOpen, setSuperInfoOpen] = useState(false);
  const [superNoteOpen, setSuperNoteOpen] = useState(false);
  const [superNote, setSuperNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null);
  const profile = deckProfiles[index];
  useEffect(() => {
    if (!liveMode) return;
    let cancelled = false;
    void Promise.all([
      fetch("/api/discovery/preferences", { cache: "no-store" }),
      fetch("/api/discovery", { cache: "no-store" }),
    ])
      .then(async ([preferenceResponse, deckResponse]) => {
        if (!preferenceResponse.ok || !deckResponse.ok)
          throw new Error("discovery_unavailable");
        const [preferenceData, deckData] = await Promise.all([
          preferenceResponse.json(),
          deckResponse.json(),
        ]);
        if (cancelled) return;
        setPreferences(preferenceData.preferences);
        setAllProfiles(deckData.profiles);
        setDailyPick(visibleDailyPick(deckData.dailyPick));
        setDeckProfiles(
          filterProfiles(
            deckData.profiles,
            preferenceData.preferences,
            new Set(),
            viewer.city,
          ),
        );
        setIndex(0);
        if (deckData.superLike) setSuperLike(deckData.superLike);
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            "Keşfet kartları yüklenemedi. Desteyi yenileyerek tekrar dene.",
          );
      })
      .finally(() => {
        if (!cancelled) {
          inFlight.current = false;
          setProcessing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [liveMode, viewer.city]);
  const openProfile = (selected: Profile) => {
    setDetailProfile(selected);
    if (!liveMode) return;
    void fetch("/api/profile/visitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: selected.id }),
      keepalive: true,
    });
  };
  const showNotice = (message: string) => {
    setNotice(message);
  };
  const startMessage = async () => {
    if (!profile || inFlight.current) return;
    if (!liveMode) {
      setDetailProfile(null);
      onOpenChat(profile);
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfileId: profile.id }),
      });
      const result = await readJson(response, {} as { error?: string });
      if (!response.ok) {
        showNotice(result.error ?? "Sohbet başlatılamadı.");
        return;
      }
      setDetailProfile(null);
      setDecidedIds((current) => new Set(current).add(profile.id));
      setAllProfiles((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      setDeckProfiles((current) =>
        current.filter((item) => item.id !== profile.id),
      );
      onOpenChat(profile);
    } catch {
      showNotice("Bağlantı kurulamadı. Yeniden deneyebilirsin.");
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };
  const decide = async (
    direction: "left" | "right" | "super",
    openAfterMatch = false,
    note?: string,
  ) => {
    if (!profile || inFlight.current) return;
    if (direction === "super" && superLike.remaining < 1) {
      setSuperInfoOpen(true);
      return;
    }
    if (!liveMode) {
      startTransition(() => {
        if (direction === "super")
          setSuperLike((current) => ({
            ...current,
            remaining: Math.max(0, current.remaining - 1),
          }));
        if (direction !== "left" && profile.isBot) {
          if (openAfterMatch) onOpenChat(profile);
          else onMatch(profile);
        } else if (openAfterMatch) onOpenChat(profile);
        onQuestProgress(Math.min(questProgress + 1, 3));
        setDecidedIds((current) => new Set(current).add(profile.id));
        setIndex((value) => value + 1);
      });
      return;
    }
    const decidedProfile = profile;
    inFlight.current = true;
    setProcessing(true);
    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetProfileId: decidedProfile.id,
          direction,
          ...(note?.trim() ? { note: note.trim() } : {}),
        }),
      });
      const result = await readJson(
        response,
        {} as {
          matched?: boolean;
          questProgress?: number;
          xpAwarded?: number;
          error?: string;
          code?: string;
          superLike?: typeof superLike;
        },
      );
      if (!response.ok) {
        if (response.status === 410 || result.code === "already_swiped") {
          setDecidedIds((current) => new Set(current).add(decidedProfile.id));
          setIndex((current) => current + 1);
        }
        showNotice(result.error ?? "Kararın kaydedilemedi.");
        return;
      }
      setDecidedIds((current) => new Set(current).add(decidedProfile.id));
      if (dailyPick?.profileId === decidedProfile.id) {
        try { localStorage.setItem(dailyPickStorageKey(dailyPick), decidedProfile.id); } catch {}
        setDailyPick(null);
      }
      setIndex((current) => current + 1);
      if (typeof result.questProgress === "number")
        onQuestProgress(result.questProgress, result.xpAwarded);
      if (result.xpAwarded)
        showNotice(`Ritüel tamamlandı · +${result.xpAwarded} XP`);
      if (result.matched) {
        if (openAfterMatch) onOpenChat(decidedProfile);
        else onMatch(decidedProfile);
      } else if (openAfterMatch)
        showNotice(
          "Beğenin gönderildi. Mesajlaşmak için karşılıklı eşleşmeniz gerekiyor.",
        );
      if (result.superLike) setSuperLike(result.superLike);
    } catch {
      showNotice("Bağlantı kurulamadı. Kartı yeniden deneyebilirsin.");
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };
  const rewind = async () => {
    if (inFlight.current) return;
    if (liveMode) {
      inFlight.current = true;
      setProcessing(true);
      try {
        const response = await fetch("/api/discovery", { method: "DELETE" });
        const body = await readJson(response, {} as { error?: string });
        if (!response.ok)
          throw new Error(body.error ?? "Son karar geri alınamadı.");
        await loadDeck(preferences);
        showNotice("Son kararın geri alındı.");
      } catch (error) {
        showNotice(
          error instanceof Error ? error.message : "Son karar geri alınamadı.",
        );
      } finally {
        inFlight.current = false;
        setProcessing(false);
      }
      return;
    }
    if (index === 0) return showNotice("Henüz geri alınacak bir profil yok.");
    setIndex((value) => Math.max(0, value - 1));
    showNotice("Son profil geri getirildi.");
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target?.closest(
          "input, textarea, select, [contenteditable], [role='dialog']",
        ) ||
        preferencesOpen ||
        tasksOpen ||
        superInfoOpen ||
        detailProfile ||
        notice
      )
        return;
      const action =
        event.key === " " || event.key === "ArrowRight"
          ? "right"
          : event.key === "ArrowLeft"
            ? "left"
            : event.key === "ArrowUp"
              ? "super"
              : null;
      if (action && profile) {
        event.preventDefault();
        void decide(action);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        void rewind();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  async function loadDeck(nextPreferences: DiscoveryPreferences) {
    const response = await fetch("/api/discovery", { cache: "no-store" });
    const result = await readJson(
      response,
      {} as {
        profiles?: Profile[];
        dailyPick?: DailyPick | null;
        error?: string;
        superLike?: SuperLikeAllowance;
      },
    );
    if (!response.ok || !result.profiles)
      throw new Error(result.error ?? "Keşfet kartları yenilenemedi.");
    const incoming = result.profiles ?? [];
    setDailyPick(visibleDailyPick(result.dailyPick));
    setAllProfiles(incoming);
    setDeckProfiles(
      filterProfiles(incoming, nextPreferences, new Set(), viewer.city),
    );
    setIndex(0);
    setDecidedIds(new Set());
    if (result.superLike) setSuperLike(result.superLike);
    if (!result.profiles?.length)
      showNotice("Şimdilik yeni profil yok. Biraz sonra tekrar bak.");
  }
  const refreshDeck = async () => {
    if (inFlight.current) return;
    if (!liveMode) {
      setIndex(0);
      setDecidedIds(new Set());
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    try {
      await loadDeck(preferences);
    } catch {
      showNotice("Keşfet kartları yenilenemedi.");
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };
  const applyPreferences = async (next: DiscoveryPreferences) => {
    if (inFlight.current) return;
    if (!liveMode) {
      setPreferences(next);
      setDeckProfiles(
        filterProfiles(allProfiles, next, decidedIds, viewer.city),
      );
      setIndex(0);
      setPreferencesOpen(false);
      return;
    }
    inFlight.current = true;
    setProcessing(true);
    try {
      const response = await fetch("/api/discovery/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = await readJson(response, {} as { error?: string });
      if (!response.ok)
        throw new Error(result.error ?? "Filtreler kaydedilemedi.");
      setPreferences(next);
      setPreferencesOpen(false);
      setDeckProfiles((current) =>
        filterProfiles(current, next, decidedIds, viewer.city),
      );
      setIndex(0);
      await loadDeck(next);
      showNotice("Keşfet filtrelerin uygulandı.");
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Filtreler kaydedilemedi.",
      );
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  };

  return (
    <Screen className="discover-screen">
      <DiscoveryHeader
        list={false}
        onSwitch={onExplore}
        onFilter={() => setPreferencesOpen(true)}
        onRitual={() => setTasksOpen(true)}
        onBoost={onBoost}
      />
      <StoryStrip live={liveMode} />
      {liveMode ? <CampaignBanner compact /> : null}
      {liveMode ? <DailyQuestionCard /> : null}
      <div className="deck" aria-live="polite">
        {profile ? (
          <>
            <div className="ghost-card ghost-two" />
            <div className="ghost-card ghost-one" />
            <AnimatePresence mode="popLayout">
              <SwipeCard
                key={`${profile.id}-${index}`}
                profile={profile}
                dailyPickReason={dailyPick?.profileId === profile.id ? dailyPick.reason : undefined}
                disabled={processing}
                onDecision={decide}
                onOpen={() => openProfile(profile)}
              />
            </AnimatePresence>
          </>
        ) : (
          <EmptyDeck loading={processing} onRefresh={refreshDeck} />
        )}
        <div className="swipe-actions" aria-busy={processing}>
          <button
            className="action-button rewind"
            disabled={processing}
            onClick={() => void rewind()}
            aria-label="Son kararı geri al"
          >
            <RotateCcw size={20} />
          </button>
          <button
            className="action-button reject"
            disabled={!profile || processing}
            onClick={() => decide("left")}
            aria-label="Geç"
          >
            <X size={30} strokeWidth={2.6} />
          </button>
          <button
            className="action-button like"
            disabled={!profile || processing}
            onClick={() => decide("right")}
            aria-label="Beğen"
          >
            {processing ? (
              <LoaderCircle className="spin" size={26} />
            ) : (
              <Heart size={28} fill="currentColor" />
            )}
          </button>
          <button
            className="action-button star"
            disabled={!profile || processing}
            onClick={() => {
              if (!profile || processing) return;
              if (superLike.remaining > 0 || viewer.isNoir) {
                setSuperNoteOpen(true);
              } else {
                setSuperInfoOpen(true);
              }
            }}
            aria-label={`Süper beğeni · ${superLike.remaining} hakkın kaldı`}
          >
            <Star size={24} fill="currentColor" />
            <span className="star-crown-badge">👑</span>
            <b>{viewer.isNoir ? "∞" : superLike.remaining}</b>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {tasksOpen ? (
          <QuestSheet
            current={Math.min(questProgress, 3)}
            chatDone={chatQuestComplete}
            xp={viewer.xp}
            level={viewer.level}
            onClose={() => setTasksOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {preferencesOpen ? (
          <PreferencesSheet
            initial={preferences}
            premium={viewer.isNoir}
            busy={processing}
            onClose={() => setPreferencesOpen(false)}
            onApply={(next) => void applyPreferences(next)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {superInfoOpen ? (
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSuperInfoOpen(false)}
          >
            <motion.section
              className="sheet allowance-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <Star size={25} fill="currentColor" />
              <h2>
                {viewer.isNoir
                  ? "Günlük Süper Beğeni"
                  : "Haftalık Süper Beğeni"}
              </h2>
              <p>
                {superLike.remaining
                  ? "Hakkın hazır."
                  : `Yeni hakkın ${superLike.resetsAt ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(superLike.resetsAt)) : "yakında"} yenilenecek.`}
              </p>
              {!viewer.isNoir ? (
                <Link href="/noir" className="primary-button">
                  Noir ayrıcalıklarını gör
                </Link>
              ) : null}
              <button
                className="ghost-button"
                onClick={() => setSuperInfoOpen(false)}
              >
                Kapat
              </button>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {superNoteOpen ? (
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSuperNoteOpen(false)}
          >
            <motion.section
              className="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <h2>Notlu Süper Beğeni</h2>
              <p>İlk izlenimini kısa bir notla bırak.</p>
              <textarea
                value={superNote}
                maxLength={280}
                placeholder="Notun (isteğe bağlı)"
                onChange={(event) => setSuperNote(event.currentTarget.value)}
              />
              <button
                className="primary-button"
                onClick={() => {
                  setSuperNoteOpen(false);
                  void decide("super", false, superNote);
                  setSuperNote("");
                }}
              >
                Gönder
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  setSuperNoteOpen(false);
                  setSuperNote("");
                }}
              >
                Vazgeç
              </button>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {detailProfile ? (
          <ProfileDetail
            profile={detailProfile}
            onClose={() => setDetailProfile(null)}
            onDecision={(direction) => {
              setDetailProfile(null);
              void decide(direction);
            }}
            onMessage={() => void startMessage()}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {notice ? (
          <PremiumNotice message={notice} onClose={() => setNotice(null)} />
        ) : null}
      </AnimatePresence>
    </Screen>
  );
}

function EmptyDeck({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <motion.div
      className="empty-deck"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <span className="empty-seal">
        <Heart size={25} />
      </span>
      <small>Bugünün destesi tamamlandı</small>
      <h2>
        Yeni bir tesadüf
        <br />
        hazırlanıyor.
      </h2>
      <p>Tercihlerine uyan yeni profiller geldikçe burada belirecek.</p>
      <button type="button" onClick={onRefresh} disabled={loading}>
        {loading ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <RotateCcw size={15} />
        )}{" "}
        Desteyi yenile
      </button>
    </motion.div>
  );
}

function PreferencesSheet({
  initial,
  premium,
  busy = false,
  onClose,
  onApply,
}: {
  initial: DiscoveryPreferences;
  premium: boolean;
  busy?: boolean;
  onClose: () => void;
  onApply: (preferences: DiscoveryPreferences) => void;
}) {
  const dialog = useDialog<HTMLElement>(onClose);
  const [draft, setDraft] = useState(initial);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [languages, setLanguages] = useState(initial.languageValues.join(", "));
  const toggleGender = (
    value: DiscoveryPreferences["interestedGenders"][number],
  ) =>
    setDraft((current) => ({
      ...current,
      interestedGenders: current.interestedGenders.includes(value)
        ? current.interestedGenders.filter((item) => item !== value)
        : [...current.interestedGenders, value],
    }));
  const toggleList = (
    key: keyof Pick<
      DiscoveryPreferences,
      | "relationshipGoals"
      | "maritalStatuses"
      | "childrenPreferences"
      | "alcoholValues"
      | "smokingValues"
      | "petValues"
      | "sportsValues"
      | "zodiacValues"
      | "educationValues"
    >,
    value: string,
  ) =>
    setDraft((current) => {
      const list = current[key];
      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      };
    });
  const updateMinAge = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.max(18, Math.min(99, value));
    setDraft((current) => ({
      ...current,
      minAge: next,
      maxAge: Math.max(current.maxAge, next),
    }));
  };
  const updateMaxAge = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.max(18, Math.min(99, value));
    setDraft((current) => ({
      ...current,
      maxAge: next,
      minAge: Math.min(current.minAge, next),
    }));
  };
  const minPosition = ((draft.minAge - 18) / 81) * 100;
  const maxPosition = ((draft.maxAge - 18) / 81) * 100;
  const apply = () =>
    onApply({
      ...draft,
      verifiedOnly: draft.verifiedOnly,
      cities: draft.sameCityOnly ? [] : draft.cities,
      languageValues: premium
        ? languages
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 10)
        : [],
    });
  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        ref={dialog}
        className="sheet preferences-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <small>Keşfet filtreleri</small>
            <h2 id="preferences-title">Kimlerle tanışmak istersin?</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Filtreleri kapat"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <section className="filter-tier">
          <header>
            <span>Temel tercihler</span>
            <small>Herkese açık</small>
          </header>
          <PreferenceChips
            label="İlgilendiğin kişiler"
            options={genderChoices}
            selected={draft.interestedGenders}
            onToggle={(value) =>
              toggleGender(
                value as DiscoveryPreferences["interestedGenders"][number],
              )
            }
          />
          <div className="preference-age">
            <header>
              <span>Yaş aralığı</span>
              <output aria-live="polite">
                {draft.minAge} – {draft.maxAge}
              </output>
            </header>
            <div className="age-range-slider">
              <div
                className="age-range-track"
                style={{
                  background: `linear-gradient(to right, #e8dadd ${minPosition}%, #d62f58 ${minPosition}%, #d62f58 ${maxPosition}%, #e8dadd ${maxPosition}%)`,
                }}
              />
              <input
                aria-label="En düşük yaş"
                aria-valuetext={`${draft.minAge} yaş`}
                type="range"
                min="18"
                max="99"
                value={draft.minAge}
                onChange={(event) =>
                  updateMinAge(event.currentTarget.valueAsNumber)
                }
              />
              <input
                aria-label="En yüksek yaş"
                aria-valuetext={`${draft.maxAge} yaş`}
                type="range"
                min="18"
                max="99"
                value={draft.maxAge}
                onChange={(event) =>
                  updateMaxAge(event.currentTarget.valueAsNumber)
                }
              />
            </div>
            <footer>
              <span>18</span>
              <span>99</span>
            </footer>
          </div>
          <div className="preference-row">
            <span>Yalnızca benim şehrim</span>
            <button
              type="button"
              className={draft.sameCityOnly ? "switch active" : "switch"}
              role="switch"
              aria-label="Yalnızca benim şehrim"
              aria-checked={draft.sameCityOnly}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  sameCityOnly: !current.sameCityOnly,
                }))
              }
            >
              <i />
            </button>
          </div>
          <div className="preference-text">
            <span>Diğer şehirler</span>
            <button
              type="button"
              className="city-picker-trigger"
              disabled={draft.sameCityOnly}
              aria-expanded={citiesOpen}
              onClick={() => setCitiesOpen((open) => !open)}
            >
              {draft.cities.length ? draft.cities.join(", ") : "Şehir seç"}{" "}
              <ChevronDown size={16} />
            </button>
            {citiesOpen && !draft.sameCityOnly ? (
              <div className="city-picker-list">
                {turkishCities.map((city) => (
                  <label key={city}>
                    <input
                      type="checkbox"
                      checked={draft.cities.includes(city)}
                      disabled={
                        !draft.cities.includes(city) &&
                        draft.cities.length >= 10
                      }
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          cities: current.cities.includes(city)
                            ? current.cities.filter((item) => item !== city)
                            : [...current.cities, city],
                        }))
                      }
                    />
                    {city}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <label className="preference-text">
            <span>Şehir merkezleri arası mesafe</span>
            <select
              value={draft.maxDistanceKm ?? ""}
              disabled={draft.sameCityOnly}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  maxDistanceKm: event.target.value
                    ? Number(event.target.value)
                    : null,
                }))
              }
            >
              <option value="">Sınır yok</option>
              {[25, 50, 100, 250, 500, 1000].map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
          <PreferenceChips
            label="İlişki beklentisi"
            options={relationshipChoices}
            selected={draft.relationshipGoals}
            onToggle={(value) => toggleList("relationshipGoals", value)}
          />
        </section>
        <section
          className={
            premium ? "filter-tier noir-tier" : "filter-tier noir-tier locked"
          }
        >
          <header>
            <span>
              <Crown size={14} /> Noir uyum filtresi
            </span>
            <small>{premium ? "Üyeliğinle açık" : "Premium"}</small>
          </header>
          <div className="preference-row">
            <span>Fotoğrafı doğrulanmış profiller</span>
            <button
              type="button"
              className={
                draft.verifiedOnly ? "switch active" : "switch"
              }
              role="switch"
              aria-label="Sadece doğrulanmış profiller"
              aria-checked={draft.verifiedOnly}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  verifiedOnly: !current.verifiedOnly,
                }))
              }
            >
              <i />
            </button>
          </div>
          {premium ? (
            <details className="noir-filter-details">
              <summary>Yaşam tarzı ve uyum</summary>
              <PreferenceChips
                label="Medeni durum"
                options={maritalChoices}
                selected={draft.maritalStatuses}
                onToggle={(value) => toggleList("maritalStatuses", value)}
              />
              <PreferenceChips
                label="Çocuğu var mı?"
                options={[
                  ["false", "Hayır"],
                  ["true", "Evet"],
                ]}
                selected={draft.hasChildrenValues.map(String)}
                onToggle={(value) =>
                  setDraft((current) => ({
                    ...current,
                    hasChildrenValues: current.hasChildrenValues.includes(
                      value === "true",
                    )
                      ? current.hasChildrenValues.filter(
                          (item) => item !== (value === "true"),
                        )
                      : [...current.hasChildrenValues, value === "true"],
                  }))
                }
              />
              <PreferenceChips
                label="Gelecekte çocuk"
                options={childrenChoices}
                selected={draft.childrenPreferences}
                onToggle={(value) => toggleList("childrenPreferences", value)}
              />
              <PreferenceChips
                label="Alkol"
                options={lifestyleOptions.alcohol}
                selected={draft.alcoholValues}
                onToggle={(value) => toggleList("alcoholValues", value)}
              />
              <PreferenceChips
                label="Sigara"
                options={lifestyleOptions.smoking}
                selected={draft.smokingValues}
                onToggle={(value) => toggleList("smokingValues", value)}
              />
              <PreferenceChips
                label="Evcil hayvan"
                options={lifestyleOptions.pets}
                selected={draft.petValues}
                onToggle={(value) => toggleList("petValues", value)}
              />
              <PreferenceChips
                label="Spor"
                options={lifestyleOptions.sports}
                selected={draft.sportsValues}
                onToggle={(value) => toggleList("sportsValues", value)}
              />
              <PreferenceChips
                label="Burç"
                options={zodiacOptions}
                selected={draft.zodiacValues}
                onToggle={(value) => toggleList("zodiacValues", value)}
              />
              <div className="preference-number-row">
                <label>
                  En az boy
                  <input
                    type="number"
                    min="120"
                    max="230"
                    value={draft.minHeightCm ?? ""}
                    placeholder="120"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        minHeightCm: event.target.value
                          ? event.target.valueAsNumber
                          : null,
                      }))
                    }
                  />
                </label>
                <label>
                  En çok boy
                  <input
                    type="number"
                    min="120"
                    max="230"
                    value={draft.maxHeightCm ?? ""}
                    placeholder="230"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        maxHeightCm: event.target.value
                          ? event.target.valueAsNumber
                          : null,
                      }))
                    }
                  />
                </label>
              </div>
              <PreferenceChips
                label="Eğitim"
                options={lifestyleOptions.education}
                selected={draft.educationValues}
                onToggle={(value) => toggleList("educationValues", value)}
              />
              <label className="preference-text">
                <span>
                  Diller <small>Virgülle ayır</small>
                </span>
                <input
                  value={languages}
                  maxLength={180}
                  placeholder="Türkçe, İngilizce"
                  onChange={(event) => setLanguages(event.target.value)}
                />
              </label>
            </details>
          ) : (
            <Link href="/noir" className="filter-upgrade">
              <LockKeyhole size={14} /> Noir ayrıcalıklarını gör
            </Link>
          )}
        </section>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            setDraft({ ...defaultPreferences, maxAge: 99 });
            setCitiesOpen(false);
            setLanguages("");
          }}
        >
          Filtreleri sıfırla
        </button>
        <button
          type="button"
          className="primary-button preference-apply"
          disabled={
            busy ||
            !draft.interestedGenders.length ||
            (draft.minHeightCm !== null &&
              draft.maxHeightCm !== null &&
              draft.minHeightCm > draft.maxHeightCm)
          }
          onClick={apply}
        >
          {busy ? "Kaydediliyor…" : "Filtreleri uygula"}
        </button>
      </motion.section>
    </motion.div>
  );
}

function PreferenceChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="preference-gender-list">
      <span>{label}</span>
      <div>
        {options.map(([value, text]) => (
          <button
            type="button"
            key={value}
            aria-pressed={selected.includes(value)}
            className={selected.includes(value) ? "selected" : ""}
            onClick={() => onToggle(value)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function filterProfiles(
  profiles: Profile[],
  preferences: DiscoveryPreferences,
  excluded = new Set<string>(),
  viewerCity?: string,
) {
  return profiles.filter(
    (profile) =>
      !excluded.has(profile.id) &&
      profile.age >= preferences.minAge &&
      profile.age <= preferences.maxAge &&
      preferences.interestedGenders.some(
        (gender) => gender === profile.gender,
      ) &&
      (!preferences.verifiedOnly || profile.verified) &&
      (!preferences.sameCityOnly ||
        !viewerCity ||
        profile.city === viewerCity) &&
      (!preferences.cities.length ||
        preferences.cities.some(
          (city) =>
            city.localeCompare(profile.city ?? "", "tr", {
              sensitivity: "base",
            }) === 0,
        )) &&
      (!preferences.relationshipGoals.length ||
        preferences.relationshipGoals.includes(profile.relationshipGoal ?? "")),
  );
}

function SwipeCard({
  profile,
  dailyPickReason,
  disabled,
  onDecision,
  onOpen,
}: {
  profile: Profile;
  dailyPickReason?: string;
  disabled: boolean;
  onDecision: (direction: "left" | "right") => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const likeOpacity = useTransform(x, [20, 110], [0, 1]);
  const noOpacity = useTransform(x, [-110, -20], [1, 0]);
  const lastDragAt = useRef(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = profile.photos?.length ? profile.photos : [profile.image];
  const presence = resolvePresence({
    id: profile.id,
    isOnline: profile.isOnline,
    lastSeenAt: profile.lastSeenAt,
  });
  const recent =
    !presence.isOnline &&
    (presence.text === "Az önce aktifti" || presence.text.includes("dk önce"));
  const advancePhoto = () => {
    if (photoIndex < photos.length - 1) setPhotoIndex(photoIndex + 1);
    else onOpen();
  };

  return (
    <motion.div
      className="profile-card"
      style={{ x, rotate }}
      initial={false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragStart={() => {
        lastDragAt.current = Date.now();
      }}
      onDragEnd={(_, info) => {
        lastDragAt.current = Date.now();
        if (Math.abs(info.offset.x) > 105)
          onDecision(info.offset.x > 0 ? "right" : "left");
      }}
      onTap={() => {
        if (Date.now() - lastDragAt.current > 250) advancePhoto();
      }}
      tabIndex={0}
      role="button"
      aria-label={`${profile.name}, fotoğraf ${photoIndex + 1}/${photos.length}. ${photoIndex < photos.length - 1 ? "Sonraki fotoğraf" : "Profili aç"}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          advancePhoto();
        }
      }}
    >
      <Image
        src={photos[photoIndex]}
        alt={`${profile.name}, ${profile.age} · fotoğraf ${photoIndex + 1}`}
        fill
        priority
        sizes="(max-width: 720px) 92vw, 430px"
        unoptimized={photos[photoIndex].startsWith("http")}
      />
      <div className="photo-vignette" />
      {profile.sameDailyAnswer ? <div className="same-answer-label">Günün sorusunda aynı şıkkı seçtiniz</div> : null}
      {dailyPickReason ? <div className="daily-pick-label"><strong>Günün uyumu</strong><span>{dailyPickReason}</span></div> : null}
      {photos.length > 1 ? (
        <span className="card-photo-progress" aria-hidden="true">
          {photos.map((_, index) => (
            <i key={index} className={index === photoIndex ? "active" : ""} />
          ))}
        </span>
      ) : null}
      <span className="card-more" aria-hidden="true">
        •••
      </span>
      <motion.div
        className="swipe-stamp stamp-like"
        style={{ opacity: likeOpacity }}
      >
        BEĞEN
      </motion.div>
      <motion.div
        className="swipe-stamp stamp-no"
        style={{ opacity: noOpacity }}
      >
        GEÇ
      </motion.div>
      <div className="profile-content">
        <div className="card-title">
          <h1>
            {profile.name}
            <span>{profile.age}</span>
            {profile.verified ? (
              <BadgeCheck size={22} fill="currentColor" />
            ) : null}
          </h1>
          <span className="card-info">
            <Info size={19} />
          </span>
        </div>
        <div
          className="profile-place"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span
            className={`presence-badge ${presence.isOnline ? "online" : recent ? "recent" : "offline"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <span
              className={`presence-dot ${presence.isOnline ? "online" : recent ? "recent" : "offline"}`}
            />
            <span style={{ fontWeight: 600, fontSize: 12 }}>
              {presence.text}
            </span>
          </span>
          {profile.distance ? (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{profile.distance}</span>
            </>
          ) : null}
        </div>
        <div className="prompt-card">
          <small>{profile.prompt}</small>
          <p>“{profile.answer}”</p>
          {profile.voiceUrl ? (
            <div className="profile-voice-prompt">
              <small>{profile.voicePrompt}</small>
              <audio
                controls
                preload="none"
                src={profile.voiceUrl}
                aria-label={`${profile.name} sesli biyografi`}
              />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function ProfileDetail({
  profile,
  onClose,
  onDecision,
  onMessage,
  matched = false,
}: {
  profile: Profile;
  onClose: () => void;
  onDecision: (direction: "left" | "right" | "super") => void;
  onMessage: () => void;
  matched?: boolean;
}) {
  const dialog = useDialog<HTMLElement>(onClose);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = profile.photos?.length ? profile.photos : [profile.image];
  const movePhoto = (step: number) =>
    setPhotoIndex((current) =>
      Math.max(0, Math.min(photos.length - 1, current + step)),
    );
  const presence = resolvePresence({
    id: profile.id,
    isOnline: profile.isOnline,
    lastSeenAt: profile.lastSeenAt,
  });
  return (
    <motion.div
      className="profile-detail-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.article
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name} profili`}
        className="profile-detail"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 29, stiffness: 260 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-detail-nav">
          <button
            type="button"
            className="detail-back-button"
            onClick={onClose}
            aria-label="Geri"
          >
            <ArrowLeft size={20} strokeWidth={2.4} />
          </button>
          <div className="detail-nav-logo">
            <Brand className="brand detail-brand" />
          </div>
          <SafetyMenu profile={profile} onBlocked={onClose} />
        </div>
        <div className="detail-photo">
          <Image
            src={photos[photoIndex]}
            alt={`${profile.name}, ${profile.age} · fotoğraf ${photoIndex + 1}`}
            fill
            priority
            sizes="(max-width: 720px) 100vw, 480px"
            unoptimized={photos[photoIndex].startsWith("http")}
          />
          <div />
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                className="photo-tap previous"
                aria-label="Önceki fotoğraf"
                disabled={photoIndex === 0}
                onClick={() => movePhoto(-1)}
              />
              <button
                type="button"
                className="photo-tap next"
                aria-label="Sonraki fotoğraf"
                disabled={photoIndex === photos.length - 1}
                onClick={() => movePhoto(1)}
              />
              <span className="photo-progress">
                {photos.map((_, index) => (
                  <i
                    key={index}
                    className={index === photoIndex ? "active" : ""}
                  />
                ))}
              </span>
            </>
          ) : null}
        </div>
        <div className="detail-copy">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <span
              className={`presence-dot ${presence.isOnline ? "online" : "offline"}`}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: presence.isOnline ? "#4ade80" : "var(--muted)",
              }}
            >
              {presence.text}
            </span>
            <span style={{ opacity: 0.5, margin: "0 2px" }}>·</span>
            <small style={{ fontSize: 13 }}>{profile.distance}</small>
          </div>
          <h2>
            {profile.name}
            <span>{profile.age}</span>
            {profile.verified ? (
              <BadgeCheck size={21} fill="currentColor" />
            ) : null}
          </h2>
          <div className="badges">
            {profile.badges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
          <EndorsementBadges profileId={profile.id} />
          {profile.superLikeNote ? (
            <section>
              <small>Süper Beğeni notu</small>
              <p>“{profile.superLikeNote}”</p>
            </section>
          ) : null}
          <section>
            <small>{profile.prompt}</small>
            <p>“{profile.answer}”</p>
          </section>
          {profile.voiceUrl ? (
            <div className="profile-voice-prompt">
              <small>{profile.voicePrompt}</small>
              <audio
                controls
                preload="none"
                src={profile.voiceUrl}
                aria-label={`${profile.name} sesli biyografi`}
              />
            </div>
          ) : null}
          <LifestyleDetails profile={profile} onMessage={onMessage} />
          {matched ? (
            <div className="detail-actions matched">
              <button
                type="button"
                className="detail-message"
                onClick={onMessage}
              >
                <MessageCircle size={20} /> Mesaja dön
              </button>
            </div>
          ) : (
            <div className="detail-actions">
              <button
                type="button"
                className="detail-pass"
                onClick={() => onDecision("left")}
                aria-label="Geç"
              >
                <X size={24} />
                <span>Geç</span>
              </button>
              <button
                type="button"
                className="detail-super"
                onClick={() => onDecision("super")}
                aria-label="Süper Beğeni"
              >
                <Star size={22} fill="currentColor" />
                <span>Süper</span>
              </button>
              <button
                type="button"
                className="detail-like"
                onClick={() => onDecision("right")}
                aria-label="Beğen"
              >
                <Heart size={23} fill="currentColor" />
                <span>Beğen</span>
              </button>
            </div>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}

function LifestyleDetails({
  profile,
  onMessage,
}: {
  profile: Profile;
  onMessage?: () => void;
}) {
  const values: Array<[LucideIcon, string, string]> = [
    [
      Heart,
      "İlişki beklentisi",
      optionLabel(relationshipChoices, profile.relationshipGoal),
    ],
    [
      UserRound,
      "Medeni durum",
      optionLabel(maritalChoices, profile.maritalStatus),
    ],
    [
      Baby,
      "Gelecekte çocuk",
      optionLabel(childrenChoices, profile.childrenPreference),
    ],
    [Wine, "Alkol", optionLabel(lifestyleOptions.alcohol, profile.alcoholUse)],
    [
      Cigarette,
      "Sigara",
      optionLabel(lifestyleOptions.smoking, profile.smokingUse),
    ],
    [
      PawPrint,
      "Evcil hayvan",
      optionLabel(lifestyleOptions.pets, profile.petPreference),
    ],
    [
      Dumbbell,
      "Spor",
      optionLabel(lifestyleOptions.sports, profile.sportsHabit),
    ],
    [Star, "Burç", optionLabel(zodiacOptions, profile.zodiac)],
    [
      GraduationCap,
      "Eğitim",
      optionLabel(lifestyleOptions.education, profile.educationLevel),
    ],
    [
      UserRound,
      "Çocuğu var mı?",
      profile.hasChildren === undefined
        ? ""
        : profile.hasChildren
          ? "Evet"
          : "Hayır",
    ],
    [Ruler, "Boy", profile.heightCm ? `${profile.heightCm} cm` : ""],
  ];
  const shown = values.filter(([, , value]) => Boolean(value));
  const languagesStr = profile.languages?.length
    ? profile.languages.join(", ")
    : "";

  if (!shown.length && !languagesStr) {
    return (
      <p className="relationship-line">Yaşam tarzı bilgisi henüz eklenmemiş.</p>
    );
  }

  return (
    <section className="lifestyle-section">
      <div className="lifestyle-ambient-glow" aria-hidden="true" />
      <div className="lifestyle-ambient-glow-2" aria-hidden="true" />
      <div className="lifestyle-header">
        <h3 className="lifestyle-heading">Onun dünyasında</h3>
        <span className="lifestyle-accent-bar" />
      </div>

      <div className="lifestyle-card">
        <div className="lifestyle-card-rows">
          {shown.map(([Icon, label, value]) => (
            <div key={label} className="lifestyle-row">
              <div className="lifestyle-row-left">
                <span className="lifestyle-icon-circle">
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span className="lifestyle-label">{label}</span>
              </div>
              <span className="lifestyle-value">{value}</span>
            </div>
          ))}
        </div>

        {languagesStr ? (
          <div className="lifestyle-languages-pill">
            <Globe2
              size={19}
              className="lifestyle-lang-icon"
              strokeWidth={2.2}
            />
            <span className="lifestyle-lang-label">
              Diller: <strong>{languagesStr}</strong>
            </span>
          </div>
        ) : null}
      </div>

      {onMessage ? (
        <button
          type="button"
          className="lifestyle-message-btn"
          onClick={onMessage}
        >
          <MessageCircle size={20} strokeWidth={2.2} />
          <span>Mesaj gönder</span>
        </button>
      ) : null}
    </section>
  );
}

function optionLabel(
  options: readonly (readonly [string, string])[],
  value?: string,
) {
  return value ? (options.find(([key]) => key === value)?.[1] ?? value) : "";
}

function QuestSheet({
  current,
  chatDone,
  xp,
  level,
  onClose,
}: {
  current: number;
  chatDone: boolean;
  xp: number;
  level: number;
  onClose: () => void;
}) {
  const currentLevelXp = 100 * (level - 1) ** 2;
  const nextLevelXp = 100 * level ** 2;
  const levelProgress =
    ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <small>Günlük ritüeller</small>
            <h2>Bağ kur, parlamaya devam et.</h2>
          </div>
          <span className="level-orb">
            LV
            <br />
            <b>{level}</b>
          </span>
        </div>
        <div className="xp-line">
          <span>{xp.toLocaleString("tr-TR")} XP</span>
          <i>
            <b
              style={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }}
            />
          </i>
          <span>{nextLevelXp.toLocaleString("tr-TR")}</span>
        </div>
        <div className="task-list">
          <Task
            done={current >= 3}
            icon={<Heart size={18} />}
            title="3 profil hakkında karar ver"
            detail={`${current}/3 · 120 XP`}
          />
          <Task
            done={chatDone}
            icon={<MessageCircle size={18} />}
            title="Bir sohbet başlat"
            detail={chatDone ? "Tamamlandı · 80 XP" : "0/1 · 80 XP"}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}

function Task({
  done,
  icon,
  title,
  detail,
}: {
  done: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className={done ? "task done" : "task"}>
      <span>{done ? <Check size={18} /> : icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function MessagesView({
  matches,
  summaries,
  loading,
  error,
  onRetry,
  liveMode,
  likeCount,
  premium,
  onLikes,
  onDiscover,
  onOpen,
  onDeleteConversation,
}: {
  matches: Profile[];
  summaries: ConversationSummary[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  liveMode: boolean;
  likeCount: number;
  premium: boolean;
  onLikes: () => void;
  onDiscover: () => void;
  onOpen: (profile: Profile) => void;
  onDeleteConversation?: (matchId: string) => Promise<void>;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    matchId: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const conversations = useMemo(
    () =>
      liveMode
        ? summaries
            .filter((item) => !item.request?.incoming)
            .map((item) => item.profile)
        : matches,
    [liveMode, matches, summaries],
  );
  const requests = summaries.filter((item) => item.request?.incoming);
  const visibleConversations = unreadOnly
    ? conversations.filter(
        (profile) =>
          (summaries.find((item) => item.profile.id === profile.id)
            ?.unreadCount ?? 0) > 0,
      )
    : conversations;
  return (
    <Screen className="messages-screen">
      <header className="section-header">
        <div>
          <h1>Mesajlar</h1>
          <small>Güzel bir sohbetin devamı burada.</small>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Mesajlarda ara"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Mesaj seçenekleri"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </header>
      <div
        className="message-filters"
        role="group"
        aria-label="Sohbet filtresi"
      >
        <button
          className={!unreadOnly ? "active" : ""}
          onClick={() => setUnreadOnly(false)}
        >
          Tümü ({conversations.length})
        </button>
        <button className="" onClick={() => setUnreadOnly(false)}>
          Eşleşmeler
        </button>
        <button
          className={unreadOnly ? "active" : ""}
          onClick={() => setUnreadOnly(true)}
        >
          İstekler
        </button>
      </div>
      {premium ? (
        <button
          type="button"
          className="message-likes-entry"
          onClick={onLikes}
          aria-label={
            likeCount
              ? `Seni beğenen ${likeCount} kişiyi gör`
              : "Seni beğenenler bölümünü aç"
          }
        >
          <span className="message-likes-icon">
            <Heart size={19} fill="currentColor" />
          </span>
          <span className="message-likes-copy">
            <strong>Seni Beğenenler</strong>
            <small>
              {likeCount
                ? `${likeCount} kişi seni merak ediyor`
                : "Yeni bir beğeni geldiğinde burada görünür"}
            </small>
          </span>
          {likeCount ? <b>{likeCount}</b> : null}
        </button>
      ) : (
        <Link
          className="message-likes-entry locked"
          href="/noir"
          aria-label="Seni Beğenenler için Noir üyeliğini incele"
        >
          <span className="message-likes-icon">
            <Heart size={19} fill="currentColor" />
          </span>
          <span className="message-likes-copy">
            <strong>Seni Beğenenler</strong>
            <small className="message-likes-blur" aria-hidden="true">
              Yeni beğenilerini gör
            </small>
            <small>Noir ile kilidi aç</small>
          </span>
          <LockKeyhole className="message-likes-lock" size={16} />
        </Link>
      )}
      <div className="match-section-label">
        <strong>Eşleşmeler</strong>
        <small>Yeni bağların</small>
      </div>
      <div className="match-row">
        <button
          className="new-match"
          aria-label="Yeni eşleşme bul"
          onClick={onDiscover}
        >
          <span>
            <Sparkles size={19} />
          </span>
          <small>Keşfet</small>
        </button>
        {matches.map((profile) => {
          const presence = resolvePresence({
            id: profile.id,
            isOnline: profile.isOnline,
            lastSeenAt: profile.lastSeenAt,
          });
          return (
            <button
              key={profile.id}
              className="match-avatar"
              onClick={() => onOpen(profile)}
            >
              <span style={{ position: "relative" }}>
                <Image
                  src={profile.image}
                  alt=""
                  fill
                  sizes="68px"
                  unoptimized={profile.image.startsWith("http")}
                />
                <i
                  className={`status-dot ${presence.isOnline ? "online" : "offline"}`}
                />
              </span>
              <small>{profile.name}</small>
            </button>
          );
        })}
      </div>
      {requests.length ? (
        <section className="message-requests">
          <h2>
            Mesaj istekleri <span>{requests.length}</span>
          </h2>
          <p>İsteği kabul edene kadar yalnızca ilk mesaj görünür.</p>
          {requests.map((item) => {
            const reqPresence = resolvePresence({
              id: item.profile.id,
              isOnline: item.profile.isOnline,
              lastSeenAt: item.profile.lastSeenAt,
            });
            return (
              <button
                type="button"
                className="conversation"
                key={item.matchId}
                onClick={() => onOpen(item.profile)}
              >
                <span
                  className="conversation-photo"
                  style={{ position: "relative" }}
                >
                  <Image
                    src={item.profile.image}
                    alt=""
                    fill
                    sizes="60px"
                    unoptimized={item.profile.image.startsWith("http")}
                  />
                  <i
                    className={`status-dot ${reqPresence.isOnline ? "online" : "offline"}`}
                  />
                </span>
                <span className="conversation-copy">
                  <strong>{item.profile.name}</strong>
                  <small>{item.lastMessage ?? "Mesaj isteğini incele"}</small>
                </span>
                <ChevronUp className="request-arrow" size={18} />
              </button>
            );
          })}
        </section>
      ) : null}
      {error ? (
        <div className="messages-empty" role="alert">
          <strong>{error}</strong>
          <button type="button" onClick={onRetry}>
            Tekrar dene
          </button>
        </div>
      ) : null}
      <div className="conversation-label">
        Son sohbetler <span>{conversations.length}</span>
      </div>
      <div className="conversation-list">
        {loading && conversations.length === 0 ? (
          <div className="messages-empty" role="status">
            <LoaderCircle className="spin" size={19} />
            <strong>Sohbetlerin hazırlanıyor.</strong>
          </div>
        ) : null}
        {!loading && !error && conversations.length === 0 ? (
          <div className="messages-empty">
            <Sparkles size={19} />
            <strong>İlk sohbetin burada görünecek.</strong>
            <button type="button" onClick={onDiscover}>
              Keşfetmeye başla
            </button>
          </div>
        ) : null}
        {!loading &&
        !error &&
        unreadOnly &&
        conversations.length > 0 &&
        visibleConversations.length === 0 ? (
          <div className="messages-empty">
            <Check size={19} />
            <strong>Tüm mesajlarını gördün.</strong>
            <button type="button" onClick={() => setUnreadOnly(false)}>
              Tüm sohbetler
            </button>
          </div>
        ) : null}
        {visibleConversations.map((profile, i) => {
          const summary = summaries.find(
            (item) => item.profile.id === profile.id,
          );
          const presence = resolvePresence({
            id: profile.id,
            isOnline: profile.isOnline,
            lastSeenAt: profile.lastSeenAt,
          });
          return (
            <div
              className="conversation-item-row"
              key={profile.id}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                position: "relative",
              }}
            >
              <button
                className="conversation"
                style={{ flex: 1, minWidth: 0 }}
                onClick={() => onOpen(profile)}
              >
                <span
                  className="conversation-photo"
                  style={{ position: "relative" }}
                >
                  <Image
                    src={profile.image}
                    alt=""
                    fill
                    sizes="60px"
                    unoptimized={profile.image.startsWith("http")}
                  />
                  <i
                    className={`status-dot ${presence.isOnline ? "online" : "offline"}`}
                  />
                </span>
                <span className="conversation-copy">
                  <strong
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {profile.name}
                      {profile.verified ? <BadgeCheck size={14} /> : null}
                    </span>
                    <span
                      className={`conversation-presence-badge ${presence.isOnline ? "online" : ""}`}
                    >
                      <span
                        className={`presence-dot ${presence.isOnline ? "online" : "offline"}`}
                        style={{ width: 5, height: 5 }}
                      />
                      <span>{presence.text}</span>
                    </span>
                  </strong>
                  <small>
                    {summary?.lastMessage &&
                    summary.lastMessage.trim() !== "" &&
                    summary.lastMessage !== "Yeni sohbet"
                      ? summary.lastMessage
                      : summary?.request
                        ? summary.request.status === "draft"
                          ? "Mesaj isteğini yaz"
                          : "Mesaj isteği · Yanıt bekleniyor"
                        : (summary?.lastMessage ?? "İlk mesajı sen gönder")}
                  </small>
                </span>
                <span className="conversation-meta">
                  <small>
                    {summary
                      ? formatConversationTime(summary.lastMessageAt)
                      : liveMode
                        ? "yeni"
                        : i === 0
                          ? "şimdi"
                          : "12 dk"}
                  </small>
                  {(summary?.unreadCount ?? (!liveMode && i === 0 ? 1 : 0)) >
                  0 ? (
                    <b>{summary?.unreadCount ?? 1}</b>
                  ) : null}
                </span>
              </button>
              {summary?.matchId ? (
                <button
                  type="button"
                  className="icon-button conversation-action-btn"
                  aria-label="Sohbeti sil"
                  title="Sohbeti sil"
                  style={{
                    width: 34,
                    height: 34,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.65,
                    marginLeft: 2,
                    flexShrink: 0,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({
                      matchId: summary.matchId,
                      name: profile.name,
                    });
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {deleteTarget ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              background: "#1c1427",
              borderRadius: 20,
              padding: 24,
              maxWidth: 360,
              width: "100%",
              border: "1px solid rgba(255,255,255,0.12)",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: "#fff",
              }}
            >
              Sohbet silinsin mi?
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Bu sohbet yalnızca senin mesaj listenden kaldırılır. Karşı tarafın
              sohbeti ve mesajları silinmez.
            </p>
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    if (onDeleteConversation)
                      await onDeleteConversation(deleteTarget.matchId);
                    setDeleteTarget(null);
                  } catch (err) {
                    alert(
                      err instanceof Error ? err.message : "Sohbet silinemedi.",
                    );
                  } finally {
                    setDeleting(false);
                  }
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {deleting ? "Siliniyor…" : "Sohbeti sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}

function ChatView({
  profile,
  matched,
  liveMode,
  initialDraft,
  onQuestCompleted,
  onRead,
  onBack,
}: {
  profile: Profile;
  matched: boolean;
  liveMode: boolean;
  initialDraft?: string;
  onQuestCompleted: (xpAwarded: number) => void;
  onRead: (profileId: string) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState(() =>
    liveMode ? [] : initialMessages,
  );
  const [matchId, setMatchId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [text, setText] = useState(initialDraft ?? "");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(liveMode);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingLevel, setRecordingLevel] = useState(0.15);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [chatNotice, setChatNotice] = useState("");
  const [wingmanSuggestions, setWingmanSuggestions] = useState<string[]>([]);
  const [wingmanLoading, setWingmanLoading] = useState(false);
  const [presenceLabel, setPresenceLabel] = useState(
    () =>
      resolvePresence({
        id: profile.id,
        isOnline: profile.isOnline,
        lastSeenAt: profile.lastSeenAt,
      }).text,
  );
  const [botPending, setBotPending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [newMessagesBelow, setNewMessagesBelow] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [request, setRequest] = useState<MessageRequest | null>(null);
  const [isMatched, setIsMatched] = useState(matched);
  const [allowance, setAllowance] = useState<{
    remaining: number;
    limit: number;
  } | null>(null);
  const sending = useRef(false);
  const historyInFlight = useRef(false);
  const historyQueued = useRef(false);
  const chatRealtimeReady = useRef(false);
  const historyVersion = useRef(0);
  const [voicePreview, setVoicePreview] = useState<{
    blob: Blob;
    url: string;
    durationMs: number;
    waveform: number[];
  } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartedAtRef = useRef(0);
  const waveSamplesRef = useRef<number[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  const draftKey = `lovask:chat-draft:${profile.id}`;

  const askWingman = async () => {
    if (!liveMode || !isMatched || wingmanLoading) return;
    setWingmanLoading(true);
    try {
      const response = await fetch("/api/chat/wingman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const result = await readJson(
        response,
        {} as { suggestions?: string[]; error?: string },
      );
      if (!response.ok || !result.suggestions)
        throw new Error(result.error ?? "Öneriler alınamadı.");
      setWingmanSuggestions(result.suggestions);
    } catch (error) {
      setChatNotice(
        error instanceof Error ? error.message : "Öneriler alınamadı.",
      );
    } finally {
      setWingmanLoading(false);
    }
  };

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const timer = window.setTimeout(
      () =>
        setText((current) => current || sessionStorage.getItem(draftKey) || ""),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (text) sessionStorage.setItem(draftKey, text);
    else sessionStorage.removeItem(draftKey);
  }, [draftKey, text]);

  const loadHistory = useCallback(async () => {
    if (!liveMode || sending.current) return;
    if (historyInFlight.current) {
      historyQueued.current = true;
      return;
    }
    do {
      historyQueued.current = false;
      historyInFlight.current = true;
      const version = historyVersion.current;
      try {
        const response = await fetch(
          `/api/chat?profileId=${encodeURIComponent(profile.id)}`,
          { cache: "no-store" },
        );
        const data = await readJson(
          response,
          {} as {
            error?: string;
            messages?: ChatMessage[];
            hasMore?: boolean;
            matchId?: string;
            currentProfileId?: string;
            presence?: unknown;
            markedRead?: boolean;
            matched?: boolean;
            request?: MessageRequest | null;
            botState?: {
              pending?: boolean;
              typing?: boolean;
              quotaReached?: boolean;
            };
          },
        );
        if (version !== historyVersion.current) return;
        if (!response.ok) {
          setChatNotice(data.error ?? "Mesajlar yüklenemedi.");
          setLoadingHistory(false);
          return;
        }
        const incoming = data.messages ?? [];
        setMessages((current) =>
          [
            ...current.filter(
              (message) => !incoming.some((item) => item.id === message.id),
            ),
            ...incoming,
          ].sort((a, b) =>
            (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
          ),
        );
        setHasOlderMessages(Boolean(data.hasMore));
        setMatchId(data.matchId ?? null);
        setMemberId(data.currentProfileId ?? null);
        setPresenceLabel(
          formatPresence(
            data.presence as {
              last_seen_at?: string | null;
              is_online?: boolean;
            } | null,
            profile.id,
          ),
        );
        setRequest(data.request ?? null);
        setIsMatched(Boolean(data.matched));
        setBotPending(Boolean(data.botState?.pending));
        setBotTyping(Boolean(data.botState?.typing));
        if (data.botState?.quotaReached)
          setChatNotice("Günlük mesaj hakkın doldu.");
        setLoadingHistory(false);
        if (data.markedRead !== false) onRead(profile.id);
      } catch {
        setChatNotice(
          "Sohbet yüklenemedi. Bağlantını kontrol edip yeniden dene.",
        );
      } finally {
        historyInFlight.current = false;
        setLoadingHistory(false);
      }
    } while (historyQueued.current);
  }, [liveMode, onRead, profile.id]);

  const loadOlderMessages = async () => {
    const oldest = messages.find(
      (message) =>
        message.createdAt &&
        message.delivery !== "failed" &&
        message.delivery !== "sending",
    );
    const body = chatBodyRef.current;
    if (
      !liveMode ||
      !oldest?.createdAt ||
      loadingOlder ||
      !hasOlderMessages ||
      !body
    )
      return;
    setLoadingOlder(true);
    const previousHeight = body.scrollHeight;
    try {
      const query = new URLSearchParams({
        profileId: profile.id,
        before: oldest.createdAt,
        beforeId: oldest.id,
      });
      const response = await fetch(`/api/chat?${query}`, { cache: "no-store" });
      const data = await readJson(
        response,
        {} as { error?: string; messages?: ChatMessage[]; hasMore?: boolean },
      );
      if (!response.ok)
        throw new Error(data.error ?? "Eski mesajlar yüklenemedi.");
      const older = data.messages ?? [];
      setMessages((current) => [
        ...older.filter(
          (message) => !current.some((item) => item.id === message.id),
        ),
        ...current,
      ]);
      setHasOlderMessages(Boolean(data.hasMore));
      requestAnimationFrame(() => {
        body.scrollTop += body.scrollHeight - previousHeight;
      });
    } catch (error) {
      setChatNotice(
        error instanceof Error ? error.message : "Eski mesajlar yüklenemedi.",
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    if (!liveMode || !botPending || loadingHistory) return;
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(
          `/api/chat?profileId=${encodeURIComponent(profile.id)}&status=1`,
          { cache: "no-store" },
        );
        const data = await readJson(
          response,
          {} as {
            botState?: {
              pending?: boolean;
              typing?: boolean;
              quotaReached?: boolean;
            };
          },
        );
        if (!response.ok) return;
        setBotTyping(Boolean(data.botState?.typing));
        if (!data.botState?.pending) {
          setBotPending(false);
          if (data.botState?.quotaReached)
            setChatNotice("Günlük mesaj hakkın doldu.");
          await loadHistory();
        }
      } finally {
        inFlight = false;
      }
    };
    const first = window.setTimeout(refresh, botTyping ? 900 : 1600);
    const timer = window.setInterval(refresh, botTyping ? 1400 : 2200);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [
    botPending,
    botTyping,
    liveMode,
    loadHistory,
    loadingHistory,
    profile.id,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  useEffect(() => {
    if (!liveMode || !matchId || !memberId) return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (disposed) return;
      const supabase = createClient();
      if (!supabase) return;
      const channel = supabase
        .channel(`match:${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              sender_id: string;
              kind: "text" | "audio" | "image";
              body: string | null;
              created_at: string;
            };
            if (row.sender_id === memberId) return;
            setBotPending(false);
            setBotTyping(false);
            void fetch(`/api/presence?matchId=${encodeURIComponent(matchId)}`, {
              cache: "no-store",
            })
              .then((response) => {
                if (response.ok) onRead(profile.id);
              })
              .catch(() => undefined);
            if (!stickToBottom.current) setNewMessagesBelow(true);
            if (row.kind !== "text") {
              void loadHistory();
              return;
            }
            setMessages((current) =>
              current.some((message) => message.id === row.id)
                ? current
                : [
                    ...current,
                    {
                      id: row.id,
                      from: "them",
                      text: row.body ?? undefined,
                      audio: row.kind === "audio",
                      createdAt: row.created_at,
                    },
                  ],
            );
          },
        )
        .subscribe((status) => {
          chatRealtimeReady.current = status === "SUBSCRIBED";
          if (status === "SUBSCRIBED") void loadHistory();
        });
      disconnect = () => {
        chatRealtimeReady.current = false;
        void supabase.removeChannel(channel);
      };
      if (disposed) disconnect();
    });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [liveMode, loadHistory, matchId, memberId, onRead, profile.id]);

  useEffect(() => {
    if (!liveMode || !matchId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !botPending)
        void loadHistory();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [botPending, liveMode, loadHistory, matchId]);

  useEffect(() => {
    if (!liveMode || !matchId) return;
    const touch = (open: boolean) =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, open }),
        keepalive: true,
      }).catch(() => undefined);
    void touch(document.visibilityState === "visible");
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void touch(true);
    }, 30_000);
    const visibility = () => {
      void touch(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visibility);
      void touch(false);
    };
  }, [liveMode, matchId]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    endRef.current?.scrollIntoView({
      behavior: loadingHistory ? "auto" : "smooth",
    });
  }, [messages.length, loadingHistory]);

  const scrollToLatest = () => {
    stickToBottom.current = true;
    setNewMessagesBelow(false);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const requestWaiting = Boolean(
    request && (request.incoming || request.status === "pending"),
  );
  const messageAction = async (
    message: ChatMessage,
    action: "delete" | "react",
    emoji?: string | null,
  ) => {
    if (!liveMode) return;
    try {
      const response = await fetch("/api/chat/message", {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id, emoji }),
      });
      const result = await readJson(response, {} as { error?: string });
      if (!response.ok) throw new Error(result.error ?? "İşlem yapılamadı.");
      await loadHistory();
    } catch (error) {
      setChatNotice(
        error instanceof Error ? error.message : "İşlem yapılamadı.",
      );
    }
  };
  const canSend =
    !loadingHistory && (!liveMode || Boolean(matchId)) && !requestWaiting;
  const respondToRequest = async (action: "accept" | "reject") => {
    if (sending.current || !matchId) return;
    sending.current = true;
    setLoading(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action }),
      });
      const result = await readJson(response, {} as { error?: string });
      if (!response.ok) throw new Error(result.error ?? "İstek yanıtlanamadı.");
      if (action === "reject") onBack();
      else setRequest(null);
    } catch (error) {
      setChatNotice(
        error instanceof Error
          ? error.message
          : "Bağlantı kurulamadı. Tekrar dene.",
      );
    } finally {
      sending.current = false;
      setLoading(false);
    }
  };

  const sendText = async (clean: string, existingId?: string) => {
    if (!clean || sending.current || !canSend || uploadingVoice) return;
    sending.current = true;
    historyVersion.current++;
    const clientId = existingId ?? crypto.randomUUID();
    const mine: ChatMessage = {
      id: clientId,
      from: "me",
      text: clean,
      createdAt: new Date().toISOString(),
      delivery: "sending",
      replyToId: replyTo?.id,
      replyText: replyTo?.audio ? "Sesli mesaj" : replyTo?.text,
    };
    setMessages((current) =>
      existingId
        ? current.map((message) => (message.id === existingId ? mine : message))
        : [...current, mine],
    );
    stickToBottom.current = true;
    setNewMessagesBelow(false);
    setText("");
    setLoading(true);
    setChatNotice("");
    if (!liveMode) {
      setMessages((current) => [
        ...current.map((message) =>
          message.id === clientId
            ? { ...message, delivery: "sent" as const }
            : message,
        ),
        {
          id: crypto.randomUUID(),
          from: "them",
          text: "Bunu bir kahve eşliğinde konuşmak güzel olurdu ☕",
        },
      ]);
      sending.current = false;
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          message: clean,
          clientId,
          replyToId: replyTo?.id,
        }),
      });
      const data = await readJson(
        response,
        {} as {
          reply?: string;
          replyId?: string;
          replyCreatedAt?: string;
          userMessageId?: string;
          createdAt?: string;
          error?: string;
          quotaReached?: boolean;
          replyPending?: boolean;
          awaitingAdmin?: boolean;
          remainingMessages?: number;
          messageLimit?: number;
          xpAwarded?: number;
          botState?: { pending?: boolean; typing?: boolean };
        },
      );
      if (!response.ok) {
        setMessages((current) =>
          current.map((message) =>
            message.id === clientId
              ? { ...message, delivery: "failed" }
              : message,
          ),
        );
        setChatNotice(data.error ?? "Mesaj gönderilemedi.");
        return;
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === clientId
            ? {
                ...message,
                id: data.userMessageId ?? clientId,
                createdAt: data.createdAt ?? message.createdAt,
                delivery: "sent",
              }
            : message,
        ),
      );
      setReplyTo(null);
      if (request)
        setRequest((current) =>
          current ? { ...current, status: "pending" } : null,
        );
      if (typeof data.remainingMessages === "number" && data.messageLimit)
        setAllowance({
          remaining: data.remainingMessages,
          limit: data.messageLimit,
        });
      if (data.xpAwarded) onQuestCompleted(data.xpAwarded);
      if (data.reply)
        setMessages((current) =>
          data.replyId && current.some((message) => message.id === data.replyId)
            ? current
            : [
                ...current,
                {
                  id: data.replyId ?? crypto.randomUUID(),
                  from: "them",
                  text: data.reply,
                  createdAt: data.replyCreatedAt,
                },
              ],
        );
      setBotPending(Boolean(data.replyPending || data.botState?.pending));
      setBotTyping(Boolean(data.botState?.typing));
      if (data.quotaReached) setChatNotice("Günlük mesaj hakkın doldu.");
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === clientId
            ? { ...message, delivery: "failed" }
            : message,
        ),
      );
    } finally {
      sending.current = false;
      setLoading(false);
    }
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    const clean = text.trim();
    if (clean) void sendText(clean);
  };
  const uploadVoice = useCallback(
    async (blob: Blob, durationMs: number, waveform: number[]) => {
      if (sending.current || request) return;
      sending.current = true;
      historyVersion.current++;
      const clientId = crypto.randomUUID();
      const audioUrl = URL.createObjectURL(blob);
      objectUrlsRef.current.push(audioUrl);
      setMessages((current) => [
        ...current,
        {
          id: clientId,
          from: "me",
          audio: true,
          audioUrl,
          durationMs,
          waveform,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (!liveMode) {
        setChatNotice("Sesli mesaj demo sohbetine eklendi.");
        sending.current = false;
        return;
      }
      setUploadingVoice(true);
      try {
        const form = new FormData();
        form.set("audio", blob, `voice.${audioExtension(blob.type)}`);
        form.set("profileId", profile.id);
        form.set("clientId", clientId);
        form.set("durationMs", String(durationMs));
        form.set("waveform", JSON.stringify(waveform));
        const response = await fetch("/api/chat/audio", {
          method: "POST",
          body: form,
        });
        const data = await readJson(
          response,
          {} as {
            messageId?: string;
            createdAt?: string;
            audioUrl?: string;
            remainingMessages?: number;
            quotaReached?: boolean;
            error?: string;
            xpAwarded?: number;
            replyPending?: boolean;
          },
        );
        if (!response.ok) {
          setMessages((current) =>
            current.filter((message) => message.id !== clientId),
          );
          setChatNotice(
            data.quotaReached
              ? "Bugünkü mesaj hakkın doldu."
              : (data.error ?? "Sesli mesaj gönderilemedi."),
          );
          return;
        }
        setMessages((current) =>
          current.map((message) =>
            message.id === clientId
              ? {
                  ...message,
                  id: data.messageId ?? message.id,
                  createdAt: data.createdAt,
                  audioUrl: data.audioUrl ?? message.audioUrl,
                }
              : message,
          ),
        );
        if (data.xpAwarded) onQuestCompleted(data.xpAwarded);
        if (data.replyPending) setBotPending(true);
        if (
          typeof data.remainingMessages === "number" &&
          data.remainingMessages <= 5
        )
          setChatNotice(`Bugün ${data.remainingMessages} mesaj hakkın kaldı.`);
      } catch {
        setMessages((current) =>
          current.filter((message) => message.id !== clientId),
        );
        setChatNotice(
          "Bağlantı kurulamadı. Sesli mesajı yeniden kaydedebilirsin.",
        );
      } finally {
        sending.current = false;
        setUploadingVoice(false);
      }
    },
    [liveMode, onQuestCompleted, profile.id, request],
  );

  const uploadImage = async (file: File) => {
    if (!matchId || !isMatched || sending.current) return;
    sending.current = true;
    setLoading(true);
    try {
      const form = new FormData();
      form.set("photo", file);
      form.set("matchId", matchId);
      form.set("clientId", crypto.randomUUID());
      const response = await fetch("/api/chat/image", {
        method: "POST",
        body: form,
      });
      const result = await readJson(response, {} as { error?: string });
      if (!response.ok)
        throw new Error(result.error ?? "Fotoğraf gönderilemedi.");
      await loadHistory();
    } catch (error) {
      setChatNotice(
        error instanceof Error ? error.message : "Fotoğraf gönderilemedi.",
      );
    } finally {
      sending.current = false;
      setLoading(false);
    }
  };

  const finishRecorder = useCallback(() => {
    if (animationFrameRef.current !== null)
      cancelAnimationFrame(animationFrameRef.current);
    if (recordTimerRef.current !== null)
      window.clearInterval(recordTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    animationFrameRef.current = null;
    recordTimerRef.current = null;
    setRecording(false);
    setRecordingSeconds(0);
    setRecordingLevel(0.15);
  }, []);

  const recordVoice = async () => {
    if (sending.current || !canSend || request) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      setChatNotice("Bu tarayıcı ses kaydını desteklemiyor.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const mimeType = preferredAudioType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });
      const chunks: Blob[] = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      waveSamplesRef.current = [];
      recordStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        finishRecorder();
        setChatNotice("Ses kaydı tamamlanamadı.");
      };
      recorder.onstop = () => {
        const durationMs = Math.min(
          60000,
          Date.now() - recordStartedAtRef.current,
        );
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const waveform = compactWaveform(waveSamplesRef.current, 28);
        finishRecorder();
        if (durationMs < 500 || blob.size < 100) {
          setChatNotice("Göndermek için biraz daha uzun konuş.");
          return;
        }
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        setVoicePreview({ blob, url, durationMs, waveform });
      };
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const sampleLevel = () => {
        analyser.getByteFrequencyData(samples);
        const average =
          samples.reduce((sum, value) => sum + value, 0) / samples.length;
        const level = Math.max(0.12, Math.min(1, average / 72));
        setRecordingLevel(level);
        waveSamplesRef.current.push(Math.round(level * 100));
        animationFrameRef.current = requestAnimationFrame(sampleLevel);
      };
      sampleLevel();
      recorder.start(500);
      setRecording(true);
      setChatNotice("");
      recordTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - recordStartedAtRef.current) / 1000,
        );
        setRecordingSeconds(seconds);
        if (seconds >= 60 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch {
      finishRecorder();
      setChatNotice("Mikrofon izni olmadan ses kaydı yapılamaz.");
    }
  };

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  return (
    <Screen className="chat-screen">
      <header className="chat-header">
        <button
          className="icon-button"
          aria-label="Mesajlara dön"
          onClick={onBack}
        >
          <ArrowLeft size={20} />
        </button>
        <button className="chat-identity" onClick={() => setProfileOpen(true)}>
          <span className="chat-avatar">
            <Image
              src={profile.image}
              alt=""
              fill
              sizes="42px"
              unoptimized={profile.image.startsWith("http")}
            />
          </span>
          <span>
            <strong>{profile.name}</strong>
            <small
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <i
                style={{
                  background:
                    presenceLabel === "Çevrimiçi" ? "#22c55e" : "#94a3b8",
                }}
              />{" "}
              {presenceLabel}
            </small>
          </span>
        </button>
        <SafetyMenu
          profile={profile}
          matchId={matchId}
          compact
          onBlocked={onBack}
        />
      </header>
      <div
        ref={chatBodyRef}
        className="chat-body"
        role="log"
        aria-label="Sohbet mesajları"
        aria-live="polite"
        onScroll={(event) => {
          const node = event.currentTarget;
          stickToBottom.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          if (stickToBottom.current) setNewMessagesBelow(false);
        }}
      >
        {loadingHistory ? (
          <div className="chat-loading">
            <LoaderCircle className="spin" size={18} /> Sohbet açılıyor
          </div>
        ) : null}
        {!loadingHistory && hasOlderMessages ? (
          <button
            className="load-older-messages"
            type="button"
            disabled={loadingOlder}
            onClick={() => void loadOlderMessages()}
          >
            {loadingOlder ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <ChevronUp size={15} />
            )}{" "}
            {loadingOlder ? "Yükleniyor" : "Daha eski mesajlar"}
          </button>
        ) : null}
        {!loadingHistory && liveMode && !matchId ? (
          <div className="messages-empty">
            <strong>Sohbet açılamadı.</strong>
            <button type="button" onClick={() => void loadHistory()}>
              Tekrar dene
            </button>
          </div>
        ) : null}
        {!loadingHistory && messages.length === 0 && (!liveMode || matchId) ? (
          <div className="first-word">
            <Sparkles size={18} />
            <strong>
              {isMatched ? "Yeni bir eşleşme." : "Mesaj isteğiyle tanış."}
            </strong>
            <small>
              {request
                ? "İlk mesajın bir istek olarak iletilir. Kabul edilince sohbet edebilirsiniz."
                : "İstersen profilindeki bir ayrıntıyla ilk mesajı sen gönder."}
            </small>
          </div>
        ) : null}
        {messages.map((message) => (
          <ChatMessageRow
            key={message.id}
            message={message}
            memberId={memberId}
            onReply={() => setReplyTo(message)}
            onReact={(emoji) => void messageAction(message, "react", emoji)}
            onDelete={() => void messageAction(message, "delete")}
            onReport={() => {
              if (!matchId) return;
              void fetch("/api/safety", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "report",
                  targetProfileId: profile.id,
                  reason: "inappropriate_content",
                  details: `Sohbet mesajı: ${message.id}`,
                  matchId,
                  block: false,
                }),
              }).then((response) =>
                setChatNotice(
                  response.ok
                    ? "Mesaj incelemeye gönderildi."
                    : "Şikâyet gönderilemedi.",
                ),
              );
            }}
            onRetry={() => void sendText(message.text ?? "", message.id)}
          />
        ))}
        {botTyping ? (
          <div className="typing" aria-label={`${profile.name} yazıyor`}>
            <i />
            <i />
            <i />
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      {newMessagesBelow ? (
        <button
          className="new-message-button"
          type="button"
          onClick={scrollToLatest}
        >
          <ChevronDown size={16} /> Yeni mesaj
        </button>
      ) : null}
      <AnimatePresence>
        {chatNotice ? (
          <PremiumNotice
            message={chatNotice}
            onClose={() => setChatNotice("")}
          />
        ) : null}
      </AnimatePresence>
      <footer className="chat-footer">
        {liveMode && isMatched && !requestWaiting ? (
          <div className="wingman-panel">
            <button
              type="button"
              disabled={wingmanLoading}
              onClick={() => void askWingman()}
            >
              <Sparkles size={15} />{" "}
              {wingmanLoading ? "Öneriler hazırlanıyor" : "Sohbet açılışı öner"}
            </button>
            {wingmanSuggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => {
                  setText(suggestion);
                  setWingmanSuggestions([]);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {replyTo ? (
          <div className="chat-reply-preview">
            <span>↳ {replyTo.audio ? "Sesli mesaj" : replyTo.text}</span>
            <button
              type="button"
              aria-label="Yanıtı iptal et"
              onClick={() => setReplyTo(null)}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        {requestWaiting ? (
          <div className="request-banner" role="status">
            <strong>
              {request?.incoming
                ? `${profile.name} sana bir mesaj isteği gönderdi`
                : "Mesaj isteğin gönderildi"}
            </strong>
            <p>
              {request?.incoming
                ? "Kabul edersen sohbet açılır. Bu işlem eşleşme oluşturmaz."
                : "Kabul edildiğinde konuşmaya devam edebilirsin. İstek 24 saat içinde yanıtlanmazsa arşive kalkar."}
            </p>
            {request?.incoming ? (
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void respondToRequest("reject")}
                >
                  Reddet
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void respondToRequest("accept")}
                >
                  Kabul et
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {allowance ? (
          <p className="message-allowance" role="status">
            Bugünkü mesaj hakkın: {allowance.remaining}/{allowance.limit}
          </p>
        ) : null}
        {voicePreview ? (
          <div className="voice-preview">
            <AudioBubble
              message={{
                id: "preview",
                from: "me",
                audio: true,
                audioUrl: voicePreview.url,
                durationMs: voicePreview.durationMs,
                waveform: voicePreview.waveform,
              }}
            />
            <button
              aria-label="Kaydı sil"
              onClick={() => setVoicePreview(null)}
            >
              <Trash2 size={17} />
            </button>
            <button
              className="voice-send"
              disabled={uploadingVoice || !canSend}
              onClick={() => {
                void uploadVoice(
                  voicePreview.blob,
                  voicePreview.durationMs,
                  voicePreview.waveform,
                );
                setVoicePreview(null);
              }}
            >
              <Send size={17} /> Gönder
            </button>
          </div>
        ) : (
          <form
            className={recording ? "composer voice-recording" : "composer"}
            onSubmit={send}
          >
            <label
              className="mic"
              aria-label="Fotoğraf gönder"
              title="Fotoğraf gönder"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!liveMode || !isMatched || !canSend || loading}
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void uploadImage(file);
                  event.currentTarget.value = "";
                }}
              />
              <span aria-hidden="true">＋</span>
            </label>
            <button
              type="button"
              className={recording ? "mic recording" : "mic"}
              disabled={
                !recording &&
                (!canSend || loading || uploadingVoice || Boolean(request))
              }
              onClick={recordVoice}
              aria-label={recording ? "Kaydı bitir" : "Sesli mesaj kaydet"}
            >
              {recording ? (
                <Square size={14} fill="currentColor" />
              ) : (
                <Mic size={20} />
              )}
            </button>
            {recording ? (
              <div className="recording-seal">
                <span style={{ transform: `scaleY(${recordingLevel})` }} />
                <b>00:{String(recordingSeconds).padStart(2, "0")}</b>
                <small>Kaydı önizlemek için bitir</small>
              </div>
            ) : (
              <input
                value={text}
                maxLength={1200}
                enterKeyHint="send"
                autoComplete="off"
                disabled={!canSend || uploadingVoice}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  requestWaiting
                    ? "İsteğin kabul edilmesi bekleniyor"
                    : "Bir şeyler söyle…"
                }
                aria-label="Mesaj"
              />
            )}
            <button
              className="send"
              aria-label="Gönder"
              disabled={
                !text.trim() ||
                loading ||
                !canSend ||
                recording ||
                uploadingVoice
              }
            >
              <Send size={18} fill="currentColor" />
            </button>
          </form>
        )}
      </footer>
      <AnimatePresence>
        {profileOpen ? (
          <ProfileDetail
            profile={profile}
            matched
            onClose={() => setProfileOpen(false)}
            onDecision={() => setProfileOpen(false)}
            onMessage={() => setProfileOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </Screen>
  );
}

function ChatMessageRow({
  message,
  memberId,
  onReply,
  onReact,
  onDelete,
  onReport,
  onRetry,
}: {
  message: ChatMessage;
  memberId: string | null;
  onReply: () => void;
  onReact: (emoji: string | null) => void;
  onDelete: () => void;
  onReport: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reactions = message.reactions ?? [];
  return (
    <div className={`chat-message-row ${message.from}`}>
      {message.audio ? (
        <AudioBubble message={message} />
      ) : (
        <div className={`bubble ${message.from}`}>
          {message.replyText ? (
            <small className="chat-reply-quote">↳ {message.replyText}</small>
          ) : null}
          {message.deleted ? (
            <em>Mesaj silindi</em>
          ) : message.imageUrl ? (
            <a href={message.imageUrl} target="_blank" rel="noreferrer">
              <Image
                src={message.imageUrl}
                alt="Sohbette gönderilen fotoğraf"
                width={240}
                height={300}
                unoptimized
                style={{ objectFit: "contain", borderRadius: 12 }}
              />
            </a>
          ) : (
            message.text
          )}
          {message.createdAt ? (
            <time className="message-time" dateTime={message.createdAt}>
              {new Intl.DateTimeFormat("tr-TR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(message.createdAt))}
            </time>
          ) : null}
          {message.from === "me" && message.delivery === "sending" ? (
            <small className="delivery">Gönderiliyor</small>
          ) : null}
          {message.from === "me" && message.delivery === "failed" ? (
            <button className="retry-message" onClick={onRetry}>
              Gönderilemedi · Tekrar dene
            </button>
          ) : null}
          {message.from === "me" && message.readAt ? (
            <small className="receipt">Okundu</small>
          ) : null}
        </div>
      )}
      {reactions.length ? (
        <small className="chat-reactions">
          {reactions.map((item) => item.emoji).join(" ")}
        </small>
      ) : null}
      {!message.deleted &&
      message.delivery !== "sending" &&
      message.delivery !== "failed" ? (
        <div className="chat-message-actions">
          <button
            type="button"
            aria-label="Mesaj işlemleri"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <MoreVertical size={16} />
          </button>
          {open ? (
            <div className="chat-action-popover">
              <button
                type="button"
                onClick={() => {
                  onReply();
                  setOpen(false);
                }}
              >
                Yanıtla
              </button>
              <div className="chat-emoji-actions">
                {["❤️", "😂", "✨", "👍", "😮"].map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    aria-label={`${emoji} tepki ver`}
                    onClick={() => {
                      onReact(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {reactions.some((item) => item.profileId === memberId) ? (
                <button
                  type="button"
                  onClick={() => {
                    onReact(null);
                    setOpen(false);
                  }}
                >
                  Tepkimi kaldır
                </button>
              ) : null}
              {message.from === "me" ? (
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    setOpen(false);
                  }}
                >
                  Herkesten sil
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onReport();
                    setOpen(false);
                  }}
                >
                  Şikâyet et
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AudioBubble({ message }: { message: ChatMessage }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const durationMs = message.durationMs ?? 12000;
  const progress = durationMs ? currentMs / durationMs : 0;
  const waveform = message.waveform?.length
    ? message.waveform
    : [28, 53, 77, 43, 93, 60, 37, 83, 57, 27, 67, 47, 80, 33];
  const toggle = async () => {
    if (!message.audioUrl) {
      setPlaying((value) => !value);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };
  return (
    <button
      type="button"
      className={`audio-bubble ${message.from}`}
      onClick={toggle}
      aria-label={playing ? "Sesli mesajı duraklat" : "Sesli mesajı oynat"}
    >
      <span className="audio-play">
        {playing ? (
          <span className="pause">Ⅱ</span>
        ) : (
          <Play size={15} fill="currentColor" />
        )}
      </span>
      <span className={playing ? "wave playing" : "wave"}>
        {waveform.map((height, index) => (
          <i
            className={index / waveform.length <= progress ? "heard" : ""}
            key={index}
            style={{ height: Math.max(5, Math.round(height * 0.3)) }}
          />
        ))}
      </span>
      <small>
        {formatAudioTime(
          playing ? Math.max(0, durationMs - currentMs) : durationMs,
        )}
      </small>
      {message.audioUrl ? (
        <audio
          ref={audioRef}
          src={message.audioUrl}
          preload="metadata"
          onTimeUpdate={(event) =>
            setCurrentMs(event.currentTarget.currentTime * 1000)
          }
          onEnded={() => {
            setPlaying(false);
            setCurrentMs(0);
          }}
          onPause={() => setPlaying(false)}
        />
      ) : null}
    </button>
  );
}

function preferredAudioType() {
  return (
    [
      "audio/webm;codecs=opus",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

function audioExtension(type: string) {
  const base = type.split(";")[0];
  if (base === "audio/mp4" || base === "audio/x-m4a") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  return "webm";
}

function compactWaveform(samples: number[], count: number) {
  if (!samples.length) return Array.from({ length: count }, () => 24);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * samples.length) / count);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * samples.length) / count),
    );
    const slice = samples.slice(start, end);
    return Math.max(
      8,
      Math.min(
        100,
        Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length),
      ),
    );
  });
}

function formatAudioTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 2) return "şimdi";
  if (minutes < 60) return `${minutes} dk`;
  if (date.toDateString() === new Date().toDateString())
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatPresence(
  value:
    { last_seen_at?: string | null; is_online?: boolean } | null | undefined,
  profileId?: string,
) {
  return resolvePresence({
    id: profileId,
    isOnline: value?.is_online,
    lastSeenAt: value?.last_seen_at,
  }).text;
}

function BottomNav({
  active,
  unreadMessages,
  unreadLikes,
  unreadSuperLikes,
  onChange,
}: {
  active: Tab;
  unreadMessages: number;
  unreadLikes: number;
  unreadSuperLikes: number;
  onChange: (tab: Tab) => void;
}) {
  const likeLabel =
    unreadSuperLikes > 0
      ? `${unreadLikes} yeni beğeni, ${unreadSuperLikes} süper beğeni`
      : `${unreadLikes} yeni beğeni`;
  const isDiscoverActive = active === "swipe" || active === "discover";
  return (
    <nav className="bottom-nav" aria-label="Ana menü">
      <NavButton
        active={isDiscoverActive}
        onClick={() => onChange("swipe")}
        icon={<Search size={25} strokeWidth={2.4} />}
        label="Keşfet"
      />
      <NavButton
        active={active === "likes"}
        onClick={() => onChange("likes")}
        icon={<Heart size={25} strokeWidth={1.8} />}
        label="Beğeniler"
        badge={unreadLikes}
        badgeLabel={likeLabel}
      />
      <NavButton
        active={active === "meetings"}
        onClick={() => onChange("meetings")}
        icon={<Users size={25} strokeWidth={1.8} />}
        label="Buluşma"
      />
      <NavButton
        active={active === "messages"}
        onClick={() => onChange("messages")}
        icon={<MessageCircle size={25} strokeWidth={1.8} />}
        label="Mesajlar"
        badge={unreadMessages}
        badgeLabel={`${unreadMessages} okunmamış mesaj`}
      />
      <NavButton
        active={active === "profile"}
        onClick={() => onChange("profile")}
        icon={<UserRound size={25} strokeWidth={1.8} />}
        label="Profil"
      />
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  badge = 0,
  badgeLabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeLabel?: string;
}) {
  return (
    <button
      type="button"
      className={active ? "nav-button active" : "nav-button"}
      onClick={onClick}
      aria-label={badge ? `${label} · ${badgeLabel ?? badge}` : label}
    >
      <span className="nav-icon-slot">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge ? <b>{badge > 99 ? "99+" : badge}</b> : null}
      {active ? <span className="nav-active-bar" /> : null}
    </button>
  );
}

function MatchMoment({
  profile,
  viewerImage,
  onClose,
  onMessage,
}: {
  profile: Profile;
  viewerImage: string;
  onClose: () => void;
  onMessage: (draft: string) => void;
}) {
  const dialog = useDialog(onClose);
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6_000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  const selfImage =
    viewerImage === profile.image ? "/profiles/defne.webp" : viewerImage;
  const starters = [
    `${profile.answer} kısmı ilgimi çekti 🙂`,
    `${profile.badges[0] ?? "Profilin"} hakkında biraz daha anlatır mısın?`,
    "Bu eşleşmeyi iyi bir soruyla açalım: bugün seni ne gülümsetti?",
  ];
  return (
    <div
      ref={dialog}
      className="match-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
    >
      <button
        type="button"
        className="match-close"
        aria-label="Eşleşme ekranını kapat"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <div className="match-stars" aria-hidden="true">
        ✦　·　✧　·　✦
      </div>
      <div className="orbit">
        <span>
          <Image
            src={selfImage}
            alt="Sen"
            fill
            sizes="110px"
            loading="eager"
            decoding="async"
            unoptimized={selfImage.startsWith("http")}
          />
        </span>
        <span>
          <Image
            src={profile.image}
            alt={profile.name}
            fill
            sizes="110px"
            loading="eager"
            decoding="async"
            unoptimized={profile.image.startsWith("http")}
          />
        </span>
        <i />
      </div>
      <div className="match-copy">
        <small>Bir kıvılcım yakaladınız</small>
        <h2 id="match-title">Eşleştiniz!</h2>
        <p>Sen ve {profile.name} birbirinizi merak ettiniz.</p>
        <div className="starter-list">
          {starters.map((starter) => (
            <button key={starter} onClick={() => onMessage(starter)}>
              {starter}
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={() => onMessage("")}>
          Mesaj gönder
        </button>
        <button className="ghost-button" onClick={onClose}>
          Keşfetmeye devam et
        </button>
      </div>
    </div>
  );
}

function MeetingPanel({
  onOpenChat,
  onMatched,
}: {
  onOpenChat: (profile: Profile) => void;
  onMatched: (profile: Profile) => void;
}) {
  const [selected, setSelected] = useState<Profile | null>(null);
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const act = async (direction?: "left" | "right" | "super") => {
    if (!selected || busy.current) return;
    busy.current = true;
    try {
      const data = await communityRequest(
        direction ? "/api/discovery" : "/api/conversations",
        "POST",
        { targetProfileId: selected.id, ...(direction ? { direction } : {}) },
      );
      setSelected(null);
      if (!direction) onOpenChat(selected);
      else if (data.matched) onMatched(selected);
      else
        setNotice(
          direction === "left" ? "Kararın kaydedildi." : "Beğenin gönderildi.",
        );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      busy.current = false;
    }
  };
  return (
    <>
      <MeetingView onSelect={setSelected} />
      {selected ? (
        <ProfileDetail
          profile={selected}
          onClose={() => setSelected(null)}
          onDecision={(direction) => void act(direction)}
          onMessage={() => void act()}
        />
      ) : null}
      {notice ? (
        <PremiumNotice message={notice} onClose={() => setNotice("")} />
      ) : null}
    </>
  );
}
