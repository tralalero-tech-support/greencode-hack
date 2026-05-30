"use client";

import { useState, useRef, useLayoutEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Version  { id: string; label: string; date: string; author: string }
interface FileItem { id: string; name: string; ext: string; versions: Version[]; creator?: string; purpose?: string }
interface Folder   { id: string; name: string; files: FileItem[]; creator?: string; purpose?: string }

// ── Initial data ─────────────────────────────────────────────────────────────

const INIT: Folder[] = [
  {
    id: "pres", name: "Presentations",
    files: [
      { id: "fp", name: "Final Presentation", ext: "pptx", versions: [
        { id: "fp-v3", label: "Policy framework added", date: "2d ago", author: "Isha"     },
        { id: "fp-v2", label: "Blue Economy section",   date: "1w ago", author: "Asmita"   },
        { id: "fp-v1", label: "Initial draft",          date: "3w ago", author: "Ansh"     },
      ]},
      { id: "sd", name: "Slide Deck v1", ext: "pptx", versions: [
        { id: "sd-v2", label: "Food Security branch",   date: "1w ago", author: "Isha"     },
        { id: "sd-v1", label: "Original",               date: "2w ago", author: "Ansh"     },
      ]},
    ],
  },
  {
    id: "research", name: "Research",
    files: [
      { id: "paper",  name: "Final Paper",      ext: "pdf",  versions: [
        { id: "pa-v2", label: "Updated conclusion",        date: "1d ago", author: "Asmita"   },
        { id: "pa-v1", label: "First draft",               date: "2w ago", author: "Nathalie" },
      ]},
      { id: "survey", name: "Survey Questions", ext: "docx", versions: [
        { id: "su-v2", label: "Satellite questions added", date: "5d ago", author: "Nathalie" },
        { id: "su-v1", label: "Base survey",               date: "3w ago", author: "Asmita"   },
      ]},
    ],
  },
  {
    id: "jobs", name: "Job Applications",
    files: [
      { id: "bofa", name: "Resume – BofA", ext: "pdf", versions: [
        { id: "bo-v4", label: "Tailored for BofA", date: "1w ago", author: "Ansh" },
        { id: "bo-v3", label: "Finance focus",     date: "2w ago", author: "Ansh" },
      ]},
    ],
  },
];

const EXT_ICON: Record<string, string> = {
  pptx: "📊", pdf: "📕", docx: "📄", xlsx: "📈",
};

// ── SVG connector ─────────────────────────────────────────────────────────────

interface Line { x1: number; y1: number; x2: number; y2: number; color: string }

function elbowD(x1: number, y1: number, x2: number, y2: number, R = 8): string {
  if (Math.abs(y1 - y2) < 1) return `M ${x1} ${y1} H ${x2}`;
  const mx = (x1 + x2) / 2;
  const s  = y2 > y1 ? 1 : -1;
  const r  = Math.min(R, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1) / 4);
  return [
    `M ${x1} ${y1}`,
    `H ${mx - r}`,
    `Q ${mx} ${y1} ${mx} ${y1 + s * r}`,
    `V ${y2 - s * r}`,
    `Q ${mx} ${y2} ${mx + r} ${y2}`,
    `H ${x2}`,
  ].join(" ");
}

// ── UID ───────────────────────────────────────────────────────────────────────

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

// ── Shared micro-UI ───────────────────────────────────────────────────────────

const INPUT    = "flex-1 text-xs bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-600 pb-px text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 min-w-0";
const BTN_OK   = "text-[10px] text-green-500 hover:text-green-400 shrink-0";
const BTN_X    = "text-[10px] text-zinc-400 hover:text-zinc-300 shrink-0";
const BTN_ADD  = "text-[10px] text-zinc-400 hover:text-green-500 transition-colors";

function InlineForm({ placeholder, onConfirm, onCancel }: {
  placeholder: string; onConfirm: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState("");
  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm(val); }} className="flex items-center gap-1 w-full">
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        placeholder={placeholder} className={INPUT} />
      <button type="submit" className={BTN_OK}>✓</button>
      <button type="button" onClick={onCancel} className={BTN_X}>✕</button>
    </form>
  );
}

// ── Modal types ───────────────────────────────────────────────────────────────

type ModalMode = "file" | "folder";

// ── Main component ────────────────────────────────────────────────────────────

export default function FileGraph() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<Folder[]>(INIT);

  // ── Interaction state ────────────────────────────────────────────────────
  const [pinFolders, setPinFolders] = useState<string[]>([]);
  const [hovFolder,  setHovFolder]  = useState<string | null>(null);
  const [pinFiles,   setPinFiles]   = useState<string[]>([]);
  const [hovFile,    setHovFile]    = useState<string | null>(null);

  // ── Version edit state (kept inline) ────────────────────────────────────
  const [addVerTo,   setAddVerTo]   = useState<string | null>(null);
  const [editVer,    setEditVer]    = useState<string | null>(null);
  const [editVerVal, setEditVerVal] = useState("");

  // ── FAB modal state ───────────────────────────────────────────────────────
  const [modalMode,     setModalMode]     = useState<ModalMode | null>(null);
  const [mName,         setMName]         = useState("");
  const [mCreator,      setMCreator]      = useState("");
  const [mPurpose,      setMPurpose]      = useState("");
  const [mTargetFolder, setMTargetFolder] = useState("");
  const [suggesting,    setSuggesting]    = useState(false);
  const [suggestError,  setSuggestError]  = useState("");

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeFolderIds = [...new Set([...pinFolders, ...(hovFolder ? [hovFolder] : [])])];
  const activeFolders   = folders.filter(f => activeFolderIds.includes(f.id));

  type FilePlus = FileItem & { folderName: string };
  const shownFiles: FilePlus[] = activeFolders.flatMap(f =>
    f.files.map(fi => ({ ...fi, folderName: f.name }))
  );

  const activeFileIds   = [...new Set([...pinFiles, ...(hovFile ? [hovFile] : [])])];
  const activeFilesData = shownFiles.filter(fi => activeFileIds.includes(fi.id));

  type VerPlus = Version & { fileName: string };
  const shownVersions: VerPlus[] = activeFilesData.flatMap(fi =>
    fi.versions.map(v => ({ ...v, fileName: fi.name }))
  );

  // ── Refs for SVG lines ───────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const productRef   = useRef<HTMLDivElement>(null);
  const folderRefs   = useRef<Record<string, HTMLElement | null>>({});
  const fileRefs     = useRef<Record<string, HTMLElement | null>>({});
  const verRefs      = useRef<Record<string, HTMLElement | null>>({});
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    const c = containerRef.current;
    const p = productRef.current;
    if (!c || !p) return;
    const cr = c.getBoundingClientRect();
    const mid = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - cr.left, right: r.right - cr.left, midY: r.top - cr.top + r.height / 2 };
    };
    const pb = mid(p);
    const next: Line[] = [];

    folders.forEach(f => {
      const el = folderRefs.current[f.id]; if (!el) return;
      const fb = mid(el);
      next.push({ x1: pb.right, y1: pb.midY, x2: fb.left, y2: fb.midY, color: "#a1a1aa" });
    });

    activeFolders.forEach(f => {
      const src = folderRefs.current[f.id]; if (!src) return;
      const sb = mid(src);
      f.files.forEach(fi => {
        const el = fileRefs.current[fi.id]; if (!el) return;
        const db = mid(el);
        next.push({ x1: sb.right, y1: sb.midY, x2: db.left, y2: db.midY, color: "#6ee7b7" });
      });
    });

    activeFilesData.forEach(fi => {
      const src = fileRefs.current[fi.id]; if (!src) return;
      const sb = mid(src);
      fi.versions.forEach(v => {
        const el = verRefs.current[v.id]; if (!el) return;
        const db = mid(el);
        next.push({ x1: sb.right, y1: sb.midY, x2: db.left, y2: db.midY, color: "#93c5fd" });
      });
    });

    setLines(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinFolders, hovFolder, pinFiles, hovFile, folders]);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  function doAddFolder(name: string, creator?: string, purpose?: string) {
    if (!name.trim()) return;
    setFolders(p => [...p, { id: uid("f"), name: name.trim(), files: [], creator, purpose }]);
  }

  function doAddFile(folderId: string, name: string, creator?: string, purpose?: string) {
    if (!name.trim()) return;
    setFolders(p => p.map(f => f.id !== folderId ? f : {
      ...f, files: [...f.files, { id: uid("fi"), name: name.trim(), ext: "pdf", versions: [], creator, purpose }],
    }));
  }

  function doAddVersion(fileId: string, label: string) {
    if (!label.trim()) return;
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    setFolders(p => p.map(f => ({
      ...f, files: f.files.map(fi => fi.id !== fileId ? fi : {
        ...fi, versions: [{ id: uid("v"), label: label.trim(), date, author: "You" }, ...fi.versions],
      }),
    })));
    setAddVerTo(null);
  }

  function doEditVersion(verId: string, label: string) {
    if (!label.trim()) { setEditVer(null); return; }
    setFolders(p => p.map(f => ({
      ...f, files: f.files.map(fi => ({
        ...fi, versions: fi.versions.map(v => v.id !== verId ? v : { ...v, label: label.trim() }),
      })),
    })));
    setEditVer(null);
  }

  // ── Pin toggles ───────────────────────────────────────────────────────────

  const togglePinFolder = (id: string) =>
    setPinFolders(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const togglePinFile = (id: string) =>
    setPinFiles(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // ── Modal ─────────────────────────────────────────────────────────────────

  function openModal(mode: ModalMode) {
    setModalMode(mode);
    setMName("");
    setMCreator("");
    setMPurpose("");
    setMTargetFolder(folders[0]?.id ?? "");
    setSuggestError("");
  }

  function closeModal() { setModalMode(null); }

  async function suggestName() {
    setSuggesting(true);
    setSuggestError("");
    const existingNames = folders.flatMap(f => [f.name, ...f.files.map(fi => fi.name)]);
    try {
      const res = await fetch("/api/suggest-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingNames, addingType: modalMode, purpose: mPurpose }),
      });
      const data = await res.json();
      if (data.name) setMName(data.name);
      else setSuggestError(data.error || "No suggestion returned");
    } catch {
      setSuggestError("Failed to reach suggestion API");
    } finally {
      setSuggesting(false);
    }
  }

  function handleModalAdd() {
    if (!mName.trim() || !modalMode) return;
    if (modalMode === "folder") {
      doAddFolder(mName, mCreator || undefined, mPurpose || undefined);
    } else {
      doAddFile(mTargetFolder, mName, mCreator || undefined, mPurpose || undefined);
    }
    closeModal();
  }

  // ── Node styles ───────────────────────────────────────────────────────────

  const folderCls = (id: string) => {
    const active = activeFolderIds.includes(id);
    return `flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "border-green-400 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300"
        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
    }`;
  };

  const fileCls = (id: string) => {
    const active = activeFileIds.includes(id);
    return `flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
    }`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef}
      className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">

      {/* SVG connector overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" overflow="visible">
        {lines.map((l, i) => (
          <path key={i} d={elbowD(l.x1, l.y1, l.x2, l.y2)} fill="none" stroke={l.color} strokeWidth={1.5} />
        ))}
      </svg>

      {/* Columns */}
      <div className="relative z-10 flex items-center gap-10 h-full px-8 py-6 overflow-x-auto">

        {/* ── Product ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0">
          <div ref={productRef}
            className="rounded-xl border-2 border-green-500 bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/20 whitespace-nowrap">
            ASEAN Project
          </div>
        </div>

        {/* ── Folders ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          {folders.map(f => (
            <div key={f.id} className="flex flex-col gap-1">
              <div ref={el => { folderRefs.current[f.id] = el; }}
                className={folderCls(f.id)}
                onMouseEnter={() => setHovFolder(f.id)}
                onMouseLeave={() => setHovFolder(null)}
                onClick={() => togglePinFolder(f.id)}>
                <span>📁</span>
                <span>{f.name}</span>
                {f.creator && <span className="text-[10px] opacity-50 font-normal">· {f.creator}</span>}
                {pinFolders.includes(f.id) && <span className="ml-1 text-[10px] opacity-50">📌</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Files ─────────────────────────────────────────────────────────── */}
        {shownFiles.length > 0 && (
          <div className="flex-shrink-0 flex flex-col gap-2">
            {activeFolders.map(folder => (
              <div key={folder.id} className="flex flex-col gap-1.5">
                {activeFolders.length > 1 && (
                  <div className="text-[10px] uppercase tracking-widest text-zinc-400 px-1">{folder.name}</div>
                )}
                {folder.files.map(fi => (
                  <div key={fi.id}
                    ref={el => { fileRefs.current[fi.id] = el; }}
                    className={fileCls(fi.id)}
                    onMouseEnter={() => setHovFile(fi.id)}
                    onMouseLeave={() => setHovFile(null)}
                    onClick={() => togglePinFile(fi.id)}>
                    <span>{EXT_ICON[fi.ext] ?? "📄"}</span>
                    <span>{fi.name}</span>
                    {fi.creator && <span className="text-[10px] opacity-50 font-normal">· {fi.creator}</span>}
                    {pinFiles.includes(fi.id) && <span className="ml-1 text-[10px] opacity-50">📌</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Versions ──────────────────────────────────────────────────────── */}
        {shownVersions.length > 0 && (
          <div className="flex-shrink-0 flex flex-col gap-3">
            {activeFilesData.map(fi => (
              <div key={fi.id} className="flex flex-col gap-1.5">
                {activeFilesData.length > 1 && (
                  <div className="text-[10px] uppercase tracking-widest text-zinc-400 px-1">{fi.name}</div>
                )}

                {fi.versions.map((v, i) => (
                  <div key={v.id} ref={el => { verRefs.current[v.id] = el; }}
                    className={`px-3 py-2 rounded-lg border text-xs whitespace-nowrap ${
                      i === 0
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    }`}>
                    <div className="flex items-start gap-2">
                      <span className={`font-bold shrink-0 ${i === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                        {v.id.split("-").pop()?.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        {editVer === v.id
                          ? <InlineForm placeholder={v.label}
                              onConfirm={val => doEditVersion(v.id, val || v.label)}
                              onCancel={() => setEditVer(null)} />
                          : <div className={`font-medium cursor-text ${i === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-600 dark:text-zinc-300"}`}
                              onClick={() => { setEditVer(v.id); setEditVerVal(v.label); }}>
                              {v.label}
                            </div>
                        }
                        <div className="text-[10px] opacity-50 mt-0.5">{v.date} · {v.author}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* + version inline */}
                <div className="pl-1">
                  {addVerTo === fi.id
                    ? <InlineForm placeholder="Version note…"
                        onConfirm={v => doAddVersion(fi.id, v)} onCancel={() => setAddVerTo(null)} />
                    : <button className={BTN_ADD} onClick={() => setAddVerTo(fi.id)}>+ version</button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-4 text-[10px] text-zinc-400 select-none z-10">
        hover to expand · click to pin 📌
      </div>

      {/* FABs — bottom right */}
      <div className="absolute bottom-3 right-4 flex gap-2 z-10">
        <button
          onClick={() => openModal("folder")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700 transition-colors shadow-md"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 3.5a1 1 0 011-1h2.172a1 1 0 01.707.293L5.586 3.5H10a1 1 0 011 1V9a1 1 0 01-1 1H2a1 1 0 01-1-1V3.5z" fill="currentColor"/>
          </svg>
          Add Folder
        </button>
        <button
          onClick={() => openModal("file")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-500 transition-colors shadow-md"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add File
        </button>
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-72 p-5 flex flex-col gap-3.5">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {modalMode === "file" ? "Add File" : "Add Folder"}
            </h2>

            {/* Folder target — files only */}
            {modalMode === "file" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">Folder</label>
                <select
                  value={mTargetFolder}
                  onChange={e => setMTargetFolder(e.target.value)}
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none"
                >
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Name + AI suggest */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Name</label>
              <div className="flex gap-2">
                <input
                  value={mName}
                  onChange={e => setMName(e.target.value)}
                  placeholder={modalMode === "file" ? "e.g. Research Notes" : "e.g. Data Sources"}
                  className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-green-500"
                />
                <button
                  onClick={suggestName}
                  disabled={suggesting}
                  title="Suggest a name with AI"
                  className="px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
                >
                  {suggesting ? "…" : "✨"}
                </button>
              </div>
              {suggestError && (
                <span className="text-[10px] text-red-500">{suggestError}</span>
              )}
            </div>

            {/* Creator */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">Created by</label>
              <input
                value={mCreator}
                onChange={e => setMCreator(e.target.value)}
                placeholder="e.g. Isha"
                className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Purpose */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">What is it for?</label>
              <textarea
                value={mPurpose}
                onChange={e => setMPurpose(e.target.value)}
                placeholder="e.g. Collecting satellite data references"
                rows={2}
                className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none resize-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={closeModal}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalAdd}
                disabled={!mName.trim()}
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-500 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
