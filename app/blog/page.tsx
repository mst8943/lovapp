import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { getPublishedPosts, readingMinutes } from "@/lib/blog";

export const revalidate = 300;

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  const jsonLd = { "@context": "https://schema.org", "@type": "Blog", name: "Lovask Blog", url: "https://lovask.com.tr/blog", description: "Tanışma, iletişim ve ilişki psikolojisi üzerine rehberler.", blogPost: posts.slice(0, 10).map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `https://lovask.com.tr/blog/${post.slug}`, datePublished: post.published_at, dateModified: post.updated_at })) };
  return <main className="blog-stage">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <div className="blog-shell">
      <nav className="blog-nav"><Link href="/" aria-label="Lovask ana sayfa"><Brand /></Link><Link href="/login">Lovask&apos;a katıl</Link></nav>
      <header className="blog-hero"><div><span className="blog-kicker">Lovask notları</span><h1>Yakınlaşmanın daha iyi yolları.</h1><p>İlk mesajdan güvenli buluşmaya, niyetleri açıkça konuşmaktan sağlıklı sınırlar kurmaya kadar ilişki deneyimini güçlendiren yazılar.</p></div><p className="blog-manifesto">Her yazı tek bir soruya net yanıt verir. Arama motoru için değil, gerçekten arayan insanlar için yazılır.</p></header>
      <section className="blog-grid" aria-label="Son yazılar">
        {posts.length === 0 ? <div className="blog-empty"><strong>İlk yazı hazırlanıyor.</strong>Lovask editörleri yakında burada olacak.</div> : posts.map((post) => <Link className="blog-card" href={`/blog/${post.slug}`} key={post.id}>
          <div className="blog-card-media">{post.cover_image_url ? <Image src={post.cover_image_url} alt={post.cover_image_alt ?? ""} fill sizes="(max-width: 560px) 100vw, (max-width: 800px) 50vw, 34vw" /> : null}</div>
          <div className="blog-card-copy"><div className="blog-card-meta"><span>{post.category}</span><span>·</span><span>{readingMinutes(post.content_markdown)} dk okuma</span></div><h2>{post.title}</h2><p>{post.excerpt}</p></div>
        </Link>)}
      </section>
    </div>
  </main>;
}
