import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const postSchema = z.object({
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(10).max(120),
  excerpt: z.string().trim().min(50).max(320),
  contentMarkdown: z.string().trim().min(200).max(60000),
  category: z.string().trim().min(2).max(60),
  tags: z.array(z.string().trim().min(2).max(50)).max(12),
  primaryKeyword: z.string().trim().min(2).max(100).nullable(),
  seoTitle: z.string().trim().min(10).max(70).nullable(),
  seoDescription: z.string().trim().min(50).max(170).nullable(),
  coverImageUrl: z.string().url().nullable(),
  coverImageAlt: z.string().trim().min(5).max(180).nullable(),
  authorName: z.string().trim().min(2).max(80),
  status: z.enum(["draft", "published", "archived"]),
}).refine((value) => Boolean(value.coverImageUrl) === Boolean(value.coverImageAlt), { message: "Kapak görseli ve alternatif metni birlikte girilmeli." });

const fields = "id,slug,title,excerpt,content_markdown,category,tags,primary_keyword,seo_title,seo_description,cover_image_url,cover_image_alt,author_name,status,published_at,created_at,updated_at";

export async function GET() {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin.from("blog_posts").select(fields).order("updated_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: "Blog yazıları yüklenemedi." }, { status: 503 });
  return NextResponse.json({ posts: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Yazı alanlarını kontrol edin." }, { status: 400 });
  const row = toRow(parsed.data, auth.user.id);
  const { data, error } = await auth.admin.from("blog_posts").insert({ ...row, created_by: auth.user.id }).select(fields).single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Bu URL kısa adı zaten kullanılıyor." : "Yazı kaydedilemedi." }, { status: 500 });
  await auth.session.rpc("write_admin_audit", { event_action: "blog.post.created", event_target_type: "blog_post", event_target_id: data.id, event_metadata: { slug: data.slug, status: data.status } });
  invalidateBlog(data.slug);
  return NextResponse.json({ post: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(["owner", "bot_editor"]);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => null) as ({ id?: unknown } & Record<string, unknown>) | null;
  const id = z.string().uuid().safeParse(body?.id);
  const parsed = postSchema.safeParse(body);
  if (!id.success || !parsed.success) return NextResponse.json({ error: parsed.success ? "Yazı kimliği geçersiz." : parsed.error.issues[0]?.message ?? "Yazı alanlarını kontrol edin." }, { status: 400 });
  const { data: existing } = await auth.admin.from("blog_posts").select("slug,published_at").eq("id", id.data).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Yazı bulunamadı." }, { status: 404 });
  const row = toRow(parsed.data, auth.user.id, existing.published_at);
  const { data, error } = await auth.admin.from("blog_posts").update(row).eq("id", id.data).select(fields).single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Bu URL kısa adı zaten kullanılıyor." : "Yazı güncellenemedi." }, { status: 500 });
  await auth.session.rpc("write_admin_audit", { event_action: "blog.post.updated", event_target_type: "blog_post", event_target_id: data.id, event_metadata: { slug: data.slug, status: data.status } });
  invalidateBlog(existing.slug); invalidateBlog(data.slug);
  return NextResponse.json({ post: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Yazı kimliği geçersiz." }, { status: 400 });
  const { data: existing } = await auth.admin.from("blog_posts").select("slug,cover_image_url").eq("id", id.data).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Yazı bulunamadı." }, { status: 404 });
  const { error } = await auth.admin.from("blog_posts").delete().eq("id", id.data);
  if (error) return NextResponse.json({ error: "Yazı silinemedi." }, { status: 500 });
  await auth.session.rpc("write_admin_audit", { event_action: "blog.post.deleted", event_target_type: "blog_post", event_target_id: id.data, event_metadata: { slug: existing.slug } });
  invalidateBlog(existing.slug);
  return NextResponse.json({ deleted: true });
}

function toRow(value: z.infer<typeof postSchema>, userId: string, publishedAt?: string | null) {
  return { slug: value.slug, title: value.title, excerpt: value.excerpt, content_markdown: value.contentMarkdown, category: value.category, tags: [...new Set(value.tags.map((tag) => tag.toLocaleLowerCase("tr-TR")))], primary_keyword: value.primaryKeyword, seo_title: value.seoTitle, seo_description: value.seoDescription, cover_image_url: value.coverImageUrl, cover_image_alt: value.coverImageAlt, author_name: value.authorName, status: value.status, published_at: value.status === "published" ? publishedAt ?? new Date().toISOString() : publishedAt ?? null, updated_by: userId, updated_at: new Date().toISOString() };
}

function invalidateBlog(slug: string) {
  revalidatePath("/blog"); revalidatePath(`/blog/${slug}`); revalidatePath("/sitemap.xml");
}

