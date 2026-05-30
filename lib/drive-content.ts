import { google } from "googleapis";
import type { OAuth2Client } from "googleapis-common";
import mammoth from "mammoth";
import { createRequire } from "module";
import { exportGoogleDoc } from "@/lib/google/drive";
import type { DriveFile } from "@/lib/google/types";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

// Google Workspace formats — export via Drive API
const EXPORT_AS_TEXT: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

// Uploaded plain-text files — download and decode directly
const DOWNLOAD_AS_TEXT = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
]);

// Uploaded binary Office/PDF files — download and parse
const OFFICE_DOCX = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword",                                                        // .doc
]);

const SNIPPET_LIMIT  = 2000;
const MAX_CONCURRENT = 5;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function downloadBuffer(auth: OAuth2Client, fileId: string): Promise<Buffer | null> {
  try {
    const drive = google.drive({ version: "v3", auth });
    const res   = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    return streamToBuffer(res.data as unknown as NodeJS.ReadableStream);
  } catch {
    return null;
  }
}

async function extractDocx(buf: Buffer): Promise<string | null> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value.replace(/\s+/g, " ").trim() || null;
  } catch {
    return null;
  }
}

async function extractPdf(buf: Buffer): Promise<string | null> {
  try {
    const { text } = await pdfParse(buf);
    return text.replace(/\s+/g, " ").trim() || null;
  } catch {
    return null;
  }
}

export async function extractContent(
  auth: OAuth2Client,
  file: DriveFile
): Promise<string | null> {
  try {
    // Google Workspace — use Drive export API
    const exportMime = EXPORT_AS_TEXT[file.mimeType];
    if (exportMime) {
      const stream = await exportGoogleDoc(auth, file.id, exportMime);
      const buf    = await streamToBuffer(stream);
      return buf.toString("utf-8").replace(/\s+/g, " ").trim().slice(0, SNIPPET_LIMIT) || null;
    }

    // Plain text — download and decode
    if (DOWNLOAD_AS_TEXT.has(file.mimeType)) {
      const buf = await downloadBuffer(auth, file.id);
      if (!buf) return null;
      return buf.toString("utf-8").replace(/\s+/g, " ").trim().slice(0, SNIPPET_LIMIT) || null;
    }

    // Word documents (.docx / .doc) — parse with mammoth
    if (OFFICE_DOCX.has(file.mimeType)) {
      const buf  = await downloadBuffer(auth, file.id);
      if (!buf) return null;
      const text = await extractDocx(buf);
      return text?.slice(0, SNIPPET_LIMIT) ?? null;
    }

    // PDF — parse with pdf-parse
    if (file.mimeType === "application/pdf") {
      const buf  = await downloadBuffer(auth, file.id);
      if (!buf) return null;
      const text = await extractPdf(buf);
      return text?.slice(0, SNIPPET_LIMIT) ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

// Run tasks with a concurrency cap to stay within Drive API rate limits
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i    = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function enrichFiles(auth: OAuth2Client, files: DriveFile[]) {
  return withConcurrency(files, MAX_CONCURRENT, async (file) => {
    const content = await extractContent(auth, file);
    return {
      id:             file.id,
      name:           file.name,
      mimeType:       file.mimeType,
      modifiedTime:   file.modifiedTime,
      lastEditedBy:   file.lastModifyingUser?.displayName,
      owner:          file.owners?.[0]?.displayName,
      webViewLink:    file.webViewLink,
      description:    file.description ?? undefined,
      contentSnippet: content ?? undefined,
    };
  });
}
