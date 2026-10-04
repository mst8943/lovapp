import type { Metadata } from "next";
import { LovaskApp } from "@/components/lovask-app";

export const metadata: Metadata = { title: "Demo" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const requested = (await searchParams).tab;
  const initialTab = typeof requested === "string" && ["swipe", "discover", "likes", "messages", "profile"].includes(requested) ? requested as "swipe" | "discover" | "likes" | "messages" | "profile" : "swipe";
  return <LovaskApp initialTab={initialTab} />;
}
