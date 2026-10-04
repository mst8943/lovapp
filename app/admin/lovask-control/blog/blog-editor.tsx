"use client";

/* eslint-disable @next/next/no-img-element -- authenticated editor preview; public covers use next/image */

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  FilePlus2,
  ImagePlus,
  LoaderCircle,
  Save,
  SearchCheck,
  Trash2,
} from "lucide-react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import { useAdminRole } from "@/components/admin-role-context";

type Status = "draft" | "published" | "archived";
type Post = {
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
  status: Status;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
type FormState = {
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  category: string;
  tags: string;
  primaryKeyword: string;
  seoTitle: string;
  seoDescription: string;
  coverImageUrl: string;
  coverImageAlt: string;
  authorName: string;
};
const emptyForm: FormState = {
  slug: "",
  title: "",
  excerpt: "",
  contentMarkdown: "",
  category: "İlişkiler",
  tags: "",
  primaryKeyword: "",
  seoTitle: "",
  seoDescription: "",
  coverImageUrl: "",
  coverImageAlt: "",
  authorName: "Lovask Editörleri",
};

export function BlogEditor() {
  const role = useAdminRole();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState<Status>("draft");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Yazılar yükleniyor…");
  const selectPost = useCallback((post: Post) => {
    setSelectedId(post.id);
    setStatus(post.status);
    setForm({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      contentMarkdown: post.content_markdown,
      category: post.category,
      tags: post.tags.join(", "),
      primaryKeyword: post.primary_keyword ?? "",
      seoTitle: post.seo_title ?? "",
      seoDescription: post.seo_description ?? "",
      coverImageUrl: post.cover_image_url ?? "",
      coverImageAlt: post.cover_image_alt ?? "",
      authorName: post.author_name,
    });
  }, []);
  const load = useCallback(
    async (preferredId?: string) => {
      const response = await fetch("/api/admin/blog", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as {
        posts?: Post[];
        error?: string;
      };
      if (!response.ok) {
        setNotice(body.error ?? "Blog yazıları yüklenemedi.");
        return;
      }
      const next = body.posts ?? [];
      setPosts(next);
      setNotice(next.length ? "" : "Henüz yazı yok. İlk taslağı oluşturun.");
      const target = next.find((post) => post.id === preferredId);
      if (target) selectPost(target);
    },
    [selectPost],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const score = useMemo(() => seoScore(form), [form]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const newPost = () => {
    setSelectedId(null);
    setStatus("draft");
    setForm(emptyForm);
    setNotice("Yeni taslak hazır.");
  };
  const titleChanged = (value: string) => {
    setForm((current) => ({
      ...current,
      title: value,
      slug:
        !selectedId &&
        (!current.slug || current.slug === slugify(current.title))
          ? slugify(value)
          : current.slug,
    }));
  };
  const save = async (nextStatus: Status) => {
    setBusy(true);
    setNotice("");
    const payload = {
      ...(selectedId ? { id: selectedId } : {}),
      slug: form.slug,
      title: form.title,
      excerpt: form.excerpt,
      contentMarkdown: form.contentMarkdown,
      category: form.category,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      primaryKeyword: form.primaryKeyword.trim() || null,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      coverImageUrl: form.coverImageUrl || null,
      coverImageAlt: form.coverImageAlt.trim() || null,
      authorName: form.authorName,
      status: nextStatus,
    };
    try {
      const response = await fetch("/api/admin/blog", {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { post?: Post; error?: string };
      if (!response.ok || !body.post) {
        setNotice(body.error ?? "Yazı kaydedilemedi.");
        return;
      }
      setStatus(body.post.status);
      setSelectedId(body.post.id);
      setNotice(
        nextStatus === "published"
          ? "Yazı yayınlandı."
          : nextStatus === "archived"
            ? "Yazı arşivlendi."
            : "Taslak kaydedildi.",
      );
      await load(body.post.id);
    } catch {
      setNotice("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  };
  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice("Kapak 1600 × 900 WebP olarak hazırlanıyor…");
    const data = new FormData();
    data.set("image", file);
    try {
      const response = await fetch("/api/admin/blog/image", {
        method: "POST",
        body: data,
      });
      const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setNotice(body.error ?? "Kapak yüklenemedi.");
        return;
      }
      set("coverImageUrl", body.url);
      setNotice("Kapak optimize edilip yüklendi.");
    } catch {
      setNotice("Kapak yüklenemedi.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  const remove = async () => {
    if (
      !selectedId ||
      role !== "owner" ||
      !window.confirm("Bu yazıyı kalıcı olarak silmek istiyor musunuz?")
    )
      return;
    setBusy(true);
    const response = await fetch(
      `/api/admin/blog?id=${encodeURIComponent(selectedId)}`,
      { method: "DELETE" },
    );
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setNotice(body.error ?? "Yazı silinemedi.");
    newPost();
    await load();
    setNotice("Yazı silindi.");
  };
  return (
    <main className="ops-stage blog-admin-stage">
      <AdminResourceNav />
      <section className="blog-admin-list">
        <header>
          <div>
            <small>İçerik merkezi</small>
            <h1>Blog</h1>
          </div>
          <button onClick={newPost}>
            <FilePlus2 size={16} /> Yeni yazı
          </button>
        </header>
        <p className="admin-data-status">{notice}</p>
        <div>
          {posts.map((post) => (
            <button
              key={post.id}
              className={selectedId === post.id ? "active" : ""}
              onClick={() => selectPost(post)}
            >
              <i className={post.status} />
              <span>
                <strong>{post.title}</strong>
                <small>/{post.slug}</small>
              </span>
              <em>
                {post.status === "published"
                  ? "Yayında"
                  : post.status === "archived"
                    ? "Arşiv"
                    : "Taslak"}
              </em>
            </button>
          ))}
        </div>
      </section>
      <section className="blog-editor-canvas">
        <header>
          <div>
            <small>{selectedId ? "Yazıyı düzenle" : "Yeni yazı"}</small>
            <h2>{form.title || "Başlıksız taslak"}</h2>
          </div>
          <div>
            {selectedId && status === "published" ? (
              <Link href={`/blog/${form.slug}`} target="_blank">
                Görüntüle <ExternalLink size={14} />
              </Link>
            ) : null}
            <button disabled={busy} onClick={() => void save("draft")}>
              <Save size={15} /> Taslak kaydet
            </button>
            <button
              className="publish"
              disabled={busy || score.total < 60}
              onClick={() => void save("published")}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Check size={15} />
              )}{" "}
              Yayınla
            </button>
          </div>
        </header>
        <div className="blog-editor-grid">
          <form onSubmit={(event) => event.preventDefault()}>
            <label>
              Başlık <span>{form.title.length}/120</span>
              <input
                value={form.title}
                maxLength={120}
                onChange={(event) => titleChanged(event.target.value)}
                placeholder="Okurun sorusuna doğrudan yanıt veren başlık"
              />
            </label>
            <label>
              URL kısa adı <span>{form.slug.length}/100</span>
              <div className="slug-field">
                <b>/blog/</b>
                <input
                  value={form.slug}
                  maxLength={100}
                  onChange={(event) => set("slug", slugify(event.target.value))}
                />
              </div>
            </label>
            <label>
              Özet <span>{form.excerpt.length}/320</span>
              <textarea
                className="excerpt"
                value={form.excerpt}
                maxLength={320}
                onChange={(event) => set("excerpt", event.target.value)}
                placeholder="Arama sonucunda ve blog kartında görünen net özet"
              />
            </label>
            <div className="blog-field-row">
              <label>
                Kategori
                <input
                  value={form.category}
                  maxLength={60}
                  onChange={(event) => set("category", event.target.value)}
                />
              </label>
              <label>
                Yazar
                <input
                  value={form.authorName}
                  maxLength={80}
                  onChange={(event) => set("authorName", event.target.value)}
                />
              </label>
            </div>
            <label>
              İçerik{" "}
              <span>
                {
                  form.contentMarkdown.trim().split(/\s+/).filter(Boolean)
                    .length
                }{" "}
                kelime
              </span>
              <textarea
                className="content"
                value={form.contentMarkdown}
                maxLength={60000}
                onChange={(event) => set("contentMarkdown", event.target.value)}
                placeholder={
                  "## İlk ana bölüm\n\nOkura fayda sağlayan açıklama.\n\n- Uygulanabilir madde\n- İkinci madde\n\n[İlgili Lovask yazısı](/blog/ornek-yazi)"
                }
              />
              <small className="format-help">
                ## ara başlık · ### alt başlık · - liste · [metin](/bağlantı)
              </small>
            </label>
            <label>
              Etiketler{" "}
              <input
                value={form.tags}
                onChange={(event) => set("tags", event.target.value)}
                placeholder="ilk mesaj, ilişki, iletişim"
              />
            </label>
            <section className="cover-upload">
              <div>
                {form.coverImageUrl ? (
                  <img src={form.coverImageUrl} alt="Kapak önizlemesi" />
                ) : (
                  <ImagePlus size={24} />
                )}
              </div>
              <label>
                <ImagePlus size={15} /> Kapak yükle
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => void uploadCover(event)}
                />
              </label>
              <input
                value={form.coverImageAlt}
                maxLength={180}
                onChange={(event) => set("coverImageAlt", event.target.value)}
                placeholder="Kapak görselini erişilebilir biçimde anlatın"
              />
            </section>
            <div className="archive-actions">
              {selectedId ? (
                <button onClick={() => void save("archived")}>Arşivle</button>
              ) : null}
              {selectedId && role === "owner" ? (
                <button className="danger" onClick={() => void remove()}>
                  <Trash2 size={14} /> Kalıcı sil
                </button>
              ) : null}
            </div>
          </form>
          <aside className="seo-rail">
            <section className="seo-score">
              <SearchCheck size={19} />
              <div>
                <small>Yayın kontrolü</small>
                <strong>{score.total}/100</strong>
              </div>
              <i
                style={
                  { "--seo-score": `${score.total}%` } as React.CSSProperties
                }
              />
            </section>
            <ul>
              {score.checks.map((check) => (
                <li className={check.ok ? "ok" : ""} key={check.label}>
                  {check.ok ? <Check size={13} /> : <span />}
                  {check.label}
                </li>
              ))}
            </ul>
            <section className="seo-fields">
              <label>
                Odak anahtar kelime
                <input
                  value={form.primaryKeyword}
                  maxLength={100}
                  onChange={(event) =>
                    set("primaryKeyword", event.target.value)
                  }
                />
              </label>
              <label>
                SEO başlığı <span>{form.seoTitle.length}/70</span>
                <input
                  value={form.seoTitle}
                  maxLength={70}
                  onChange={(event) => set("seoTitle", event.target.value)}
                  placeholder={form.title}
                />
              </label>
              <label>
                Meta açıklama <span>{form.seoDescription.length}/170</span>
                <textarea
                  value={form.seoDescription}
                  maxLength={170}
                  onChange={(event) =>
                    set("seoDescription", event.target.value)
                  }
                  placeholder={form.excerpt}
                />
              </label>
            </section>
            <section className="search-preview">
              <small>Google önizlemesi</small>
              <cite>
                https://lovask.com.tr › blog › {form.slug || "yazi-urlsi"}
              </cite>
              <strong>{form.seoTitle || form.title || "Yazı başlığı"}</strong>
              <p>
                {form.seoDescription ||
                  form.excerpt ||
                  "Arama sonucunda görünecek açıklama."}
              </p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
function seoScore(form: FormState) {
  const keyword = form.primaryKeyword.trim().toLocaleLowerCase("tr-TR");
  const checks = [
    {
      label: "Başlık 30–60 karakter",
      ok: form.title.length >= 30 && form.title.length <= 60,
      points: 15,
    },
    {
      label: "Açıklama 120–160 karakter",
      ok:
        (form.seoDescription || form.excerpt).length >= 120 &&
        (form.seoDescription || form.excerpt).length <= 160,
      points: 15,
    },
    {
      label: "URL kısa ve okunabilir",
      ok:
        form.slug.length >= 3 &&
        form.slug.length <= 70 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug),
      points: 10,
    },
    {
      label: "En az 600 kelime",
      ok:
        form.contentMarkdown.trim().split(/\s+/).filter(Boolean).length >= 600,
      points: 20,
    },
    {
      label: "En az iki ara başlık",
      ok: (form.contentMarkdown.match(/^##\s/gm) ?? []).length >= 2,
      points: 10,
    },
    {
      label: "Odak kelime başlık ve özette",
      ok:
        Boolean(keyword) &&
        form.title.toLocaleLowerCase("tr-TR").includes(keyword) &&
        form.excerpt.toLocaleLowerCase("tr-TR").includes(keyword),
      points: 10,
    },
    {
      label: "Kapak ve alternatif metin",
      ok: Boolean(form.coverImageUrl && form.coverImageAlt.length >= 5),
      points: 10,
    },
    {
      label: "En az bir iç bağlantı",
      ok: /\[[^\]]+\]\(\/[a-z0-9/-]+\)/.test(form.contentMarkdown),
      points: 10,
    },
  ];
  return {
    checks,
    total: checks.reduce(
      (sum, check) => sum + (check.ok ? check.points : 0),
      0,
    ),
  };
}
