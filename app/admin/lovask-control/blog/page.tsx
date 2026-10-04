import type { Metadata } from "next";
import { BlogEditor } from "./blog-editor";
import "./blog-editor.css";

export const metadata: Metadata = { title: "Blog yönetimi", robots: { index: false, follow: false } };

export default function AdminBlogPage() {
  return <BlogEditor />;
}
