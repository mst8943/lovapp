import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_markdown: string;
  category: string;
  tags: string[];
  primary_keyword: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const publicFields = "id,slug,title,excerpt,content_markdown,category,tags,primary_keyword,seo_title,seo_description,cover_image_url,cover_image_alt,author_name,status,published_at,created_at,updated_at";

export const getPublishedPosts = cache(async (): Promise<BlogPost[]> => {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("blog_posts").select(publicFields).eq("status", "published").not("published_at", "is", null).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(200);
  if (error) return [];
  return (data ?? []) as BlogPost[];
});

export const getPublishedPost = cache(async (slug: string): Promise<BlogPost | null> => {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("blog_posts").select(publicFields).eq("slug", slug).eq("status", "published").not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
  if (error) return null;
  return data as BlogPost | null;
});

export function readingMinutes(markdown: string) {
  const words = markdown.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 190));
}

