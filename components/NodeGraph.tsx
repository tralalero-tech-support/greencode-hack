"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Version  { id: string; label: string; date: string; author: string }
interface FileItem { id: string; name: string; ext: string; versions: Version[] }
interface Folder   { id: string; name: string; files: FileItem[] }

// ── Mock data ──────────────────────────────────────────────────────────────

const PRODUCT = "ASEAN Project";

const FOLDERS: Folder[] = [
  {
    id: "pres", name: "Presentations",
    files: [
      { id: "fp", name: "Final Presentation", ext: "pptx", versions: [
        { id: "fp-v3", label: "Policy framework added", date: "2d ago",  author: "Isha"    },
        { id: "fp-v2", label: "Blue Economy section",   date: "1w ago",  author: "Asmita"  },
        { id: "fp-v1", label: "Initial draft",          date: "3w ago",  author: "Ansh"    },
      ]},
      { id: "sd", name: "Slide Deck v1", ext: "pptx", versions: [
        { id: "sd-v2", label: "Food Security branch",   date: "1w ago",  author: "Isha"    },
        { id: "sd-v1", label: "Original",               date: "2w ago",  author: "Ansh"    },
      ]},
    ],
  },
  {
    id: "research", name: "Research",
    files: [
      { id: "paper", name: "Final Paper",        ext: "pdf",  versions: [
        { id: "pa-v2", label: "Updated conclusion",       date: "1d ago",  author: "Asmita"  },
        { id: "pa-v1", label: "First draft",              date: "2w ago",  author: "Nathalie"},
      ]},
      { id: "survey", name: "Survey Questions", ext: "docx", versions: [
        { id: "su-v2", label: "Satellite questions added", date: "5d ago", author: "Nathalie"},
        { id: "su-v1", label: "Base survey",               date: "3w ago", author: "Asmita"  },
      ]},
    ],
  },
  {
    id: "jobs", name: "Job Applications",
    files: [
      { id: "bofa", name: "Resume – BofA", ext: "pdf", versions: [
        { id: "bo-v4", label: "Tailored for BofA",  date: "1w ago",  author: "Ansh" },
        { id: "bo-v3", label: "Finance focus",       date: "2w ago",  author: "Ansh" },
      ]},
    ],
  },
];

const EXT_ICON: Record<string, string> = {
  pptx: "📊", pdf: "📕", docx: "📄", xlsx: "📈",
};

// ── SVG line helpers ───────────────────────────────────────────────────────

interface LineSpec { x1: number; y1: number; x2: number; y2: number; color: string }

// Smooth S-curve (cubic bezier) between two points
function curvePath({ x1, y1, x2, y2 }: Omit<LineSpec, "color">): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

function getBounds(el: HTMLElement, container: HTMLElement) {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  return {
    left:   er.left   - cr.left,
    right:  er.right  - cr.left,
    top:    er.top    - cr.top,
    bottom: er.bottom - cr.top,
    midY:   er.top    - cr.top + er.height / 2,
    midX:   er.left   - cr.left + er.width  / 2,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FileGraph() {
  const [hoverFolder, setHoverFolder] = useState<string | null>(null);
  const [pinFolder,   setPinFolder]   = useState<string | null>(null);
  const [hoverFile,   setHoverFile]   = useState<string | null>(null);
  const [pinFile,     setPinFile]     = useState<string | null>(null);
  const [lines,       setLines]       = useState<LineSpec[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const productRef   = useRef<HTMLDivElement>(null);
  const folderRefs   = useRef<Record<string, HTMLDivElement | null>>({});
  const fileRefs     = useRef<Record<string, HTMLDivElement | null>>({});
  const versionRefs  = useRef<Record<string, HTMLDivElement | null>>({});

  const activeFolder = pinFolder ?? hoverFolder;
  const activeFile   = pinFile   ?? hoverFile;

  const folderObj = FOLDERS.find(f => f.id === activeFolder) ?? null;
  const fileObj   = folderObj?.files.find(f => f.id === activeFile) ?? null;

  const recalcLines = useCallback(() => {
    const c = containerRef.current;
    const p = productRef.current;
    if (!c || !p) return;

    const newLines: LineSpec[] = [];
    const pb = getBounds(p, c);

    // Product → every folder
    FOLDERS.forEach(f => {
      const el = folderRefs.current[f.id];
      if (!el) return;
      const fb = getBounds(el, c);
      newLines.push({ x1: pb.right, y1: pb.midY, x2: fb.left, y2: fb.midY, color: "#a1a1aa" });
    });

    // Active folder → its files
    if (folderObj) {
      const srcEl = folderRefs.current[folderObj.id];
      if (srcEl) {
        const sb = getBounds(srcEl, c);
        folderObj.files.forEach(file => {
          const el = fileRefs.current[file.id];
          if (!el) return;
          const db = getBounds(el, c);
          newLines.push({ x1: sb.right, y1: sb.midY, x2: db.left, y2: db.midY, color: "#6ee7b7" });
        });
      }
    }

    // Active file → its versions
    if (fileObj) {
      const srcEl = fileRefs.current[fileObj.id];
      if (srcEl) {
        const sb = getBounds(srcEl, c);
        fileObj.versions.forEach(v => {
          const el = versionRefs.current[v.id];
          if (!el) return;
          const db = getBounds(el, c);
          newLines.push({ x1: sb.right, y1: sb.midY, x2: db.left, y2: db.midY, color: "#93c5fd" });
        });
      }
    }

    setLines(newLines);
  }, [folderObj, fileObj]);

  // Recalculate after every render so lines always match the DOM
  useEffect(() => { recalcLines(); });

  // ── Handlers ──────────────────────────────────────────────────────────

  function onFolderEnter(id: string) { setHoverFolder(id); }
  function onFolderLeave()           { setHoverFolder(null); }
  function onFolderClick(id: string) {
    const next = pinFolder === id ? null : id;
    setPinFolder(next);
    setPinFile(null);
    setHoverFile(null);
  }

  function onFileEnter(id: string) { setHoverFile(id); }
  function onFileLeave()           { setHoverFile(null); }
  function onFileClick(id: string) {
    setPinFile(pinFile === id ? null : id);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
    >
      <div className="absolute top-3 left-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide z-10">
        File Graph
      </div>

      {/* SVG line overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" overflow="visible">
        {lines.map((l, i) => (
          <path key={i} d={curvePath(l)} fill="none" stroke={l.color} strokeWidth={1.5} />
        ))}
      </svg>

      {/* Main layout */}
      <div className="relative z-10 flex items-center gap-10 h-full px-8 py-6 overflow-x-auto">

        {/* ── Product ── */}
        <div className="flex-shrink-0">
          <div
            ref={productRef}
            className="rounded-xl border-2 border-green-500 bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/20 whitespace-nowrap"
          >
            {PRODUCT}
          </div>
        </div>

        {/* ── Folders ── */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          {FOLDERS.map(f => {
            const active = activeFolder === f.id;
            const pinned = pinFolder    === f.id;
            return (
              <div
                key={f.id}
                ref={el => { folderRefs.current[f.id] = el; }}
                onMouseEnter={() => onFolderEnter(f.id)}
                onMouseLeave={onFolderLeave}
                onClick={() => onFolderClick(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all text-sm font-medium whitespace-nowrap ${
                  active
                    ? "border-green-400 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
                }`}
              >
                <span>📁</span>
                <span>{f.name}</span>
                {pinned && <span className="text-[10px] opacity-60">📌</span>}
              </div>
            );
          })}
        </div>

        {/* ── Files (revealed on folder hover/pin) ── */}
        {folderObj && (
          <div className="flex-shrink-0 flex flex-col gap-2">
            {folderObj.files.map(file => {
              const active = activeFile === file.id;
              const pinned = pinFile    === file.id;
              return (
                <div
                  key={file.id}
                  ref={el => { fileRefs.current[file.id] = el; }}
                  onMouseEnter={() => onFileEnter(file.id)}
                  onMouseLeave={onFileLeave}
                  onClick={() => onFileClick(file.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all text-sm font-medium whitespace-nowrap ${
                    active
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                      : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
                  }`}
                >
                  <span>{EXT_ICON[file.ext] ?? "📄"}</span>
                  <span>{file.name}</span>
                  {pinned && <span className="text-[10px] opacity-60">📌</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Versions (revealed on file hover/pin) ── */}
        {fileObj && (
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            {fileObj.versions.map((v, i) => (
              <div
                key={v.id}
                ref={el => { versionRefs.current[v.id] = el; }}
                className={`px-3 py-2 rounded-lg border text-xs whitespace-nowrap ${
                  i === 0
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <div className="font-bold mb-0.5">{v.id.split("-")[1].toUpperCase()}</div>
                <div className="font-medium">{v.label}</div>
                <div className="opacity-60 mt-0.5">{v.date} · {v.author}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help hint */}
      <div className="absolute bottom-3 right-4 text-[10px] text-zinc-400 select-none">
        hover to expand · click to pin
      </div>
    </div>
  );
}
