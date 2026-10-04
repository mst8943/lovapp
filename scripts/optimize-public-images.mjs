import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const jobs = [
  ["public/hero_woman.jpg", "public/hero_woman.webp", 1280, 80],
  ["public/hero_man.jpg", "public/hero_man.webp", 1280, 80],
  ["public/profiles/defne.png", "public/profiles/defne.webp", 960, 78],
  ["public/profiles/mert.png", "public/profiles/mert.webp", 960, 78],
  ["public/profiles/lara.png", "public/profiles/lara.webp", 960, 78],
];

for (const [source, destination, width, quality] of jobs) {
  await sharp(path.join(root, source)).rotate().resize({ width, withoutEnlargement: true }).webp({ quality, effort: 5 }).toFile(path.join(root, destination));
  const metadata = await sharp(path.join(root, destination)).metadata();
  console.log(`${destination}: ${metadata.width}x${metadata.height}`);
}
