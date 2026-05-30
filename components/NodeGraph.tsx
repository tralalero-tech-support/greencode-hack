"use client";

import { useState, useRef, useLayoutEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Version  { id: string; label: string; date: string; author: string }
interface FileItem { id: string; name: string; ext: string; versions: Version[]; driveId?: string }
interface Folder   {
  id: string; name: string;
  files: FileItem[]; subfolders: Folder[];
  driveId?: string; driveLoaded?: boolean;
}
interface Project  { id: string; name: string; folders: Folder[]; driveRootId?: string }
interface DriveItem { id: string; name: string }

const EXT_ICON: Record<string, string> = {
  pptx: "📊", pdf: "📕", docx: "📄", xlsx: "📈", jpg: "🖼️", png: "🖼️", mp4: "🎬",
};

// ── SVG connector ─────────────────────────────────────────────────────────────

interface Line { x1: number; y1: number; x2: number; y2: number; color: string }

function elbowD(x1: number, y1: number, x2: number, y2: number, R = 8): string {
  if (Math.abs(y1 - y2) < 1) return `M ${x1} ${y1} H ${x2}`;
  const mx = (x1 + x2) / 2;
  const s  = y2 > y1 ? 1 : -1;
  const r  = Math.min(R, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1) / 4);
  return [`M ${x1} ${y1}`, `H ${mx - r}`, `Q ${mx} ${y1} ${mx} ${y1 + s * r}`,
          `V ${y2 - s * r}`, `Q ${mx} ${y2} ${mx + r} ${y2}`, `H ${x2}`].join(" ");
}

// ── UID ───────────────────────────────────────────────────────────────────────

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;

// ── Recursive helpers ─────────────────────────────────────────────────────────

function updateFolderRec(id: string, fn: (f: Folder) => Folder, folders: Folder[]): Folder[] {
  return folders.map(f =>
    f.id === id ? fn(f) : { ...f, subfolders: updateFolderRec(id, fn, f.subfolders) }
  );
}

function updateFileRec(fileId: string, fn: (fi: FileItem) => FileItem, folders: Folder[]): Folder[] {
  return folders.map(f => ({
    ...f,
    files: f.files.map(fi => fi.id === fileId ? fn(fi) : fi),
    subfolders: updateFileRec(fileId, fn, f.subfolders),
  }));
}

function mapAllFilesRec(fn: (fi: FileItem) => FileItem, folders: Folder[]): Folder[] {
  return folders.map(f => ({
    ...f,
    files: f.files.map(fn),
    subfolders: mapAllFilesRec(fn, f.subfolders),
  }));
}

// Flatten visible folder tree respecting expansion
function visibleTree(
  folders: Folder[],
  expanded: string[],
  depth = 0,
): Array<{ f: Folder; depth: number }> {
  return folders.flatMap(f => [
    { f, depth },
    ...(expanded.includes(f.id) ? visibleTree(f.subfolders, expanded, depth + 1) : []),
  ]);
}

// ── Shared micro-UI ───────────────────────────────────────────────────────────

const INPUT   = "flex-1 text-xs bg-transparent outline-none border-b border-zinc-300 dark:border-zinc-600 pb-px text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 min-w-0";
const BTN_OK  = "text-[10px] text-green-500 hover:text-green-400 shrink-0";
const BTN_X   = "text-[10px] text-zinc-400 hover:text-zinc-300 shrink-0";
const BTN_ADD = "text-[10px] text-zinc-400 hover:text-green-500 transition-colors";

function InlineForm({ placeholder, onConfirm, onCancel }: {
  placeholder: string; onConfirm: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState("");
  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm(val); }} className="flex items-center gap-1">
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        placeholder={placeholder} className={INPUT} />
      <button type="submit" className={BTN_OK}>✓</button>
      <button type="button" onClick={onCancel} className={BTN_X}>✕</button>
    </form>
  );
}

// ── Drive picker state ────────────────────────────────────────────────────────

interface PickerState {
  loading: boolean;
  path: DriveItem[];       // breadcrumb; path[0] is always My Drive root
  folders: DriveItem[];
  error?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileGraph({ isSignedIn = false }: { isSignedIn?: boolean }) {

  // ── Projects ──────────────────────────────────────────────────────────────
  const [projects,         setProjects]         = useState<Project[]>([]);
  const [activeProjectId,  setActiveProjectId]  = useState<string | null>(null);

  // ── New-project modal ─────────────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false);
  const [modalTab,   setModalTab]   = useState<"manual" | "drive">("manual");
  const [manualName, setManualName] = useState("");
  const [picker,     setPicker]     = useState<PickerState | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);

  // ── Interaction state ────────────────────────────────────────────────────
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [pinFolders,  setPinFolders]  = useState<string[]>([]);
  const [hovFolder,   setHovFolder]   = useState<string | null>(null);
  const [pinFiles,    setPinFiles]    = useState<string[]>([]);
  const [hovFile,     setHovFile]     = useState<string | null>(null);

  // ── Add/edit state ───────────────────────────────────────────────────────
  const [addFolder,  setAddFolder]  = useState(false);
  const [addFileTo,  setAddFileTo]  = useState<string | null>(null);
  const [addVerTo,   setAddVerTo]   = useState<string | null>(null);
  const [editVer,    setEditVer]    = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;
  const allVisible    = visibleTree(activeProject?.folders ?? [], expandedFolders);

  const activeFolderIds = [...new Set([...pinFolders, ...(hovFolder ? [hovFolder] : [])])];
  const activeFolders   = allVisible.filter(({ f }) => activeFolderIds.includes(f.id)).map(({ f }) => f);

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

    allVisible.forEach(({ f }) => {
      const el = folderRefs.current[f.id]; if (!el) return;
      next.push({ x1: pb.right, y1: pb.midY, x2: mid(el).left, y2: mid(el).midY, color: "#a1a1aa" });
    });
    activeFolders.forEach(f => {
      const src = folderRefs.current[f.id]; if (!src) return;
      f.files.forEach(fi => {
        const el = fileRefs.current[fi.id]; if (!el) return;
        next.push({ x1: mid(src).right, y1: mid(src).midY, x2: mid(el).left, y2: mid(el).midY, color: "#6ee7b7" });
      });
    });
    activeFilesData.forEach(fi => {
      const src = fileRefs.current[fi.id]; if (!src) return;
      fi.versions.forEach(v => {
        const el = verRefs.current[v.id]; if (!el) return;
        next.push({ x1: mid(src).right, y1: mid(src).midY, x2: mid(el).left, y2: mid(el).midY, color: "#93c5fd" });
      });
    });
    setLines(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinFolders, hovFolder, pinFiles, hovFile, projects, activeProjectId, expandedFolders]);

  // ── Project helpers ───────────────────────────────────────────────────────

  function switchProject(id: string) {
    setActiveProjectId(id);
    setExpandedFolders([]); setPinFolders([]); setPinFiles([]);
    setHovFolder(null); setHovFile(null);
    setAddFolder(false); setAddFileTo(null); setAddVerTo(null); setEditVer(null);
  }

  function updateFolderInProject(folderId: string, fn: (f: Folder) => Folder) {
    setProjects(ps => ps.map(p => p.id !== activeProjectId ? p : {
      ...p, folders: updateFolderRec(folderId, fn, p.folders),
    }));
  }

  function updateFileInProject(fileId: string, fn: (fi: FileItem) => FileItem) {
    setProjects(ps => ps.map(p => p.id !== activeProjectId ? p : {
      ...p, folders: updateFileRec(fileId, fn, p.folders),
    }));
  }

  function updateTopFolders(fn: (fs: Folder[]) => Folder[]) {
    setProjects(ps => ps.map(p => p.id !== activeProjectId ? p : { ...p, folders: fn(p.folders) }));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function doAddFolder(name: string) {
    if (!name.trim()) return;
    const folderId    = uid("f");
    const driveRootId = activeProject?.driveRootId;
    updateTopFolders(fs => [...fs, { id: folderId, name: name.trim(), files: [], subfolders: [] }]);
    setAddFolder(false);
    if (driveRootId) {
      const res  = await fetch("/api/drive/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId: driveRootId }),
      });
      const data = await res.json();
      if (!data.error) {
        updateFolderInProject(folderId, f => ({ ...f, driveId: data.id, driveLoaded: true }));
      }
    }
  }

  function doAddFile(folderId: string, name: string) {
    if (!name.trim()) return;
    updateFolderInProject(folderId, f => ({
      ...f, files: [...f.files, { id: uid("fi"), name: name.trim(), ext: "pdf", versions: [] }],
    }));
    setAddFileTo(null);
  }

  function doAddVersion(fileId: string, label: string) {
    if (!label.trim()) return;
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    updateFileInProject(fileId, fi => ({
      ...fi, versions: [{ id: uid("v"), label: label.trim(), date, author: "You" }, ...fi.versions],
    }));
    setAddVerTo(null);
  }

  function doEditVersion(verId: string, label: string) {
    if (!label.trim()) { setEditVer(null); return; }
    setProjects(ps => ps.map(p => p.id !== activeProjectId ? p : {
      ...p, folders: mapAllFilesRec(fi => ({
        ...fi, versions: fi.versions.map(v => v.id === verId ? { ...v, label: label.trim() } : v),
      }), p.folders),
    }));
    setEditVer(null);
  }

  // ── Folder tree expand / Drive lazy-load ──────────────────────────────────

  async function toggleExpand(f: Folder) {
    if (expandedFolders.includes(f.id)) {
      setExpandedFolders(prev => prev.filter(id => id !== f.id));
      return;
    }
    // Lazy-load Drive contents
    if (f.driveId && !f.driveLoaded) {
      const res  = await fetch(`/api/drive/browse?folderId=${f.driveId}`);
      const data = await res.json();
      if (!data.error) {
        const subfolders: Folder[] = (data.folders ?? []).map((d: DriveItem) => ({
          id: uid("f"), name: d.name, files: [], subfolders: [], driveId: d.id, driveLoaded: false,
        }));
        const files: FileItem[] = (data.files ?? []).map((d: any) => ({
          id: uid("fi"), name: d.name, ext: d.ext ?? "file", versions: [], driveId: d.id,
        }));
        updateFolderInProject(f.id, folder => ({ ...folder, subfolders, files, driveLoaded: true }));
      }
    }
    setExpandedFolders(prev => [...prev, f.id]);
  }

  // ── Pin toggles ───────────────────────────────────────────────────────────

  const togglePinFolder = (id: string) =>
    setPinFolders(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const togglePinFile = (id: string) =>
    setPinFiles(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // ── Drive picker ──────────────────────────────────────────────────────────

  async function openDrivePicker() {
    setPicker({ loading: true, path: [{ id: "root", name: "My Drive" }], folders: [] });
    const res  = await fetch("/api/drive/browse?folderId=root");
    const data = await res.json();
    setPicker({ loading: false, path: [{ id: "root", name: "My Drive" }], folders: data.folders ?? [], error: data.error });
  }

  async function pickerEnter(item: DriveItem) {
    if (!picker) return;
    setPicker(p => p ? { ...p, loading: true } : p);
    const res  = await fetch(`/api/drive/browse?folderId=${item.id}`);
    const data = await res.json();
    setPicker(p => p ? { loading: false, path: [...p.path, item], folders: data.folders ?? [], error: data.error } : p);
  }

  async function pickerBack(index: number) {
    if (!picker) return;
    const target = picker.path[index];
    setPicker(p => p ? { ...p, loading: true } : p);
    const res  = await fetch(`/api/drive/browse?folderId=${target.id}`);
    const data = await res.json();
    setPicker({ loading: false, path: picker.path.slice(0, index + 1), folders: data.folders ?? [], error: data.error });
  }

  async function selectDriveFolder() {
    if (!picker || pickerBusy) return;
    const current = picker.path[picker.path.length - 1];
    setPickerBusy(true);
    const res  = await fetch(`/api/drive/import?folderId=${current.id}`);
    const data = await res.json();
    setPickerBusy(false);
    if (data.error) return;

    const mapFolder = (df: any): Folder => ({
      id: uid("f"),
      name: df.name,
      files: (df.files ?? []).map((f: any) => ({
        id: uid("fi"), name: f.name, ext: f.ext, versions: [], driveId: f.id,
      })),
      subfolders: (df.subfolders ?? []).map(mapFolder),
      driveId: df.id,
      driveLoaded: true,
    });

    const folders: Folder[] = (data.subfolders ?? []).map(mapFolder);
    // root-level files go in a synthetic folder
    if ((data.files ?? []).length > 0) {
      folders.unshift({
        id: uid("f"), name: "Root Files",
        files: (data.files ?? []).map((f: any) => ({
          id: uid("fi"), name: f.name, ext: f.ext, versions: [], driveId: f.id,
        })),
        subfolders: [], driveId: undefined, driveLoaded: true,
      });
    }

    const projId = uid("proj");
    const topIds = folders.map(f => f.id);
    setProjects(ps => [...ps, { id: projId, name: current.name, folders, driveRootId: current.id }]);
    switchProject(projId);
    setExpandedFolders(topIds); // after switchProject so it doesn't get cleared
    setPicker(null);
    setModalOpen(false);
  }

  // ── Create project ────────────────────────────────────────────────────────

  function createManualProject() {
    if (!manualName.trim()) return;
    const id = uid("proj");
    setProjects(ps => [...ps, { id, name: manualName.trim(), folders: [] }]);
    switchProject(id);
    setModalOpen(false);
    setManualName("");
  }

  // ── Node styles ───────────────────────────────────────────────────────────

  const folderCls = (id: string) => {
    const active = activeFolderIds.includes(id);
    return `flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer select-none text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "border-green-400 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300"
        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
    }`;
  };

  const fileCls = (id: string) => {
    const active = activeFileIds.includes(id);
    return `flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
    }`;
  };

  // ── Empty state ───────────────────────────────────────────────────────────

  const noProjects = projects.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── New-project modal ───────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-80 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">New Project</h2>
              <button onClick={() => { setModalOpen(false); setPicker(null); }}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">✕</button>
            </div>

            {/* Tab switcher */}
            {isSignedIn && (
              <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                {(["manual", "drive"] as const).map(tab => (
                  <button key={tab} onClick={() => { setModalTab(tab); if (tab === "drive" && !picker) openDrivePicker(); }}
                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                      modalTab === tab
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}>
                    {tab === "manual" ? "Empty project" : "From Google Drive"}
                  </button>
                ))}
              </div>
            )}

            {/* Manual tab */}
            {modalTab === "manual" && (
              <div className="flex flex-col gap-3">
                <input
                  autoFocus
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createManualProject()}
                  placeholder="Project name"
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-green-500"
                />
                <button onClick={createManualProject} disabled={!manualName.trim()}
                  className="py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 disabled:opacity-40 transition-colors">
                  Create project
                </button>
              </div>
            )}

            {/* Drive tab */}
            {modalTab === "drive" && (
              <div className="flex flex-col gap-3">
                {!picker ? (
                  <p className="text-xs text-zinc-400">Loading…</p>
                ) : picker.error ? (
                  <p className="text-xs text-red-500">{picker.error}</p>
                ) : (
                  <>
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 flex-wrap">
                      {picker.path.map((p, i) => (
                        <span key={p.id} className="flex items-center gap-1">
                          {i > 0 && <span>›</span>}
                          <button onClick={() => pickerBack(i)}
                            className={`hover:text-green-600 transition-colors ${i === picker.path.length - 1 ? "font-semibold text-zinc-700 dark:text-zinc-200" : ""}`}>
                            {p.name}
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Folder list */}
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {picker.loading ? (
                        <p className="text-xs text-zinc-400 py-2 text-center">Loading…</p>
                      ) : picker.folders.length === 0 ? (
                        <p className="text-xs text-zinc-400 py-2 text-center">No subfolders here</p>
                      ) : (
                        picker.folders.map(f => (
                          <button key={f.id} onClick={() => pickerEnter(f)}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                            <span>📁</span>
                            <span className="truncate">{f.name}</span>
                            <span className="ml-auto text-zinc-400">›</span>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Select button */}
                    <button onClick={selectDriveFolder} disabled={pickerBusy}
                      className="py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 disabled:opacity-60 transition-colors">
                      {pickerBusy ? "Loading…" : `Use "${picker.path[picker.path.length - 1].name}" as project`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── File graph panel ────────────────────────────────────────────────── */}
      <div ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">

        {/* Empty state */}
        {noProjects && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <span className="text-5xl select-none">📁</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">No projects yet</p>
                <p className="text-xs text-zinc-400 mt-0.5">Create a project to get started</p>
              </div>
              <button onClick={() => { setModalOpen(true); setModalTab("manual"); setManualName(""); setPicker(null); }}
                className="px-5 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 transition-colors shadow">
                + New Project
              </button>
            </div>
          </div>
        )}

        {/* Project bar */}
        {!noProjects && (
          <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 overflow-x-auto">
            {projects.map(proj => (
              <button key={proj.id} onClick={() => switchProject(proj.id)}
                className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  proj.id === activeProjectId
                    ? "bg-green-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200"
                }`}>
                {proj.name}
              </button>
            ))}
            <button
              onClick={() => { setModalOpen(true); setModalTab("manual"); setManualName(""); setPicker(null); }}
              className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-green-50 hover:text-green-600 border border-dashed border-zinc-300 dark:border-zinc-600 whitespace-nowrap transition-colors ml-1">
              + New Project
            </button>
          </div>
        )}

        {/* SVG connector overlay */}
        {!noProjects && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" overflow="visible">
            {lines.map((l, i) => (
              <path key={i} d={elbowD(l.x1, l.y1, l.x2, l.y2)} fill="none" stroke={l.color} strokeWidth={1.5} />
            ))}
          </svg>
        )}

        {/* Columns */}
        {!noProjects && activeProject && (
          <div className="relative z-10 flex items-start gap-10 h-full px-8 pt-14 pb-6 overflow-auto">

            {/* ── Project node ────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center" style={{ alignSelf: "center" }}>
              <div ref={productRef}
                className="rounded-xl border-2 border-green-500 bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/20 whitespace-nowrap">
                {activeProject.name}
              </div>
            </div>

            {/* ── Folder tree ─────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex flex-col gap-1 self-center">
              {allVisible.map(({ f, depth }) => (
                <div key={f.id} className="flex flex-col gap-1" style={{ marginLeft: depth * 16 }}>
                  <div className="flex items-center gap-1">
                    {/* Expand/collapse toggle */}
                    <button
                      onClick={() => toggleExpand(f)}
                      className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shrink-0 text-[10px]">
                      {f.subfolders.length > 0 || (f.driveId && !f.driveLoaded)
                        ? (expandedFolders.includes(f.id) ? "▾" : "▸")
                        : " "}
                    </button>
                    <div
                      ref={el => { folderRefs.current[f.id] = el; }}
                      className={folderCls(f.id)}
                      onMouseEnter={() => setHovFolder(f.id)}
                      onMouseLeave={() => setHovFolder(null)}
                      onClick={() => togglePinFolder(f.id)}>
                      <span>📁</span>
                      <span>{f.name}</span>
                      {pinFolders.includes(f.id) && <span className="ml-1 text-[10px] opacity-50">📌</span>}
                    </div>
                  </div>
                  {activeFolderIds.includes(f.id) && (
                    <div className="pl-5">
                      {addFileTo === f.id
                        ? <InlineForm placeholder="File name…" onConfirm={v => doAddFile(f.id, v)} onCancel={() => setAddFileTo(null)} />
                        : <button className={BTN_ADD} onClick={() => setAddFileTo(f.id)}>+ file</button>
                      }
                    </div>
                  )}
                </div>
              ))}

              {/* + folder */}
              <div className="mt-1 pl-5">
                {addFolder
                  ? <InlineForm placeholder="Folder name…" onConfirm={doAddFolder} onCancel={() => setAddFolder(false)} />
                  : <button className={BTN_ADD} onClick={() => setAddFolder(true)}>+ folder</button>
                }
              </div>
            </div>

            {/* ── Files ───────────────────────────────────────────────────── */}
            {shownFiles.length > 0 && (
              <div className="flex-shrink-0 flex flex-col gap-2 self-center">
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
                        {pinFiles.includes(fi.id) && <span className="ml-1 text-[10px] opacity-50">📌</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ── Versions ────────────────────────────────────────────────── */}
            {shownVersions.length > 0 && (
              <div className="flex-shrink-0 flex flex-col gap-3 self-center">
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
                          <span className={`font-bold shrink-0 ${i === 0 ? "text-emerald-600" : "text-zinc-400"}`}>
                            {v.id.split("-").pop()?.toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            {editVer === v.id
                              ? <InlineForm placeholder={v.label}
                                  onConfirm={val => doEditVersion(v.id, val || v.label)}
                                  onCancel={() => setEditVer(null)} />
                              : <div className={`font-medium cursor-text ${i === 0 ? "text-emerald-700" : "text-zinc-600 dark:text-zinc-300"}`}
                                  onClick={() => setEditVer(v.id)}>
                                  {v.label}
                                </div>
                            }
                            <div className="text-[10px] opacity-50 mt-0.5">{v.date} · {v.author}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pl-1">
                      {addVerTo === fi.id
                        ? <InlineForm placeholder="Version note…" onConfirm={v => doAddVersion(fi.id, v)} onCancel={() => setAddVerTo(null)} />
                        : <button className={BTN_ADD} onClick={() => setAddVerTo(fi.id)}>+ version</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-3 right-4 text-[10px] text-zinc-400 select-none z-10">
          hover to expand · click to pin 📌 · ▸ to expand folders
        </div>
      </div>
    </>
  );
}
