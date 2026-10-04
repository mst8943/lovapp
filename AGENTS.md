<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proje devri

Her sohbetin başında `PROJECT_HANDOFF.md` dosyasını oku. Oradaki **Son aşamada yapılacaklar** bölümünü, tamamlanana kadar sohbet sonunda kalan işler arasında belirt. Canlı veritabanı veya üretim ortamında değişiklik yapmadan önce ilgili işi ve etkisini açıkça değerlendir.

## Ekonomik ajan akışı

- Ana ajan Astra'dır. Açık kapsamlı, birden fazla dosyayı etkileyen kod işlerinde uygulamayı `luna_implementer` ajanına ver; tamamlanan değişikliği ardından `sol_reviewer` ajanına incelet. Son kararı, gerekli düzeltmeleri ve kullanıcıya sonucu ana ajan toparlar.
- Kısa sorular, basit ve düşük etkili düzenlemeler, tek adımlı kontroller için alt ajan başlatma. İnceleme ihtiyacı olmayan küçük değişiklikte Luna ve Sol'u sırf akışı tamamlamak için çalıştırma.
- Alt ajanları aynı dosyada eşzamanlı çalıştırma; yalnızca ilgili dosyaları ve beklenen sonucu paylaş. Önceki ajanların uzun günlüklerini sonraki ajana taşıma, kısa sonuç özeti ver.
- Canlı yayın ve üretim verisi değişikliklerini ana ajan yönetir; mevcut proje devri ve onay kuralları geçerlidir.
