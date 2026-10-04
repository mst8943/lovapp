import Link from "next/link";

const linkPattern = /\[([^\]]+)\]\(((?:https:\/\/|\/)[^)]+)\)/g;

function InlineContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(linkPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    const external = match[2].startsWith("https://");
    parts.push(external
      ? <a key={`${index}-${match[2]}`} href={match[2]} rel="noopener noreferrer">{match[1]}</a>
      : <Link key={`${index}-${match[2]}`} href={match[2]}>{match[1]}</Link>);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function BlogContent({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return <div className="article-content">{blocks.map((block, index) => {
    if (block.startsWith("### ")) return <h3 key={index}><InlineContent text={block.slice(4)} /></h3>;
    if (block.startsWith("## ")) return <h2 key={index}><InlineContent text={block.slice(3)} /></h2>;
    if (block.startsWith("> ")) return <blockquote key={index}><InlineContent text={block.slice(2)} /></blockquote>;
    const lines = block.split("\n");
    if (lines.every((line) => line.startsWith("- "))) return <ul key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}><InlineContent text={line.slice(2)} /></li>)}</ul>;
    if (lines.every((line) => /^\d+\.\s/.test(line))) return <ol key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}><InlineContent text={line.replace(/^\d+\.\s/, "")} /></li>)}</ol>;
    return <p key={index}><InlineContent text={lines.join(" ")} /></p>;
  })}</div>;
}
