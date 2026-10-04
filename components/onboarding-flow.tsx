"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { PhotoCropper } from "@/components/photo-cropper";
import { HistoryBackButton } from "@/components/history-back-button";
import {
  icebreakerOptions,
  intentionOptions,
  lifestyleOptions,
  type OnboardingPayload,
} from "@/lib/profile-options";
import { turkishCities } from "@/lib/turkish-cities";

const steps = ["Sen", "Aradığın", "Fotoğraflar", "Niyet", "Yaşam", "İmza"];
const emptyForm: OnboardingPayload = {
  name: "",
  birthDate: "",
  gender: "",
  city: "",
  phone: "",
  badgeSlugs: [],
  prompt: icebreakerOptions[0],
  answer: "",
  minAge: 18,
  maxAge: 80,
  interestedGenders: ["kadın", "erkek", "nonbinary", "other"],
  sameCityOnly: false,
  relationshipGoal: "",
  maritalStatus: "",
  hasChildren: null,
  childrenPreference: "",
  district: "",
  alcoholUse: "",
  smokingUse: "",
  petPreference: "",
  sportsHabit: "",
  heightCm: null,
  educationLevel: "",
  languages: [],
};

export type InitialOnboardingProfile = OnboardingPayload & {
  photos: { id: string; url: string; status: string }[];
  completed?: boolean;
};

export function OnboardingFlow({
  initialProfile,
  demoMode = false,
}: {
  initialProfile?: InitialOnboardingProfile;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const demoProfile = useMemo<InitialOnboardingProfile>(
    () => ({
      name: "Deniz",
      birthDate: "1999-05-18",
      gender: "kadın",
      city: "İstanbul",
      phone: "",
      badgeSlugs: ["adventure", "coffee"],
      prompt: icebreakerOptions[0],
      answer:
        "Plansız bir sahil kaçamağı için kusursuz çalma listesini bulmak.",
      minAge: 22,
      maxAge: 36,
      interestedGenders: ["kadın", "erkek"],
      sameCityOnly: true,
      relationshipGoal: "serious",
      maritalStatus: "never_married",
      hasChildren: false,
      childrenPreference: "open",
      district: "Kadıköy",
      alcoholUse: "socially",
      smokingUse: "never",
      petPreference: "likes_pets",
      sportsHabit: "regularly",
      heightCm: 168,
      educationLevel: "bachelor",
      languages: ["Türkçe", "İngilizce"],
      photos: [
        { id: "demo-1", url: "/profiles/defne.png", status: "approved" },
        { id: "demo-2", url: "/profiles/lara.png", status: "approved" },
      ],
      completed: true,
    }),
    [],
  );
  const seed = initialProfile ?? (demoMode ? demoProfile : undefined);
  const [form, setForm] = useState<OnboardingPayload>(seed ?? emptyForm);
  const [existingPhotos, setExistingPhotos] = useState(seed?.photos ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(() => initialStep(seed));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(
    () => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)),
    [previews],
  );
  const photos = [
    ...existingPhotos.map((photo) => ({ ...photo, file: null as File | null })),
    ...previews.map(({ file, url }) => ({
      id: `${file.name}-${file.lastModified}`,
      url,
      status: "local",
      file,
    })),
  ];

  function update<K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function toggleBadge(slug: string) {
    const selected = form.badgeSlugs.includes(slug);
    if (!selected && form.badgeSlugs.length >= 3)
      return setError("En fazla üç niyet rozeti seçebilirsin.");
    update(
      "badgeSlugs",
      selected
        ? form.badgeSlugs.filter((item) => item !== slug)
        : [...form.badgeSlugs, slug],
    );
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    const remaining = Math.max(0, 6 - photos.length);
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    const accepted = incoming
      .filter(
        (file) =>
          allowed.has(file.type) &&
          file.size > 0 &&
          file.size <= 12 * 1024 * 1024,
      )
      .slice(0, remaining);
    setCropQueue((current) => [...current, ...accepted]);
    setError(
      incoming.some((file) => !allowed.has(file.type))
        ? "JPG, PNG, WebP veya HEIC fotoğraf seç."
        : incoming.some(
              (file) => file.size === 0 || file.size > 12 * 1024 * 1024,
            )
          ? "Fotoğraf boş olamaz ve en fazla 12 MB olabilir."
          : incoming.length > accepted.length
            ? "En fazla 6 fotoğraf ekleyebilirsin."
            : "",
    );
    event.target.value = "";
  }

  function validate(targetStep = step) {
    if (targetStep === 0) {
      if (form.name.trim().length < 2)
        return "İsmini en az iki karakterle yaz.";
      if (!form.birthDate) return "Doğum tarihini seç.";
      const adultCutoff = new Date();
      adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
      if (new Date(`${form.birthDate}T00:00:00`) > adultCutoff)
        return "Lovask yalnızca 18 yaş ve üzeri içindir.";
      if (!form.gender) return "Cinsiyetini seç.";
      if (form.city.trim().length < 2) return "Şehir seç.";
    }
    if (targetStep === 1 && form.interestedGenders.length < 1)
      return "Tanışmak istediğin en az bir seçeneği işaretle.";
    if (targetStep === 1 && form.minAge > form.maxAge)
      return "Yaş aralığını kontrol et.";
    if (
      targetStep === 2 &&
      !photos.some((photo) => photo.status !== "rejected")
    )
      return "En az bir fotoğraf eklemelisin.";
    if (targetStep === 3 && form.badgeSlugs.length < 1)
      return "Seni anlatan en az bir rozet seç.";
    if (
      targetStep === 4 &&
      form.heightCm !== null &&
      (form.heightCm < 120 || form.heightCm > 230)
    )
      return "Boy bilgisini 120–230 cm arasında gir.";
    if (targetStep === 5 && form.answer.trim().length < 1)
      return "İmza cevabını yaz.";
    return "";
  }

  function next() {
    const problem = validate();
    if (problem) return setError(problem);
    setError("");
    setStep((current) => Math.min(5, current + 1));
  }

  async function complete() {
    for (const targetStep of [0, 1, 2, 3, 4, 5]) {
      const problem = validate(targetStep);
      if (problem) {
        setStep(targetStep);
        setError(problem);
        return;
      }
    }
    setSaving(true);
    setError("");
    if (demoMode) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      router.push("/demo?onboarding=complete");
      return;
    }
    try {
      const saved = await apiRequest("/api/profile/onboarding", {
        action: "save",
        ...form,
      });
      if (!saved.profileId) throw new Error("Profil oluşturulamadı.");
      const uploadBatch = [...files];
      for (let index = 0; index < uploadBatch.length; index++) {
        const body = new FormData();
        body.append("photo", uploadBatch[index]);
        const response = await fetch("/api/profile/photos", {
          method: "POST",
          body,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.error ?? "Fotoğraf yüklenemedi.");
        if (result.photo?.id && result.photo?.url)
          setExistingPhotos((current) => [...current, result.photo]);
        setFiles((current) =>
          current.filter((file) => file !== uploadBatch[index]),
        );
        setUploadProgress(Math.round(((index + 1) / uploadBatch.length) * 100));
      }
      const finalized = await apiRequest("/api/profile/onboarding", {
        action: "finalize",
      });
      if (!finalized.completed)
        throw new Error("Profil tamamlanamadı. Lütfen yeniden dene.");
      window.location.replace("/?onboarding=complete");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Profil tamamlanamadı.",
      );
      setSaving(false);
    }
  }

  async function removePhoto(photo: PhotoItem) {
    if (
      seed?.completed &&
      photo.status === "approved" &&
      existingPhotos.filter(
        (item) => item.id !== photo.id && item.status === "approved",
      ).length === 0
    )
      return setError(
        "Tamamlanmış profilinde en az bir onaylı fotoğraf kalmalı.",
      );
    if (photo.file) {
      setFiles((current) => current.filter((item) => item !== photo.file));
      return;
    }
    if (demoMode) {
      setExistingPhotos((current) =>
        current.filter((item) => item.id !== photo.id),
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/profile/photos", { photoId: photo.id }, "DELETE");
      setExistingPhotos((current) =>
        current.filter((item) => item.id !== photo.id),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Fotoğraf kaldırılamadı.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <main className="flow-stage">
        <section className="flow-shell">
          <header className="flow-header">
            <HistoryBackButton
              fallback="/?tab=profile"
              className="icon-button"
              label="Önceki sayfaya dön"
            >
              <ArrowLeft size={19} />
            </HistoryBackButton>
            <Brand compact />
            <span className="step-count">{step + 1}/6</span>
          </header>
          <div className="step-track">
            {steps.map((label, index) => (
              <span key={label} className={index <= step ? "active" : ""}>
                <i />
              </span>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.section
              className="flow-content"
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.22 }}
            >
              {step === 0 && <IdentityStep form={form} update={update} />}
              {step === 1 && <DiscoveryStep form={form} update={update} />}
              {step === 2 && (
                <PhotoStep
                  photos={photos}
                  fileInputRef={inputRef}
                  onFiles={addPhotos}
                  removePhoto={removePhoto}
                />
              )}
              {step === 3 && (
                <IntentStep form={form} update={update} toggle={toggleBadge} />
              )}
              {step === 4 && <LifestyleStep form={form} update={update} />}
              {step === 5 && (
                <PromptStep
                  prompt={form.prompt}
                  answer={form.answer}
                  update={update}
                />
              )}
            </motion.section>
          </AnimatePresence>
          <div className="flow-feedback" aria-live="polite">
            {saving ? (
              <>
                <LoaderCircle className="spin" size={14} />{" "}
                {files.length && uploadProgress
                  ? `Fotoğraflar hazırlanıyor · %${uploadProgress}`
                  : "Profilin hazırlanıyor…"}
              </>
            ) : (
              error
            )}
          </div>
          <footer className="flow-footer">
            {step > 0 ? (
              <button
                type="button"
                className="back-button"
                disabled={saving}
                onClick={() => {
                  setError("");
                  setStep((value) => value - 1);
                }}
              >
                Geri
              </button>
            ) : (
              <span />
            )}
            {step < 5 ? (
              <button type="button" className="flow-next" onClick={next}>
                Devam et <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                className="flow-next"
                disabled={saving}
                onClick={complete}
              >
                {saving ? "Hazırlanıyor" : "Profili tamamla"}{" "}
                {saving ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}
              </button>
            )}
          </footer>
        </section>
      </main>
      {cropQueue[0] ? (
        <PhotoCropper
          key={`${cropQueue[0].name}-${cropQueue[0].lastModified}`}
          file={cropQueue[0]}
          remaining={cropQueue.length}
          onConfirm={(cropped) => {
            setFiles((current) => [...current, cropped]);
            setCropQueue((current) => current.slice(1));
            setError("");
          }}
          onCancel={() => setCropQueue((current) => current.slice(1))}
        />
      ) : null}
    </>
  );
}

function IdentityStep({
  form,
  update,
}: {
  form: OnboardingPayload;
  update: <K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) => void;
}) {
  return (
    <>
      <small className="eyebrow">Tanışalım</small>
      <h1>
        Sana nasıl
        <br />
        hitap edelim?
      </h1>
      <p>
        Buradaki bilgiler iyi bir ilk izlenimin temelini kurar. Doğum tarihin
        profilinde görünmez.
      </p>
      <label className="field">
        <span>İsmin</span>
        <input
          autoComplete="name"
          maxLength={60}
          placeholder="Örn. Deniz"
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Doğum tarihi</span>
          <input
            type="date"
            value={form.birthDate}
            onChange={(event) => update("birthDate", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Cinsiyet</span>
          <select
            value={form.gender}
            onChange={(event) => update("gender", event.target.value)}
          >
            <option value="">Seç</option>
            <option value="kadın">Kadın</option>
            <option value="erkek">Erkek</option>
            <option value="nonbinary">Non-binary</option>
            <option value="other">Kendimi farklı tanımlıyorum</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Şehir</span>
        <select
          value={form.city}
          onChange={(event) => update("city", event.target.value)}
        >
          <option value="">Şehir seç</option>
          {form.city &&
          !turkishCities.includes(
            form.city as (typeof turkishCities)[number],
          ) ? (
            <option value={form.city}>{form.city}</option>
          ) : null}
          {turkishCities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const genderChoices = [
  ["kadın", "Kadın"],
  ["erkek", "Erkek"],
  ["nonbinary", "Non-binary"],
  ["other", "Diğer"],
] as const;

function DiscoveryStep({
  form,
  update,
}: {
  form: OnboardingPayload;
  update: <K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) => void;
}) {
  const toggleGender = (
    value: OnboardingPayload["interestedGenders"][number],
  ) => {
    const selected = form.interestedGenders.includes(value);
    update(
      "interestedGenders",
      selected
        ? form.interestedGenders.filter((item) => item !== value)
        : [...form.interestedGenders, value],
    );
  };
  const everyone = form.interestedGenders.length === genderChoices.length;
  return (
    <>
      <small className="eyebrow">Aradığın bağ</small>
      <h1>
        Kimlerle
        <br />
        tanışmak istersin?
      </h1>
      <p>
        Tercihlerin yalnızca keşfet sonuçlarını şekillendirir; dilediğin zaman
        değiştirebilirsin.
      </p>
      <div className="intent-grid preference-genders">
        <button
          type="button"
          className={everyone ? "selected" : ""}
          onClick={() =>
            update(
              "interestedGenders",
              genderChoices.map(([value]) => value),
            )
          }
        >
          Herkes{everyone ? <Check size={14} /> : null}
        </button>
        {genderChoices.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={form.interestedGenders.includes(value) ? "selected" : ""}
            onClick={() => toggleGender(value)}
          >
            {label}
            {form.interestedGenders.includes(value) ? (
              <Check size={14} />
            ) : null}
          </button>
        ))}
      </div>
      <div className="field-row discovery-age">
        <label className="field">
          <span>En az yaş</span>
          <input
            type="number"
            min={18}
            max={form.maxAge}
            value={form.minAge}
            onChange={(event) => update("minAge", Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>En çok yaş</span>
          <input
            type="number"
            min={form.minAge}
            max={99}
            value={form.maxAge}
            onChange={(event) => update("maxAge", Number(event.target.value))}
          />
        </label>
      </div>
      <label className="preference-check">
        <input
          type="checkbox"
          checked={form.sameCityOnly}
          onChange={(event) => update("sameCityOnly", event.target.checked)}
        />
        <span>Yalnızca benim şehrimdeki profilleri göster</span>
      </label>
    </>
  );
}

type PhotoItem = { id: string; url: string; status: string; file: File | null };
function PhotoStep({
  photos,
  fileInputRef,
  onFiles,
  removePhoto,
}: {
  photos: PhotoItem[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (photo: PhotoItem) => void;
}) {
  return (
    <>
      <small className="eyebrow">Sahne senin</small>
      <h1>
        Bir bakış,
        <br />
        bir hikâye.
      </h1>
      <p>
        1–6 fotoğraf ekle. Profilini tamamlamak için bir fotoğrafın onaylanmalı.
        İlk fotoğraf kapağın; yüklenen her görsel otomatik olarak hafif WebP
        biçimine çevrilir.
      </p>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={onFiles}
      />
      <div className="photo-grid">
        {Array.from({ length: 6 }, (_, index) => {
          const photo = photos[index];
          return photo ? (
            <div className="photo-slot filled" key={photo.id}>
              <Image
                src={photo.url}
                alt={`Profil fotoğrafı ${index + 1}`}
                fill
                sizes="150px"
                unoptimized={
                  photo.url.startsWith("blob:") ||
                  photo.url.includes("/storage/v1/object/sign/")
                }
              />
              {index === 0 && <b>Kapak</b>}
              {photo.status === "pending" && (
                <small className="photo-state">İncelemede</small>
              )}
              <button
                type="button"
                aria-label="Fotoğrafı kaldır"
                onClick={() => removePhoto(photo)}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              key={index}
              className="photo-slot"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="slot-number">0{index + 1}</span>
              <ImagePlus size={20} />
              <small>{index === 0 ? "Kapak" : "Ekle"}</small>
            </button>
          );
        })}
      </div>
      <div className="flow-tip">
        <Sparkles size={16} /> Fotoğrafını sürükle, yakınlaştır ve oranını seç.
        JPG, PNG, WebP ve HEIC · en fazla 12 MB.
      </div>
    </>
  );
}

function IntentStep({
  form,
  update,
  toggle,
}: {
  form: OnboardingPayload;
  update: <K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) => void;
  toggle: (slug: string) => void;
}) {
  return (
    <>
      <small className="eyebrow">Niyetini göster</small>
      <h1>
        Nasıl bir bağ
        <br />
        arıyorsun?
      </h1>
      <p>Bu bilgiler daha uyumlu kişilerle karşılaşmana yardım eder.</p>
      <label className="field">
        <span>
          İlişki amacın <small>İsteğe bağlı</small>
        </span>
        <select
          value={form.relationshipGoal}
          onChange={(event) =>
            update(
              "relationshipGoal",
              event.target.value as OnboardingPayload["relationshipGoal"],
            )
          }
        >
          <option value="">Belirtme</option>
          <option value="marriage">Evlilik</option>
          <option value="serious">Ciddi ilişki</option>
          <option value="dating">Tanışma ve flört</option>
          <option value="short_term">Kısa süreli ilişki</option>
          <option value="friendship">Arkadaşlık</option>
          <option value="unsure">Henüz emin değilim</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>
            Medeni durum <small>İsteğe bağlı</small>
          </span>
          <select
            value={form.maritalStatus}
            onChange={(event) =>
              update(
                "maritalStatus",
                event.target.value as OnboardingPayload["maritalStatus"],
              )
            }
          >
            <option value="">Belirtme</option>
            <option value="never_married">Hiç evlenmedim</option>
            <option value="divorced">Boşandım</option>
            <option value="widowed">Eşim vefat etti</option>
            <option value="separated">Ayrı yaşıyorum</option>
            <option value="married">Evliyim</option>
          </select>
        </label>
        <label className="field">
          <span>
            Çocuğun var mı? <small>İsteğe bağlı</small>
          </span>
          <select
            value={form.hasChildren === null ? "" : String(form.hasChildren)}
            onChange={(event) =>
              update(
                "hasChildren",
                event.target.value === ""
                  ? null
                  : event.target.value === "true",
              )
            }
          >
            <option value="">Belirtme</option>
            <option value="false">Hayır</option>
            <option value="true">Evet</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>
          Gelecekte çocuk <small>İsteğe bağlı</small>
        </span>
        <select
          value={form.childrenPreference}
          onChange={(event) =>
            update(
              "childrenPreference",
              event.target.value as OnboardingPayload["childrenPreference"],
            )
          }
        >
          <option value="">Belirtme</option>
          <option value="want">İstiyorum</option>
          <option value="do_not_want">İstemiyorum</option>
          <option value="open">Doğru kişiyle olabilir</option>
          <option value="unsure">Henüz emin değilim</option>
        </select>
      </label>
      <p>Seni anlatan en fazla üç rozet seç.</p>
      <div className="intent-grid">
        {intentionOptions.map((item) => (
          <button
            type="button"
            key={item.slug}
            className={form.badgeSlugs.includes(item.slug) ? "selected" : ""}
            onClick={() => toggle(item.slug)}
          >
            {item.label}
            {form.badgeSlugs.includes(item.slug) && <Check size={14} />}
          </button>
        ))}
      </div>
      <small className="selection-count">
        {form.badgeSlugs.length}/3 seçildi
      </small>
    </>
  );
}

function LifestyleStep({
  form,
  update,
}: {
  form: OnboardingPayload;
  update: <K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) => void;
}) {
  return (
    <>
      <small className="eyebrow">Günlük hayatın</small>
      <h1>
        Uyumu biraz
        <br />
        daha yakınlaştır.
      </h1>
      <p>
        Bu alanlar isteğe bağlıdır. Doldurdukların Noir uyum filtrelerinde
        kullanılabilir.
      </p>
      <label className="field">
        <span>İlçe</span>
        <input
          maxLength={80}
          placeholder="Kadıköy"
          value={form.district}
          onChange={(event) => update("district", event.target.value)}
        />
      </label>
      <div className="field-row">
        <OptionField
          label="Alkol"
          value={form.alcoholUse}
          options={lifestyleOptions.alcohol}
          onChange={(value) =>
            update("alcoholUse", value as OnboardingPayload["alcoholUse"])
          }
        />
        <OptionField
          label="Sigara"
          value={form.smokingUse}
          options={lifestyleOptions.smoking}
          onChange={(value) =>
            update("smokingUse", value as OnboardingPayload["smokingUse"])
          }
        />
      </div>
      <div className="field-row">
        <OptionField
          label="Evcil hayvan"
          value={form.petPreference}
          options={lifestyleOptions.pets}
          onChange={(value) =>
            update("petPreference", value as OnboardingPayload["petPreference"])
          }
        />
        <OptionField
          label="Spor"
          value={form.sportsHabit}
          options={lifestyleOptions.sports}
          onChange={(value) =>
            update("sportsHabit", value as OnboardingPayload["sportsHabit"])
          }
        />
      </div>
      <div className="field-row">
        <label className="field">
          <span>Boy (cm)</span>
          <input
            type="number"
            min={120}
            max={230}
            placeholder="170"
            value={form.heightCm ?? ""}
            onChange={(event) =>
              update(
                "heightCm",
                event.target.value ? event.target.valueAsNumber : null,
              )
            }
          />
        </label>
        <OptionField
          label="Eğitim"
          value={form.educationLevel}
          options={lifestyleOptions.education}
          onChange={(value) =>
            update(
              "educationLevel",
              value as OnboardingPayload["educationLevel"],
            )
          }
        />
      </div>
      <label className="field">
        <span>
          Diller <small>Virgülle ayır</small>
        </span>
        <input
          maxLength={180}
          placeholder="Türkçe, İngilizce"
          value={form.languages.join(", ")}
          onChange={(event) =>
            update(
              "languages",
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 10),
            )
          }
        />
      </label>
    </>
  );
}

function OptionField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Belirtme</option>
        {options.map(([key, text]) => (
          <option value={key} key={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function PromptStep({
  prompt,
  answer,
  update,
}: {
  prompt: string;
  answer: string;
  update: <K extends keyof OnboardingPayload>(
    key: K,
    value: OnboardingPayload[K],
  ) => void;
}) {
  return (
    <>
      <small className="eyebrow">İmza cümlen</small>
      <h1>
        Sohbete bir
        <br />
        kapı arala.
      </h1>
      <p>İnsanların sana yazmasını kolaylaştıracak bir soru seç.</p>
      <label className="field">
        <span>Buz kırıcı</span>
        <select
          value={prompt}
          onChange={(event) => update("prompt", event.target.value)}
        >
          {icebreakerOptions.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Cevabın</span>
        <textarea
          maxLength={160}
          value={answer}
          onChange={(event) => update("answer", event.target.value)}
          placeholder="Plansız bir sahil kaçamağı ve doğru çalma listesi…"
        />
        <small>{answer.length}/160</small>
      </label>
    </>
  );
}

async function apiRequest(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "İşlem tamamlanamadı.");
  return result as Record<string, unknown>;
}

function initialStep(profile?: InitialOnboardingProfile) {
  if (!profile || profile.completed) return 0;
  if (profile.name.trim().length < 2 || !profile.birthDate || !profile.gender)
    return 0;
  if (profile.interestedGenders.length < 1) return 1;
  if (!profile.photos.some((photo) => photo.status !== "rejected")) return 2;
  if (profile.badgeSlugs.length < 1) return 3;
  return 4;
}
