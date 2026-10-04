import { ImageResponse } from "next/og";

export const alt = "Lovask — Tesadüften fazlası";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", color: "#f4edf0", background: "radial-gradient(circle at 82% 18%, #6f1a34 0%, #1b1018 35%, #0b090d 74%)" }}><div style={{ display: "flex", alignItems: "center", gap: 16, color: "#d8b56c", fontSize: 28, letterSpacing: 5 }}>LOVASK</div><div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 82, lineHeight: .94, letterSpacing: -3 }}>Tesadüften fazlası.</div><div style={{ marginTop: 28, color: "#b9aab2", fontSize: 29 }}>Niyetlerin görünür, sohbetlerin gerçek.</div></div><div style={{ display: "flex", alignItems: "center", gap: 18, color: "#8f8189", fontSize: 22 }}><span style={{ width: 66, height: 2, background: "#d8b56c" }}/>lovask.com.tr</div></div>, size);
}
