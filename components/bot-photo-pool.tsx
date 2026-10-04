"use client";

import Image from "next/image";
import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Images,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Gender = "kadın" | "erkek";
type AgeBand = "18-24" | "25-34" | "35-44" | "45+";
type SetItem = {
  id: string;
  path: string;
  sortOrder: number;
  width: number;
  height: number;
  sizeBytes: number;
  url: string | null;
};
type PhotoSet = {
  id: string;
  gender: Gender;
  ageBand: AgeBand;
  status: "available" | "assigning" | "assigned" | "archived";
  assignedProfileId: string | null;
  assignedProfileName: string | null;
  createdAt: string;
  items: SetItem[];
};
type LegacyPhoto = {
  path: string;
  gender: Gender;
  name: string;
  sizeBytes: number;
  url: string | null;
};
type EligibleBot = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  ageBand: AgeBand;
  createdAt: string;
};
type Proposal = {
  setId: string;
  profileId: string;
  profileName: string;
  age: number;
};
type PoolPayload = {
  sets: PhotoSet[];
  legacy: LegacyPhoto[];
  eligibleBots: EligibleBot[];
  proposals: Proposal[];
};
type WorkspacePhoto = {
  id: string;
  url: string | null;
  sortOrder: number;
  isPrimary: boolean;
  sourceSetId: string | null;
};
type WorkspaceBot = {
  id: string;
  name: string;
  age: number;
  ageBand: AgeBand;
  gender: string;
  discoverable: boolean;
  photos: WorkspacePhoto[];
};

const ageBands: AgeBand[] = ["18-24", "25-34", "35-44", "45+"];
const emptyPool: PoolPayload = {
  sets: [],
  legacy: [],
  eligibleBots: [],
  proposals: [],
};
const photoDragType = "application/x-lovask-bot-photo";

export function BotPhotoPool({
  onAssigned,
}: {
  onAssigned: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"sets" | "workspace">("sets");
  return (
    <section className="admin-panel bot-photo-pool" id="bot-photo-pool">
      <header className="photo-studio-head">
        <div>
          <small>Kimlik kontrollü görsel operasyonu</small>
          <h2>Bot fotoğraf stüdyosu</h2>
          <p>
            Aynı kişinin fotoğraflarını birlikte tut, hatalı atamaları tek tek
            düzelt.
          </p>
        </div>
        <div
          className="photo-studio-tabs"
          role="tablist"
          aria-label="Fotoğraf stüdyosu"
        >
          <button
            role="tab"
            aria-selected={tab === "sets"}
            className={tab === "sets" ? "active" : ""}
            onClick={() => setTab("sets")}
          >
            <Images size={15} /> Kişi setleri
          </button>
          <button
            role="tab"
            aria-selected={tab === "workspace"}
            className={tab === "workspace" ? "active" : ""}
            onClick={() => setTab("workspace")}
          >
            <GripVertical size={15} /> Düzenleme masası
          </button>
        </div>
      </header>
      {tab === "sets" ? (
        <SetPool onAssigned={onAssigned} />
      ) : (
        <PhotoWorkspace onChanged={onAssigned} />
      )}
    </section>
  );
}

function SetPool({ onAssigned }: { onAssigned: () => Promise<void> }) {
  const [data, setData] = useState<PoolPayload>(emptyPool);
  const [notice, setNotice] = useState("Kişi setleri yükleniyor…");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [assignments, setAssignments] = useState<Proposal[]>([]);
  const [legacySelection, setLegacySelection] = useState<string[]>([]);
  const [legacyAgeBand, setLegacyAgeBand] = useState<AgeBand>("25-34");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/bot-photo-pool", {
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Kişi setleri yüklenemedi.");
      return;
    }
    setData({
      sets: body.sets ?? [],
      legacy: body.legacy ?? [],
      eligibleBots: body.eligibleBots ?? [],
      proposals: body.proposals ?? [],
    });
    setNotice("");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const available = data.sets.filter((set) => set.status === "available");
  const assigned = data.sets.filter((set) => set.status !== "available");
  const selectedLegacy = data.legacy.filter((item) =>
    legacySelection.includes(item.path),
  );
  const legacyGender = selectedLegacy[0]?.gender;
  const canGroupLegacy =
    selectedLegacy.length >= 1 &&
    selectedLegacy.length <= 6 &&
    selectedLegacy.every((item) => item.gender === legacyGender);

  const openPreview = () => {
    setAssignments(data.proposals);
    setPreviewing(true);
  };
  const confirmAssignments = async () => {
    if (!assignments.length) return;
    setBusy(true);
    setNotice(`${assignments.length} kişi seti botlara aktarılıyor…`);
    const response = await fetch("/api/admin/bot-photo-pool", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: assignments.map(({ setId, profileId }) => ({
          setId,
          profileId,
        })),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? `${body.assigned ?? 0} kişi seti atandı${body.failed ? `, ${body.failed} atama tamamlanamadı` : ""}.`
        : (body.error ?? "Setler atanamadı."),
    );
    setBusy(false);
    setPreviewing(false);
    if (response.ok) await Promise.all([load(), onAssigned()]);
  };
  const groupLegacy = async () => {
    if (!canGroupLegacy || !legacyGender) return;
    setBusy(true);
    setNotice("Gruplanmamış fotoğraflardan kişi seti oluşturuluyor…");
    const response = await fetch("/api/admin/bot-photo-pool", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paths: legacySelection,
        gender: legacyGender,
        ageBand: legacyAgeBand,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? "Kişi seti oluşturuldu."
        : (body.error ?? "Fotoğraflar gruplanamadı."),
    );
    setBusy(false);
    if (response.ok) {
      setLegacySelection([]);
      await load();
    }
  };
  const removeSet = async (set: PhotoSet) => {
    if (
      !window.confirm(`${set.items.length} fotoğraflık hazır set silinsin mi?`)
    )
      return;
    setBusy(true);
    const response = await fetch("/api/admin/bot-photo-pool", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: set.id }),
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok ? "Kişi seti silindi." : (body.error ?? "Set silinemedi."),
    );
    setBusy(false);
    if (response.ok) await load();
  };
  const clearPool = async () => {
    const photoCount =
      available.reduce((sum, set) => sum + set.items.length, 0) +
      data.legacy.length;
    if (!photoCount) return;
    const confirmation = window.prompt(
      `${available.length} hazır set ve toplam ${photoCount} havuz fotoğrafı kalıcı olarak silinecek. Atanmış setlere dokunulmayacak. Devam etmek için TEMİZLE yaz.`,
    );
    if (confirmation !== "TEMİZLE") return;
    setBusy(true);
    setNotice("Hazır fotoğraf havuzu temizleniyor…");
    const response = await fetch("/api/admin/bot-photo-pool", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAvailable: true }),
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? `${body.sets ?? 0} set ve ${body.photos ?? 0} fotoğraf havuzdan temizlendi.`
        : (body.error ?? "Havuz temizlenemedi."),
    );
    setBusy(false);
    if (response.ok) {
      setLegacySelection([]);
      await load();
    }
  };

  return (
    <div className="set-pool-stage">
      <div className="set-pool-toolbar">
        <div className="set-pool-metrics">
          <span>
            <b>{available.length}</b> hazır set
          </span>
          <span>
            <b>{data.eligibleBots.length}</b> fotoğrafsız bot
          </span>
          <span>
            <b>{data.legacy.length}</b> gruplanmamış
          </span>
        </div>
        <button
          className="set-secondary"
          type="button"
          disabled={busy}
          onClick={() => setCreating(true)}
        >
          <ImagePlus size={15} /> Yeni kişi seti
        </button>
        <button
          className="set-danger"
          type="button"
          disabled={
            busy || (available.length === 0 && data.legacy.length === 0)
          }
          onClick={() => void clearPool()}
        >
          <Trash2 size={15} /> Havuzu temizle
        </button>
        <button
          className="pool-assign"
          type="button"
          disabled={busy || data.proposals.length === 0}
          onClick={openPreview}
        >
          <Sparkles size={15} />
          {data.proposals.length
            ? `${data.proposals.length} eşleşmeyi incele`
            : "Uygun eşleşme yok"}
        </button>
      </div>
      {notice ? (
        <p className="admin-data-status pool-notice">{notice}</p>
      ) : null}

      <section className="photo-set-section">
        <header>
          <div>
            <small>Atama kuyruğu</small>
            <h3>Hazır kişi setleri</h3>
          </div>
          <p>Kapaktaki yıldız, bota aktarılacak ana fotoğrafı gösterir.</p>
        </header>
        {available.length ? (
          <div className="photo-set-grid">
            {available.map((set) => (
              <PhotoSetCard
                key={set.id}
                set={set}
                onRemove={() => void removeSet(set)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Images />}
            title="Hazır set yok"
            detail="Aynı kişiye ait 1–6 fotoğrafla ilk seti oluştur."
          />
        )}
      </section>

      {data.legacy.length ? (
        <section className="photo-set-section legacy-tray">
          <header>
            <div>
              <small>Güvenli geçiş</small>
              <h3>Gruplanmamış fotoğraflar</h3>
            </div>
            <p>Aynı kişiye ait 1–6 fotoğrafı seç.</p>
          </header>
          <div className="legacy-grid">
            {data.legacy.map((photo) => {
              const selected = legacySelection.includes(photo.path);
              const disabledByGender = Boolean(
                legacyGender && legacyGender !== photo.gender && !selected,
              );
              return (
                <button
                  type="button"
                  key={photo.path}
                  disabled={disabledByGender}
                  className={selected ? "selected" : ""}
                  onClick={() =>
                    setLegacySelection((current) =>
                      selected
                        ? current.filter((path) => path !== photo.path)
                        : current.length < 6
                          ? [...current, photo.path]
                          : current,
                    )
                  }
                >
                  {photo.url ? (
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      sizes="100px"
                      unoptimized
                    />
                  ) : (
                    <Camera />
                  )}
                  <span>
                    {selected ? (
                      <Check />
                    ) : photo.gender === "kadın" ? (
                      "K"
                    ) : (
                      "E"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <footer className="legacy-actions">
            <span>{legacySelection.length}/6 seçildi</span>
            <select
              aria-label="Görünen yaş aralığı"
              value={legacyAgeBand}
              onChange={(event) =>
                setLegacyAgeBand(event.target.value as AgeBand)
              }
            >
              {ageBands.map((band) => (
                <option key={band}>{band}</option>
              ))}
            </select>
            <button
              disabled={busy || !canGroupLegacy}
              onClick={() => void groupLegacy()}
            >
              Seçilenlerden set oluştur
            </button>
          </footer>
        </section>
      ) : null}

      {assigned.length ? (
        <details className="assigned-sets">
          <summary>{assigned.length} atanım arşivini göster</summary>
          <div className="photo-set-grid">
            {assigned.map((set) => (
              <PhotoSetCard key={set.id} set={set} />
            ))}
          </div>
        </details>
      ) : null}
      {creating ? (
        <CreateSetDialog
          busy={busy}
          onClose={() => setCreating(false)}
          onCreated={async (message) => {
            setCreating(false);
            setNotice(message);
            await load();
          }}
        />
      ) : null}
      {previewing ? (
        <AssignmentDialog
          sets={available}
          eligibleBots={data.eligibleBots}
          assignments={assignments}
          busy={busy}
          onAssignments={setAssignments}
          onClose={() => setPreviewing(false)}
          onConfirm={() => void confirmAssignments()}
        />
      ) : null}
    </div>
  );
}

function PhotoSetCard({
  set,
  onRemove,
}: {
  set: PhotoSet;
  onRemove?: () => void;
}) {
  return (
    <article className={`photo-set-card ${set.status}`}>
      <div className="photo-set-strip">
        {set.items.map((item, index) => (
          <span key={item.id}>
            {item.url ? (
              <Image src={item.url} alt="" fill sizes="110px" unoptimized />
            ) : (
              <Camera />
            )}
            {index === 0 ? (
              <i>
                <Sparkles />
              </i>
            ) : null}
          </span>
        ))}
      </div>
      <footer>
        <div>
          <strong>
            {set.gender === "kadın" ? "Kadın" : "Erkek"} · {set.ageBand}
          </strong>
          <small>
            {set.items.length} fotoğraf
            {set.assignedProfileName
              ? ` · ${set.assignedProfileName}`
              : " · atama bekliyor"}
          </small>
        </div>
        {onRemove ? (
          <button type="button" aria-label="Seti sil" onClick={onRemove}>
            <Trash2 />
          </button>
        ) : (
          <span className="set-lock">Atandı</span>
        )}
      </footer>
    </article>
  );
}

function CreateSetDialog({
  busy,
  onClose,
  onCreated,
}: {
  busy: boolean;
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const [files, setFiles] = useState<Array<{ file: File; preview: string }>>(
    [],
  );
  const [gender, setGender] = useState<Gender>("kadın");
  const [ageBand, setAgeBand] = useState<AgeBand>("25-34");
  const [message, setMessage] = useState("");
  const dragIndex = useRef<number | null>(null);
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).slice(0, 6);
    event.target.value = "";
    files.forEach((item) => URL.revokeObjectURL(item.preview));
    setFiles(
      selected.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    );
  };
  const move = (from: number, to: number) =>
    setFiles((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const upload = async () => {
    if (files.length < 1) return setMessage("En az 1 fotoğraf seçin.");
    setMessage("Set işleniyor…");
    const form = new FormData();
    form.set("gender", gender);
    form.set("ageBand", ageBand);
    files.forEach(({ file }) => form.append("photos", file));
    const response = await fetch("/api/admin/bot-photo-pool", {
      method: "POST",
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.error ?? "Set oluşturulamadı.");
    files.forEach((item) => URL.revokeObjectURL(item.preview));
    await onCreated(
      "Kişi seti hazır. Atama önizlemesinden hedef botu kontrol edebilirsiniz.",
    );
  };
  return (
    <div className="photo-dialog-backdrop" role="presentation">
      <section
        className="photo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-set-title"
      >
        <header>
          <div>
            <small>Yeni kimlik paketi</small>
            <h3 id="new-set-title">Kişi seti oluştur</h3>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X />
          </button>
        </header>
        <p>
          Bir veya daha fazla fotoğraf seçin. Birden fazlaysa aynı ya da
          belirgin biçimde benzer kişiye ait olmalı; soldaki ilk fotoğraf kapak
          olur.
        </p>
        <div className="set-form-fields">
          <label>
            Cinsiyet
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender)}
            >
              <option value="kadın">Kadın</option>
              <option value="erkek">Erkek</option>
            </select>
          </label>
          <label>
            Görünen yaş
            <select
              value={ageBand}
              onChange={(event) => setAgeBand(event.target.value as AgeBand)}
            >
              {ageBands.map((band) => (
                <option key={band}>{band}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="set-file-drop">
          <Upload />
          <strong>
            {files.length ? "Fotoğrafları değiştir" : "1–6 fotoğraf seç"}
          </strong>
          <span>JPG, PNG, WebP veya HEIC · dosya başına en fazla 12 MB</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={choose}
          />
        </label>
        {files.length ? (
          <div className="set-order-strip">
            {files.map((item, index) => (
              <div
                key={`${item.file.name}-${item.file.lastModified}`}
                draggable
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current !== null && dragIndex.current !== index)
                    move(dragIndex.current, index);
                  dragIndex.current = null;
                }}
              >
                <Image
                  src={item.preview}
                  alt=""
                  fill
                  sizes="100px"
                  unoptimized
                />
                <span>{index === 0 ? "Kapak" : index + 1}</span>
                <button
                  type="button"
                  aria-label="Sola taşı"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  aria-label="Sağa taşı"
                  disabled={index === files.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronRight />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {message ? <p className="dialog-notice">{message}</p> : null}
        <footer>
          <button type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button
            className="confirm"
            type="button"
            disabled={busy || files.length < 1 || files.length > 6}
            onClick={() => void upload()}
          >
            {busy ? "Kaydediliyor…" : "Seti kaydet"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AssignmentDialog({
  sets,
  eligibleBots,
  assignments,
  busy,
  onAssignments,
  onClose,
  onConfirm,
}: {
  sets: PhotoSet[];
  eligibleBots: EligibleBot[];
  assignments: Proposal[];
  busy: boolean;
  onAssignments: (items: Proposal[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const setMap = new Map(sets.map((set) => [set.id, set]));
  const updateTarget = (setId: string, profileId: string) => {
    const bot = eligibleBots.find((item) => item.id === profileId);
    if (!bot) return;
    onAssignments(
      assignments.map((item) =>
        item.setId === setId
          ? { ...item, profileId: bot.id, profileName: bot.name, age: bot.age }
          : item,
      ),
    );
  };
  return (
    <div className="photo-dialog-backdrop">
      <section
        className="photo-dialog assignment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-title"
      >
        <header>
          <div>
            <small>Son kontrol</small>
            <h3 id="assignment-title">Set–bot eşleşmeleri</h3>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose}>
            <X />
          </button>
        </header>
        <p>
          Yalnızca cinsiyet ve yaş aralığı birebir uyuşan fotoğrafsız botlar
          listelenir.
        </p>
        <div className="assignment-list">
          {assignments.map((assignment) => {
            const set = setMap.get(assignment.setId);
            if (!set) return null;
            const usedByOther = new Set(
              assignments
                .filter((item) => item.setId !== assignment.setId)
                .map((item) => item.profileId),
            );
            const candidates = eligibleBots.filter(
              (bot) =>
                bot.gender === set.gender &&
                bot.ageBand === set.ageBand &&
                !usedByOther.has(bot.id),
            );
            return (
              <article key={assignment.setId}>
                <span>
                  {set.items[0]?.url ? (
                    <Image
                      src={set.items[0].url}
                      alt=""
                      fill
                      sizes="64px"
                      unoptimized
                    />
                  ) : (
                    <Camera />
                  )}
                  <i>{set.items.length} fotoğraf</i>
                </span>
                <ArrowRight />
                <label>
                  <small>
                    {set.gender === "kadın" ? "Kadın" : "Erkek"} · {set.ageBand}
                  </small>
                  <select
                    value={assignment.profileId}
                    onChange={(event) =>
                      updateTarget(assignment.setId, event.target.value)
                    }
                  >
                    {candidates.map((bot) => (
                      <option value={bot.id} key={bot.id}>
                        {bot.name} · {bot.age}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button
            className="confirm"
            disabled={busy || assignments.length === 0}
            onClick={onConfirm}
          >
            {busy ? "Atanıyor…" : `${assignments.length} seti ata`}
          </button>
        </footer>
      </section>
    </div>
  );
}

function PhotoWorkspace({ onChanged }: { onChanged: () => Promise<void> }) {
  const [bots, setBots] = useState<WorkspaceBot[]>([]);
  const [notice, setNotice] = useState("Bot fotoğrafları yükleniyor…");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<"all" | Gender>("all");
  const [countFilter, setCountFilter] = useState<
    "all" | "empty" | "single" | "full"
  >("all");
  const [dragged, setDragged] = useState<{
    photoId: string;
    sourceProfileId: string;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [moveMenu, setMoveMenu] = useState<{
    photoId: string;
    sourceProfileId: string;
  } | null>(null);
  const [moveSearch, setMoveSearch] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/bot-photo-workspace", {
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Fotoğraf masası yüklenemedi.");
      return;
    }
    setBots(body.bots ?? []);
    setNotice("");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const visible = useMemo(
    () =>
      bots.filter(
        (bot) =>
          bot.name
            .toLocaleLowerCase("tr-TR")
            .includes(search.toLocaleLowerCase("tr-TR")) &&
          (gender === "all" || bot.gender === gender) &&
          (countFilter === "all" ||
            (countFilter === "empty" && bot.photos.length === 0) ||
            (countFilter === "single" && bot.photos.length === 1) ||
            (countFilter === "full" && bot.photos.length === 6)),
      ),
    [bots, countFilter, gender, search],
  );

  const movePhoto = async (
    photoId: string,
    sourceProfileId: string,
    targetProfileId: string,
    targetPosition?: number,
    confirmed = false,
  ) => {
    if (sourceProfileId === targetProfileId) return;
    setBusy(true);
    setNotice("Fotoğraf yeni bota taşınıyor…");
    const response = await fetch("/api/admin/bot-photo-workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        photoId,
        targetProfileId,
        targetPosition,
        confirmEmptySource: confirmed,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (body.requiresConfirmation && !confirmed) {
      setBusy(false);
      if (window.confirm(`${body.error}\n\nYine de taşınsın mı?`))
        await movePhoto(
          photoId,
          sourceProfileId,
          targetProfileId,
          targetPosition,
          true,
        );
      return;
    }
    setNotice(
      response.ok
        ? "Fotoğraf taşındı."
        : (body.error ?? "Fotoğraf taşınamadı."),
    );
    setBusy(false);
    setMoveMenu(null);
    setDragged(null);
    if (response.ok) await Promise.all([load(), onChanged()]);
  };
  const setPrimary = async (photoId: string) => {
    setBusy(true);
    const response = await fetch("/api/admin/bot-photo-workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_primary", photoId }),
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? "Ana fotoğraf değiştirildi."
        : (body.error ?? "Ana fotoğraf değiştirilemedi."),
    );
    setBusy(false);
    if (response.ok) await load();
  };
  const uploadToBot = async (
    bot: WorkspaceBot,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []).slice(
      0,
      6 - bot.photos.length,
    );
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let uploaded = 0;
    for (const file of files) {
      const form = new FormData();
      form.set("profileId", bot.id);
      form.set("photo", file);
      const response = await fetch("/api/admin/bots/photo", {
        method: "POST",
        body: form,
      });
      if (response.ok) uploaded += 1;
    }
    setNotice(`${uploaded} fotoğraf ${bot.name} profiline eklendi.`);
    setBusy(false);
    await Promise.all([load(), onChanged()]);
  };
  const allowDrop = (event: DragEvent, target: WorkspaceBot) => {
    event.preventDefault();
    const payloadAvailable =
      event.dataTransfer.types.includes(photoDragType) || Boolean(dragged);
    if (
      !payloadAvailable ||
      target.photos.length >= 6 ||
      dragged?.sourceProfileId === target.id
    ) {
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.dataTransfer.dropEffect = "move";
    setDragTarget(target.id);
  };
  const drop = (
    event: DragEvent,
    target: WorkspaceBot,
    targetPosition?: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget(null);
    let payload = dragged;
    try {
      const transferred = event.dataTransfer.getData(photoDragType);
      if (transferred)
        payload = JSON.parse(transferred) as {
          photoId: string;
          sourceProfileId: string;
        };
    } catch {
      /* Fall back to the in-memory drag state. */
    }
    if (
      !payload ||
      target.photos.length >= 6 ||
      payload.sourceProfileId === target.id
    )
      return;
    void movePhoto(
      payload.photoId,
      payload.sourceProfileId,
      target.id,
      targetPosition,
    );
  };

  const moveTargets = moveMenu
    ? bots
        .filter(
          (bot) =>
            bot.id !== moveMenu.sourceProfileId &&
            bot.photos.length < 6 &&
            bot.name
              .toLocaleLowerCase("tr-TR")
              .includes(moveSearch.toLocaleLowerCase("tr-TR")),
        )
        .slice(0, 30)
    : [];
  return (
    <div className="photo-workspace">
      <div className="workspace-toolbar">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Bot adı ara…"
          />
        </label>
        <select
          aria-label="Cinsiyet filtresi"
          value={gender}
          onChange={(event) => setGender(event.target.value as "all" | Gender)}
        >
          <option value="all">Tüm cinsiyetler</option>
          <option value="kadın">Kadın</option>
          <option value="erkek">Erkek</option>
        </select>
        <select
          aria-label="Fotoğraf sayısı filtresi"
          value={countFilter}
          onChange={(event) =>
            setCountFilter(event.target.value as typeof countFilter)
          }
        >
          <option value="all">Tüm fotoğraf sayıları</option>
          <option value="empty">Fotoğrafsız</option>
          <option value="single">Tek fotoğraflı</option>
          <option value="full">Limiti dolu</option>
        </select>
        <span>{visible.length} bot</span>
      </div>
      {notice ? (
        <p className="admin-data-status pool-notice">{notice}</p>
      ) : null}
      <div className="bot-photo-board">
        {visible.map((bot) => (
          <article
            key={bot.id}
            className={`photo-bot-card ${dragged && dragged.sourceProfileId !== bot.id && bot.photos.length < 6 ? "accepts-drop" : ""} ${dragTarget === bot.id ? "drop-target" : ""}`}
            onDragOver={(event) => allowDrop(event, bot)}
            onDrop={(event) => drop(event, bot)}
          >
            <header>
              <div>
                <span>
                  {bot.photos[0]?.url ? (
                    <Image
                      src={bot.photos[0].url}
                      alt=""
                      fill
                      sizes="42px"
                      unoptimized
                      draggable={false}
                    />
                  ) : (
                    <Bot />
                  )}
                </span>
                <div>
                  <strong>{bot.name}</strong>
                  <small>
                    {bot.age} · {bot.gender} · {bot.ageBand}
                  </small>
                </div>
              </div>
              <i className={bot.photos.length < 1 ? "needs-photo" : ""}>
                {bot.photos.length}/6
              </i>
            </header>
            <div className="bot-photo-film">
              {bot.photos.map((photo, index) => (
                <div
                  className={`workspace-photo ${photo.isPrimary ? "primary" : ""}`}
                  key={photo.id}
                  draggable={!busy}
                  onDragStart={(event) => {
                    const payload = {
                      photoId: photo.id,
                      sourceProfileId: bot.id,
                    };
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      photoDragType,
                      JSON.stringify(payload),
                    );
                    event.dataTransfer.setData("text/plain", photo.id);
                    setDragged(payload);
                  }}
                  onDragEnd={() => {
                    setDragged(null);
                    setDragTarget(null);
                  }}
                  onDragOver={(event) => allowDrop(event, bot)}
                  onDrop={(event) => drop(event, bot, index)}
                >
                  {photo.url ? (
                    <Image
                      src={photo.url}
                      alt={`${bot.name} fotoğraf ${index + 1}`}
                      fill
                      sizes="120px"
                      unoptimized
                      draggable={false}
                    />
                  ) : (
                    <Camera />
                  )}
                  <span>{photo.isPrimary ? "Ana" : index + 1}</span>
                  <div className="workspace-photo-actions">
                    {!photo.isPrimary ? (
                      <button
                        type="button"
                        title="Ana fotoğraf yap"
                        onClick={() => void setPrimary(photo.id)}
                      >
                        <Sparkles />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Başka bota taşı"
                      onClick={() => {
                        setMoveMenu({
                          photoId: photo.id,
                          sourceProfileId: bot.id,
                        });
                        setMoveSearch("");
                      }}
                    >
                      <ArrowRight />
                    </button>
                  </div>
                </div>
              ))}
              {bot.photos.length < 6 ? (
                <label
                  className="workspace-add-photo"
                  onDragOver={(event) => allowDrop(event, bot)}
                  onDrop={(event) => drop(event, bot)}
                >
                  <ImagePlus />
                  <span>
                    {bot.photos.length === 1
                      ? "Eşleşen fotoğraf ekle"
                      : "Fotoğraf ekle"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                    onChange={(event) => void uploadToBot(bot, event)}
                  />
                </label>
              ) : null}
            </div>
            <footer>
              {bot.photos.length === 0 ? (
                <span>Fotoğrafsız · keşfette gösterilmez</span>
              ) : (
                <span>
                  {bot.discoverable ? "Keşfete hazır" : "Keşfet kapalı"}
                </span>
              )}
              <small>Fotoğrafı hedef karta veya belirli sıraya bırak</small>
            </footer>
          </article>
        ))}
      </div>
      {!notice && visible.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Bot bulunamadı"
          detail="Arama veya filtreleri değiştirin."
        />
      ) : null}
      {moveMenu ? (
        <div className="photo-dialog-backdrop">
          <section
            className="photo-dialog move-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-photo-title"
          >
            <header>
              <div>
                <small>Manuel hedef seçimi</small>
                <h3 id="move-photo-title">Başka bota taşı</h3>
              </div>
              <button aria-label="Kapat" onClick={() => setMoveMenu(null)}>
                <X />
              </button>
            </header>
            <label className="move-search">
              <Search />
              <input
                autoFocus
                value={moveSearch}
                onChange={(event) => setMoveSearch(event.target.value)}
                placeholder="Hedef botu ara…"
              />
            </label>
            <div className="move-target-list">
              {moveTargets.map((bot) => (
                <button
                  type="button"
                  key={bot.id}
                  onClick={() =>
                    void movePhoto(
                      moveMenu.photoId,
                      moveMenu.sourceProfileId,
                      bot.id,
                    )
                  }
                >
                  <span>
                    {bot.photos[0]?.url ? (
                      <Image
                        src={bot.photos[0].url}
                        alt=""
                        fill
                        sizes="42px"
                        unoptimized
                      />
                    ) : (
                      <Bot />
                    )}
                  </span>
                  <div>
                    <strong>{bot.name}</strong>
                    <small>
                      {bot.age} · {bot.gender}
                    </small>
                  </div>
                  <i>{bot.photos.length}/6</i>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="pool-empty">
      {icon}
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
