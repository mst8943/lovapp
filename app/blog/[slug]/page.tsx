import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogContent } from "@/components/blog-content";
import { Brand } from "@/components/brand";
import { getPublishedPost, readingMinutes } from "@/lib/blog";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Yazı bulunamadı", robots: { index: false, follow: false } };
  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? post.excerpt;
  return { title, description, keywords: post.tags, alternates: { canonical: `/blog/${post.slug}` }, openGraph: { type: "article", locale: "tr_TR", url: `/blog/${post.slug}`, title, description, publishedTime: post.published_at ?? undefined, modifiedTime: post.updated_at, authors: [post.author_name], tags: post.tags, images: post.cover_image_url ? [{ url: post.cover_image_url, alt: post.cover_image_alt ?? post.title }] : undefined }, twitter: { card: "summary_large_image", title, description, images: post.cover_image_url ? [post.cover_image_url] : undefined } };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  const published = post.published_at ?? post.created_at;
  const jsonLd = { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.seo_description ?? post.excerpt, image: post.cover_image_url ? [post.cover_image_url] : undefined, datePublished: published, dateModified: post.updated_at, author: { "@type": "Organization", name: post.author_name, url: "https://lovask.com.tr" }, publisher: { "@type": "Organization", name: "Lovask", url: "https://lovask.com.tr", logo: { "@type": "ImageObject", url: "https://lovask.com.tr/logo.png" } }, mainEntityOfPage: `https://lovask.com.tr/blog/${post.slug}`, keywords: post.tags.join(", ") };
  return <main className="blog-stage">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <div className="article-shell">
      <nav className="blog-nav"><Link href="/" aria-label="Lovask ana sayfa"><Brand /></Link><Link href="/blog">Tüm yazılar</Link></nav>
      <article><header className="article-header"><Link className="article-back" href="/blog">← Blog&apos;a dön</Link><span className="blog-kicker">{post.category}</span><h1>{post.title}</h1><p className="article-lead">{post.excerpt}</p><div className="article-byline"><span>{post.author_name}</span><time dateTime={published}>{new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(published))}</time><span>{readingMinutes(post.content_markdown)} dakika okuma</span></div></header>
        {post.cover_image_url ? <div className="article-cover"><Image src={post.cover_image_url} alt={post.cover_image_alt ?? post.title} fill priority sizes="(max-width: 920px) 100vw, 920px" /></div> : null}<BlogContent markdown={post.content_markdown} /><footer className="article-tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</footer></article>
    </div>
  </main>;
}
