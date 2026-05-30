"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Version  { id: string; label: string; date: string; author: string }
interface FileItem { id: string; name: string; ext: string; versions: Version[]; driveId?: string }
interface Folder   {
  id: string; name: string;
  files: FileItem[]; subfolders: Folder[];
  driveId?: string; driveLoaded?: boolean;
}
interface Project  { id: string; name: string; folders: Folder[]; files?: FileItem[]; driveRootId?: string }
interface DriveItem { id: string; name: string }

type TreeItem =
  | { kind: "folder"; f: Folder; parentFolderId: string | null; depth: number }
  | { kind: "file"; fi: FileItem; parentFolderId: string | null; parentFolderDriveId?: string; depth: number }
  | { kind: "more"; folderId: string; count: number; depth: number }

const EXT_ICON: Record<string, string> = {
  pptx: "📊", pdf: "📕", docx: "📄", xlsx: "📈", jpg: "🖼️", png: "🖼️", mp4: "🎬",
};

// ── SVG connector ─────────────────────────────────────────────────────────────

interface Line { d: string; color: string }

function elbowD(x1: number, y1: number, x2: number, y2: number, R = 8, mx?: number): string {
  if (Math.abs(y1 - y2) < 1) return `M ${x1} ${y1} H ${x2}`;
  const midx = mx ?? (x1 + x2) / 2;
  const s    = y2 > y1 ? 1 : -1;
  const r    = Math.min(R, Math.abs(y2 - y1) / 2, Math.abs(midx - x1) / 2, Math.abs(x2 - midx) / 2);
  return [`M ${x1} ${y1}`, `H ${midx - r}`, `Q ${midx} ${y1} ${midx} ${y1 + s * r}`,
          `V ${y2 - s * r}`, `Q ${midx} ${y2} ${midx + r} ${y2}`, `H ${x2}`].join(" ");
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

function findAllFilesRec(folders: Folder[]): FileItem[] {
  return folders.flatMap(f => [...f.files, ...findAllFilesRec(f.subfolders)]);
}

function getAllFoldersRec(folders: Folder[]): Folder[] {
  return folders.flatMap(f => [f, ...getAllFoldersRec(f.subfolders)]);
}


function visibleTreeFull(
  folders: Folder[],
  expanded: string[],
  expandedFiles: string[],
  depth = 0,
  parentFolderId: string | null = null,
): TreeItem[] {
  const LIMIT = 5;
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  return sorted.flatMap(f => {
    const isExpanded  = expanded.includes(f.id);
    const filesExp    = expandedFiles.includes(f.id);
    const sortedFiles = [...f.files].sort((a, b) => a.name.localeCompare(b.name));
    const shownF      = filesExp ? sortedFiles : sortedFiles.slice(0, LIMIT);
    const hasMore     = !filesExp && sortedFiles.length > LIMIT;
    return [
      { kind: "folder" as const, f, parentFolderId, depth },
      ...(isExpanded ? [
        ...visibleTreeFull(f.subfolders, expanded, expandedFiles, depth + 1, f.id),
        ...shownF.map(fi => ({ kind: "file" as const, fi, parentFolderId: f.id, parentFolderDriveId: f.driveId, depth: depth + 1 })),
        ...(hasMore ? [{ kind: "more" as const, folderId: f.id, count: sortedFiles.length - LIMIT, depth: depth + 1 }] : []),
      ] : []),
    ];
  });
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
  path: DriveItem[];
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

  // ── Create modal state ────────────────────────────────────────────────────
  const [createModal,    setCreateModal]    = useState<"folder" | "file" | null>(null);
  const [createName,     setCreateName]     = useState("");
  const [createFileType, setCreateFileType] = useState<"document" | "presentation" | "spreadsheet">("document");
  const [createFolderId, setCreateFolderId] = useState<string | null>(null);
  const [createPurpose,  setCreatePurpose]  = useState("");
  const [suggestingName, setSuggestingName] = useState(false);

  // ── Interaction state ────────────────────────────────────────────────────
  const [expandedFolders,   setExpandedFolders]   = useState<string[]>([]);
  const [hovFolder,         setHovFolder]          = useState<string | null>(null);
  const [pinFiles,          setPinFiles]           = useState<string[]>([]);
  const [hovFile,           setHovFile]            = useState<string | null>(null);

  // ── Edit version state ───────────────────────────────────────────────────
  const [addVerTo,  setAddVerTo]  = useState<string | null>(null);
  const [editVer,   setEditVer]   = useState<string | null>(null);

  // ── File list expand state (folders with >5 files) ──────────────────────
  const [expandedFileLists, setExpandedFileLists] = useState<string[]>([]);
  const toggleFileList = (folderId: string) =>
    setExpandedFileLists(p => p.includes(folderId) ? p.filter(x => x !== folderId) : [...p, folderId]);

  // ── Drag-and-drop state ──────────────────────────────────────────────────
  const [dragFile, setDragFile] = useState<{
    fileId: string; fileDriveId?: string;
    srcFolderId: string; srcFolderDriveId?: string;
  } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // ── Shift-drag repositioning ──────────────────────────────────────────────
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, {dx: number; dy: number}>>({});
  const shiftDragRef     = useRef<{ nodeId: string; startX: number; startY: number; startDx: number; startDy: number } | null>(null);
  const shiftDragMovedRef = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const d = shiftDragRef.current;
      if (!d) return;
      shiftDragMovedRef.current = true;
      setNodeOffsets(prev => ({
        ...prev,
        [d.nodeId]: { dx: d.startDx + e.clientX - d.startX, dy: d.startDy + e.clientY - d.startY },
      }));
    }
    function onMouseUp() { shiftDragRef.current = null; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, []);

  function startShiftDrag(e: React.MouseEvent, nodeId: string) {
    if (!e.shiftKey) return;
    e.preventDefault();
    shiftDragMovedRef.current = false;
    const cur = nodeOffsets[nodeId] ?? { dx: 0, dy: 0 };
    shiftDragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, startDx: cur.dx, startDy: cur.dy };
  }

  function didShiftDrag(): boolean {
    if (shiftDragMovedRef.current) { shiftDragMovedRef.current = false; return true; }
    return false;
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeProject   = projects.find(p => p.id === activeProjectId) ?? null;
  const rootSyntheticId = activeProjectId ? `__root__${activeProjectId}` : "";
  const rootFilesVisible = rootSyntheticId ? expandedFolders.includes(rootSyntheticId) : false;
  const hasRootFiles    = (activeProject?.files?.length ?? 0) > 0;

  const allVisible: TreeItem[] = [
    ...visibleTreeFull(activeProject?.folders ?? [], expandedFolders, expandedFileLists),
    ...(rootFilesVisible
      ? [...(activeProject?.files ?? [])]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(fi => ({ kind: "file" as const, fi, parentFolderId: rootSyntheticId, parentFolderDriveId: activeProject?.driveRootId, depth: 0 }))
      : []),
  ];

  const activeFolderIds = [...new Set([...expandedFolders, ...(hovFolder ? [hovFolder] : [])])];

  const allProjectFiles = [...findAllFilesRec(activeProject?.folders ?? []), ...(activeProject?.files ?? [])];
  const activeFileIds   = [...new Set([...pinFiles, ...(hovFile ? [hovFile] : [])])];
  const activeFilesData = allProjectFiles.filter(fi => activeFileIds.includes(fi.id));

  const allFolders = getAllFoldersRec(activeProject?.folders ?? []);

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
    const pos = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - cr.left, right: r.right - cr.left,
        top: r.top - cr.top, bot: r.bottom - cr.top,
        midY: r.top - cr.top + r.height / 2,
      };
    };

    // Collect node bounding boxes for obstacle-aware routing
    type Rect = { left: number; right: number; top: number; bot: number };
    const obstacles: Rect[] = [];
    const addObs = (el: HTMLElement | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      obstacles.push({
        left: r.left - cr.left - 2, right: r.right - cr.left + 2,
        top: r.top - cr.top - 2, bot: r.bottom - cr.top + 2,
      });
    };
    Object.values(folderRefs.current).forEach(el => addObs(el));
    Object.values(fileRefs.current).forEach(el => addObs(el));
    addObs(productRef.current);

    const pb = pos(p);
    const next: Line[] = [];

    type NodePos = { left: number; right: number; top: number; bot: number; midY: number };

    function pushSafe(x1: number, y1: number, x2: number, y2: number, color: string) {
      const baseMx = (x1 + x2) / 2;
      const yMin = Math.min(y1, y2);
      const yMax = Math.max(y1, y2);
      for (const off of [0, 16, -16, 32, -32, 48, -48]) {
        const mx = baseMx + off;
        const blocked = obstacles.some(ob =>
          mx > ob.left && mx < ob.right && yMin < ob.bot && yMax > ob.top
        );
        if (!blocked) { next.push({ d: elbowD(x1, y1, x2, y2, 10, mx), color }); return; }
      }
      next.push({ d: elbowD(x1, y1, x2, y2, 10), color });
    }

    function addFanned(src: NodePos, targets: Array<{left: number; midY: number}>, color: string) {
      if (targets.length === 0) return;
      const sorted = [...targets].sort((a, b) => a.midY - b.midY);
      const pad = 5;
      const h = Math.max(0, src.bot - src.top - pad * 2);
      sorted.forEach((t, i) => {
        const frac   = sorted.length === 1 ? 0.5 : i / (sorted.length - 1);
        const startY = src.top + pad + frac * h;
        pushSafe(src.right, startY, t.left, t.midY, color);
      });
    }

    // project → top-level folders + synthetic root folder
    const projectChildren: Array<{left: number; midY: number}> = [];
    allVisible.filter(item => item.kind === "folder" && item.depth === 0).forEach(item => {
      if (item.kind !== "folder") return;
      const el = folderRefs.current[item.f.id]; if (!el) return;
      const p2 = pos(el); projectChildren.push({ left: p2.left, midY: p2.midY });
    });
    if (rootSyntheticId) {
      const el = folderRefs.current[rootSyntheticId];
      if (el) { const p2 = pos(el); projectChildren.push({ left: p2.left, midY: p2.midY }); }
    }
    addFanned(pb, projectChildren, "#a1a1aa");

    // parent folder → subfolders (tree-style L-connector from left side)
    const subfoldersByParent = new Map<string, Array<{left: number; midY: number}>>();
    allVisible.filter(item => item.kind === "folder" && item.parentFolderId !== null).forEach(item => {
      if (item.kind !== "folder" || !item.parentFolderId) return;
      const el = folderRefs.current[item.f.id]; if (!el) return;
      const p2 = pos(el);
      const pid = item.parentFolderId;
      if (!subfoldersByParent.has(pid)) subfoldersByParent.set(pid, []);
      subfoldersByParent.get(pid)!.push({ left: p2.left, midY: p2.midY });
    });
    subfoldersByParent.forEach((children, parentId) => {
      const parentEl = folderRefs.current[parentId]; if (!parentEl) return;
      const pp = pos(parentEl);
      const x = pp.left - 10;
      children.sort((a, b) => a.midY - b.midY).forEach(child => {
        const r = 5;
        const dy = child.midY - pp.midY;
        const safe_r = Math.min(r, Math.abs(dy) / 2, Math.abs(child.left - x) / 2);
        const d = `M ${x} ${pp.midY} V ${child.midY - safe_r} Q ${x} ${child.midY} ${x + safe_r} ${child.midY} H ${child.left}`;
        next.push({ d, color: "#a1a1aa" });
      });
    });

    // folder → its files (grouped per folder, fanned; includes synthetic root)
    const filesByFolder = new Map<string, Array<{left: number; midY: number}>>();
    allVisible.filter(item => item.kind === "file").forEach(item => {
      if (item.kind !== "file" || !item.parentFolderId) return;
      const el = fileRefs.current[item.fi.id]; if (!el) return;
      const p2 = pos(el);
      const pid = item.parentFolderId;
      if (!filesByFolder.has(pid)) filesByFolder.set(pid, []);
      filesByFolder.get(pid)!.push({ left: p2.left, midY: p2.midY });
    });
    filesByFolder.forEach((targets, folderId) => {
      const folderEl = folderRefs.current[folderId]; if (!folderEl) return;
      addFanned(pos(folderEl), targets, "#a1a1aa");
    });

    // file → versions (fanned per file)
    activeFilesData.forEach(fi => {
      const src = fileRefs.current[fi.id]; if (!src) return;
      const verTargets = fi.versions.map(v => {
        const el = verRefs.current[v.id]; if (!el) return null;
        const p2 = pos(el); return { left: p2.left, midY: p2.midY };
      }).filter(Boolean) as Array<{left: number; midY: number}>;
      addFanned(pos(src), verTargets, "#93c5fd");
    });

    setLines(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovFolder, pinFiles, hovFile, projects, activeProjectId, expandedFolders, expandedFileLists, nodeOffsets]);

  // ── Project helpers ───────────────────────────────────────────────────────

  function switchProject(id: string) {
    setActiveProjectId(id);
    setExpandedFolders([]); setPinFiles([]);
    setHovFolder(null); setHovFile(null);
    setAddVerTo(null); setEditVer(null);
    setExpandedFileLists([]);
    setCreateModal(null);
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

  function moveFileBetweenFolders(fileId: string, srcFolderId: string, dstFolderId: string) {
    setProjects(ps => ps.map(p => {
      if (p.id !== activeProjectId) return p;
      let moved: FileItem | undefined;
      const step1 = updateFolderRec(srcFolderId, f => {
        moved = f.files.find(fi => fi.id === fileId);
        return { ...f, files: f.files.filter(fi => fi.id !== fileId) };
      }, p.folders);
      if (!moved) return p;
      const file = moved;
      const step2 = updateFolderRec(dstFolderId, f => ({ ...f, files: [...f.files, file] }), step1);
      return { ...p, folders: step2 };
    }));
  }

  async function handleFileDrop(targetFolder: Folder) {
    if (!dragFile || dragFile.srcFolderId === targetFolder.id) {
      setDragFile(null); setDragOverFolderId(null); return;
    }
    const { fileId, fileDriveId, srcFolderId, srcFolderDriveId } = dragFile;
    moveFileBetweenFolders(fileId, srcFolderId, targetFolder.id);
    setDragFile(null); setDragOverFolderId(null);
    if (fileDriveId && targetFolder.driveId && srcFolderDriveId) {
      await fetch("/api/drive/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: fileDriveId, addParentId: targetFolder.driveId, removeParentId: srcFolderDriveId }),
      });
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

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
    const rootFiles: FileItem[] = (data.files ?? []).map((f: any) => ({
      id: uid("fi"), name: f.name, ext: f.ext, versions: [], driveId: f.id,
    }));

    const projId = uid("proj");
    setProjects(ps => [...ps, { id: projId, name: current.name, folders, files: rootFiles, driveRootId: current.id }]);
    switchProject(projId);
    setPicker(null);
    setModalOpen(false);
  }

  // ── AI name suggestion ────────────────────────────────────────────────────

  async function suggestName() {
    if (!createPurpose.trim() || suggestingName) return;
    setSuggestingName(true);
    const existingNames = [
      ...allFolders.map(f => f.name),
      ...allProjectFiles.map(fi => fi.name),
    ];
    const res = await fetch("/api/suggest-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: createModal,
        fileType: createModal === "file" ? createFileType : undefined,
        purpose: createPurpose,
        existingNames,
      }),
    });
    const data = await res.json();
    if (data.suggestion) setCreateName(data.suggestion);
    setSuggestingName(false);
  }

  // ── Create project ────────────────────────────────────────────────────────

  function createManualProject() {
    if (!manualName.trim()) return;
    const id = uid("proj");
    setProjects(ps => [...ps, { id, name: manualName.trim(), folders: [], files: [] }]);
    switchProject(id);
    setModalOpen(false);
    setManualName("");
  }

  // ── Create folder/file (modal) ────────────────────────────────────────────

  async function doCreateFolder() {
    if (!createName.trim()) return;
    const folderId = uid("f");
    const newFolder: Folder = { id: folderId, name: createName.trim(), files: [], subfolders: [] };

    if (createFolderId) {
      updateFolderInProject(createFolderId, f => ({ ...f, subfolders: [...f.subfolders, newFolder] }));
    } else {
      updateTopFolders(fs => [...fs, newFolder]);
    }
    setCreateModal(null);
    setCreatePurpose("");

    const parentDriveId = createFolderId
      ? allFolders.find(f => f.id === createFolderId)?.driveId
      : activeProject?.driveRootId;
    if (parentDriveId) {
      const res  = await fetch("/api/drive/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolder.name, parentId: parentDriveId }),
      });
      const data = await res.json();
      if (!data.error) {
        if (createFolderId) {
          updateFolderInProject(folderId, f => ({ ...f, driveId: data.id, driveLoaded: true }));
        } else {
          updateFolderInProject(folderId, f => ({ ...f, driveId: data.id, driveLoaded: true }));
        }
      }
    }
  }

  async function doCreateFile() {
    if (!createName.trim()) return;
    const mimeMap: Record<string, { mimeType: string; ext: string }> = {
      document:     { mimeType: "application/vnd.google-apps.document",     ext: "docx" },
      presentation: { mimeType: "application/vnd.google-apps.presentation", ext: "pptx" },
      spreadsheet:  { mimeType: "application/vnd.google-apps.spreadsheet",  ext: "xlsx" },
    };
    const { mimeType, ext } = mimeMap[createFileType];
    const fileId = uid("fi");
    const newFile: FileItem = { id: fileId, name: createName.trim(), ext, versions: [] };

    if (createFolderId) {
      updateFolderInProject(createFolderId, f => ({ ...f, files: [...f.files, newFile] }));
    } else {
      setProjects(ps => ps.map(p => p.id !== activeProjectId ? p : {
        ...p, files: [...(p.files ?? []), newFile],
      }));
    }
    setCreateModal(null);
    setCreatePurpose("");

    const parentDriveId = createFolderId
      ? allFolders.find(f => f.id === createFolderId)?.driveId
      : activeProject?.driveRootId;
    if (parentDriveId) {
      const res  = await fetch("/api/drive/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFile.name, mimeType, parentId: parentDriveId }),
      });
      const data = await res.json();
      if (!data.error) {
        if (createFolderId) {
          updateFolderInProject(createFolderId, f => ({
            ...f, files: f.files.map(fi => fi.id === fileId ? { ...fi, driveId: data.id } : fi),
          }));
        } else {
          setProjects(ps => ps.map(p => p.id !== activeProjectId ? p : {
            ...p, files: (p.files ?? []).map(fi => fi.id === fileId ? { ...fi, driveId: data.id } : fi),
          }));
        }
      }
    }
  }

  // ── Node styles ───────────────────────────────────────────────────────────

  const folderCls = (id: string) => {
    const active   = activeFolderIds.includes(id);
    const dropOver = dragOverFolderId === id;
    return `flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer select-none text-sm font-medium whitespace-nowrap transition-colors ${
      dropOver
        ? "border-violet-400 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 ring-2 ring-violet-300"
        : active
          ? "border-green-400 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300"
          : dragFile
            ? "border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-500 hover:border-violet-300"
            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
    }`;
  };

  const fileCls = (id: string) => {
    const active   = activeFileIds.includes(id);
    const dragging = dragFile?.fileId === id;
    return `flex items-center gap-2 px-3 py-2 rounded-lg border select-none text-sm font-medium whitespace-nowrap transition-colors ${
      dragging
        ? "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-700 text-zinc-400 opacity-50 cursor-grabbing"
        : active
          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 cursor-grab"
          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 cursor-grab"
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

            {modalTab === "drive" && (
              <div className="flex flex-col gap-3">
                {!picker ? (
                  <p className="text-xs text-zinc-400">Loading…</p>
                ) : picker.error ? (
                  <p className="text-xs text-red-500">{picker.error}</p>
                ) : (
                  <>
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

      {/* ── Create folder/file modal ─────────────────────────────────────────── */}
      {createModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-80 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {createModal === "folder" ? "New Folder" : "New File"}
              </h2>
              <button onClick={() => { setCreateModal(null); setCreatePurpose(""); setSuggestingName(false); }}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">✕</button>
            </div>

            {isSignedIn && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                  What is it for? <span className="normal-case">(optional — used to suggest a name)</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    value={createPurpose}
                    onChange={e => setCreatePurpose(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && createPurpose.trim()) suggestName(); }}
                    placeholder="e.g. quarterly budget tracking"
                    className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <button
                    onClick={suggestName}
                    disabled={!createPurpose.trim() || suggestingName}
                    className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-medium hover:bg-green-100 disabled:opacity-40 transition-colors">
                    {suggestingName ? "…" : "✨ Suggest"}
                  </button>
                </div>
              </div>
            )}

            <input
              autoFocus
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createModal === "folder" ? doCreateFolder() : doCreateFile(); }}
              placeholder={createModal === "folder" ? "Folder name" : "File name"}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 outline-none focus:ring-1 focus:ring-green-500"
            />

            {createModal === "file" && (
              <div className="flex gap-1.5">
                {(["document", "presentation", "spreadsheet"] as const).map(type => (
                  <button key={type} onClick={() => setCreateFileType(type)}
                    className={`flex-1 text-[10px] px-2 py-1.5 rounded-full border font-medium transition-colors ${
                      createFileType === type
                        ? "bg-green-600 text-white border-green-600"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400"
                    }`}>
                    {type === "document" ? "📄 Document" : type === "presentation" ? "📊 Slide Deck" : "📈 Sheet"}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Location</p>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                <button
                  onClick={() => setCreateFolderId(null)}
                  className={`text-xs text-left px-3 py-2 rounded-lg border transition-colors ${
                    createFolderId === null
                      ? "border-green-400 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
                  }`}>
                  📂 Project Root
                </button>
                {[...allFolders].sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                  <button key={f.id} onClick={() => setCreateFolderId(f.id)}
                    className={`text-xs text-left px-3 py-2 rounded-lg border transition-colors ${
                      createFolderId === f.id
                        ? "border-green-400 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"
                    }`}>
                    📁 {f.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => createModal === "folder" ? doCreateFolder() : doCreateFile()}
              disabled={!createName.trim()}
              className="py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-500 disabled:opacity-40 transition-colors">
              {createModal === "folder" ? "Create Folder" : "Create File"}
            </button>
          </div>
        </div>
      )}

      {/* ── File graph panel ────────────────────────────────────────────────── */}
      <div ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">

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

        {!noProjects && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" overflow="visible">
            {lines.map((l, i) => (
              <path key={i} d={l.d} fill="none" stroke={l.color} strokeWidth={1.5} />
            ))}
          </svg>
        )}

        {!noProjects && activeProject && (
          <>
            {/* ── + Folder / + File action buttons ──────────────────────────── */}
            <div className="absolute top-12 left-4 z-20 flex gap-2">
              <button
                onClick={() => { setCreateModal("folder"); setCreateName(""); setCreateFolderId(null); }}
                className="text-[11px] font-medium px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-green-400 hover:text-green-600 transition-colors shadow-sm">
                ＋ Folder
              </button>
              <button
                onClick={() => { setCreateModal("file"); setCreateName(""); setCreateFolderId(null); setCreateFileType("document"); }}
                className="text-[11px] font-medium px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm">
                ＋ File
              </button>
            </div>

            <div className="relative z-10 flex items-start gap-10 h-full px-8 pt-20 pb-6 overflow-auto">

              {/* ── Project node ────────────────────────────────────────────── */}
              <div className="flex-shrink-0 flex items-center" style={{ alignSelf: "center" }}>
                <div ref={productRef}
                  className="rounded-xl border-2 border-green-500 bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-500/20 whitespace-nowrap">
                  {activeProject.name}
                </div>
              </div>

              {/* ── Folder tree + synthetic root folder ──────────────────────── */}
              <div className="flex-shrink-0 flex flex-col gap-1 self-center">
                {allVisible.filter(item => item.kind === "folder").map(item => {
                  if (item.kind !== "folder") return null;
                  const { f, depth } = item;
                  const isExp = expandedFolders.includes(f.id);
                  const fOff  = nodeOffsets[f.id] ?? { dx: 0, dy: 0 };
                  return (
                    <div key={`folder-${f.id}`} className="flex items-center gap-1" style={{ marginLeft: depth * 16, transform: `translate(${fOff.dx}px,${fOff.dy}px)` }}>
                      <button
                        onClick={() => toggleExpand(f)}
                        className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shrink-0 text-[10px]">
                        {f.subfolders.length > 0 || f.files.length > 0 || (f.driveId && !f.driveLoaded)
                          ? (isExp ? "▾" : "▸") : " "}
                      </button>
                      <div
                        ref={el => { folderRefs.current[f.id] = el; }}
                        className={folderCls(f.id)}
                        onMouseDown={e => startShiftDrag(e, f.id)}
                        onMouseEnter={() => setHovFolder(f.id)}
                        onMouseLeave={() => setHovFolder(null)}
                        onClick={e => {
                          if (didShiftDrag()) return;
                          if ((e.metaKey || e.ctrlKey) && f.driveId) {
                            window.open(`https://drive.google.com/open?id=${f.driveId}`, "_blank");
                          } else { toggleExpand(f); }
                        }}
                        onDragOver={e => { e.preventDefault(); setDragOverFolderId(f.id); }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={e => { e.preventDefault(); handleFileDrop(f); }}>
                        <span>📁</span>
                        <span>{f.name}</span>
                        {dragOverFolderId === f.id && <span className="ml-auto text-[10px]">drop</span>}
                      </div>
                    </div>
                  );
                })}

                {/* Synthetic "Root-[project]" folder for root-level files */}
                {hasRootFiles && rootSyntheticId && (
                  <div className="flex items-center gap-1" style={{ transform: `translate(${(nodeOffsets[rootSyntheticId]?.dx ?? 0)}px,${(nodeOffsets[rootSyntheticId]?.dy ?? 0)}px)` }}>
                    <button
                      onClick={() => setExpandedFolders(prev => prev.includes(rootSyntheticId) ? prev.filter(x => x !== rootSyntheticId) : [...prev, rootSyntheticId])}
                      className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shrink-0 text-[10px]">
                      {rootFilesVisible ? "▾" : "▸"}
                    </button>
                    <div
                      ref={el => { folderRefs.current[rootSyntheticId] = el; }}
                      className={folderCls(rootSyntheticId)}
                      onMouseDown={e => startShiftDrag(e, rootSyntheticId)}
                      onMouseEnter={() => setHovFolder(rootSyntheticId)}
                      onMouseLeave={() => setHovFolder(null)}
                      onClick={() => {
                        if (didShiftDrag()) return;
                        setExpandedFolders(prev => prev.includes(rootSyntheticId) ? prev.filter(x => x !== rootSyntheticId) : [...prev, rootSyntheticId]);
                      }}>
                      <span>📂</span>
                      <span>Root-{activeProject.name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Files column ─────────────────────────────────────────────── */}
              {allVisible.some(item => item.kind === "file" || item.kind === "more") && (
                <div className="flex-shrink-0 flex flex-col gap-1 self-center">
                  {allVisible.filter(item => item.kind === "file" || item.kind === "more").map((item, idx) => {
                    if (item.kind === "file") {
                      const { fi, parentFolderId, parentFolderDriveId } = item;
                      const isRootFile = parentFolderId === rootSyntheticId;
                      const fiOff = nodeOffsets[fi.id] ?? { dx: 0, dy: 0 };
                      return (
                        <div key={`file-${fi.id}-${idx}`} style={{ transform: `translate(${fiOff.dx}px,${fiOff.dy}px)` }}>
                          <div
                            ref={el => { fileRefs.current[fi.id] = el; }}
                            className={fileCls(fi.id)}
                            draggable={!isRootFile}
                            onDragStart={!isRootFile && parentFolderId ? (e) => {
                              if (e.shiftKey) { e.preventDefault(); return; }
                              setDragFile({ fileId: fi.id, fileDriveId: fi.driveId, srcFolderId: parentFolderId, srcFolderDriveId: parentFolderDriveId });
                            } : undefined}
                            onMouseDown={e => startShiftDrag(e, fi.id)}
                            onDragEnd={() => { setDragFile(null); setDragOverFolderId(null); }}
                            onMouseEnter={() => setHovFile(fi.id)}
                            onMouseLeave={() => setHovFile(null)}
                            onClick={e => {
                              if (didShiftDrag()) return;
                              if ((e.metaKey || e.ctrlKey) && fi.driveId) {
                                window.open(`https://drive.google.com/open?id=${fi.driveId}`, "_blank");
                              } else {
                                togglePinFile(fi.id);
                              }
                            }}>
                            <span>{EXT_ICON[fi.ext] ?? "📄"}</span>
                            <span>{fi.name}</span>
                            {pinFiles.includes(fi.id) && <span className="ml-1 text-[10px] opacity-50">📌</span>}
                          </div>
                        </div>
                      );
                    }

                    if (item.kind === "more") {
                      const { folderId, count } = item;
                      return (
                        <div key={`more-${folderId}`}>
                          <button
                            className="text-[10px] text-zinc-400 hover:text-zinc-600 text-left px-1 transition-colors"
                            onClick={() => toggleFileList(folderId)}>
                            ▾ {count} more file{count !== 1 ? "s" : ""}
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })}
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
          </>
        )}

        {!noProjects && (pinFiles.length > 0 || Object.keys(nodeOffsets).length > 0) && (
          <div className="absolute top-12 right-4 z-10 flex gap-2">
            {pinFiles.length > 0 && (
              <button
                onClick={() => { setPinFiles([]); setHovFile(null); }}
                className="text-[10px] px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400 transition-colors shadow-sm select-none">
                collapse files ✕
              </button>
            )}
            {Object.keys(nodeOffsets).length > 0 && (
              <button
                onClick={() => setNodeOffsets({})}
                className="text-[10px] px-2 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400 transition-colors shadow-sm select-none">
                Reset ↺
              </button>
            )}
          </div>
        )}

        <div className="absolute bottom-3 right-4 text-[10px] text-zinc-400 select-none z-10">
          click to pin 📌 · ⌘-click to open in Drive · drag to move · ⇧-drag to reposition · ▸ expand
        </div>
      </div>
    </>
  );
}
