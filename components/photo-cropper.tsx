"use client";

import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import "./photo-cropper.css";
import { Check, Crop, LoaderCircle, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useDialog } from "@/lib/use-dialog";

const presets = [
  { key: "portrait", label: "Dikey 4:5", aspect: 4 / 5, width: 1080, height: 1350 },
  { key: "square", label: "Kare", aspect: 1, width: 1080, height: 1080 },
  { key: "classic", label: "Portre 3:4", aspect: 3 / 4, width: 1080, height: 1440 },
] as const;

export function PhotoCropper({ file, remaining, onConfirm, onCancel }: {
  file: File;
  remaining: number;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
  const [source, setSource] = useState("");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [presetKey, setPresetKey] = useState<(typeof presets)[number]["key"]>("portrait");
  const [pixels, setPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const dialog = useDialog(() => { if (!saving) onCancel(); });
  const [error, setError] = useState("");
  const preset = presets.find((item) => item.key === presetKey) ?? presets[0];

  useEffect(() => {
    let active = true;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (active && typeof reader.result === "string") setSource(reader.result);
    });
    reader.readAsDataURL(file);
    return () => {
      active = false;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);

  const save = async () => {
    if ((!pixels && !isHeic) || saving) return;
    setSaving(true); setError("");
    try {
      onConfirm(isHeic ? file : await renderCrop(source, pixels!, preset.width, preset.height, file.name));
    } catch {
      setError("Bu fotoğraf tarayıcıda açılamadı. JPG, PNG veya WebP olarak yeniden seç.");
      setSaving(false);
    }
  };

  return <div ref={dialog} tabIndex={-1} className="crop-backdrop" role="dialog" aria-modal="true" aria-labelledby="crop-title">
    <section className="crop-studio">
      <header><div><small>Fotoğraf mührü · {remaining} kaldı</small><h2 id="crop-title">Kadrajını seç</h2></div><Crop size={22} /></header>
      {isHeic ? <div className="crop-heic"><Crop size={34} /><strong>HEIC otomatik hazırlanacak</strong><span>Tarayıcı önizlemesi yerine fotoğraf sunucuda ortalanmış Dikey 4:5 kadraja alınacak ve WebP’ye çevrilecek.</span></div> : <>
        <div className="crop-stage">
          {source ? <Cropper image={source} crop={crop} zoom={zoom} aspect={preset.aspect} objectFit="cover" showGrid cropShape="rect" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_area, croppedPixels) => setPixels(croppedPixels)} /> : <LoaderCircle className="spin" size={28} />}
        </div>
        <div className="crop-presets" aria-label="Fotoğraf oranı">{presets.map((item) => <button type="button" key={item.key} className={presetKey === item.key ? "active" : ""} onClick={() => { setPresetKey(item.key); setCrop({ x: 0, y: 0 }); }}>{item.label}</button>)}</div>
        <label className="crop-zoom"><ZoomIn size={16} /><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Yakınlaştır" /><b>{Math.round(zoom * 100)}%</b></label>
        <p>Sürükleyerek konumlandır. Seçtiğin alan 1080 px genişliğinde WebP olarak hazırlanır.</p>
      </>}
      {error ? <div className="crop-error" role="alert">{error}</div> : null}
      <footer><button type="button" className="crop-cancel" onClick={onCancel} disabled={saving}>Bu fotoğrafı geç</button><button type="button" className="crop-apply" onClick={save} disabled={(!pixels && !isHeic) || saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? "Hazırlanıyor" : isHeic ? "Otomatik hazırla" : "Kırp ve ekle"}</button></footer>
    </section>
  </div>;
}

async function renderCrop(source: string, area: Area, width: number, height: number, originalName: string) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("canvas_unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .86));
  if (!blob) throw new Error("crop_failed");
  const base = originalName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "lovask-photo";
  return new File([blob], `${base}-cropped.webp`, { type: "image/webp", lastModified: Date.now() });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}
