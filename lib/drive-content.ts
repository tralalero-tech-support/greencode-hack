import { google } from "googleapis";
import type { OAuth2Client } from "googleapis-common";
import { exportGoogleDoc } from "@/lib/google/drive";
import type { DriveFile } from "@/lib/google/types";

// Google Workspace formats — export as plain text
const EXPORT_AS_TEXT: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

// Uploaded text-based files — download directly
const DOWNLOAD_AS_TEXT = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
]);

const SNIPPET_LIMIT  = 2000; // chars — enough to capture key topics and names
const MAX_CONCURRENT = 5;    // parallel Drive API requests

async function streamToText(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8").replace(/\s+/g, " ").trim();
}

async function downloadFile(auth: OAuth2Client, fileId: string): Promise<string | null> {
  try {
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    const text = await streamToText(res.data as unknown as NodeJS.ReadableStream);
    return text.slice(0, SNIPPET_LIMIT) || null;
  } catch {
    return null;
  }
}

export async function extractContent(
  auth: OAuth2Client,
  file: DriveFile
): Promise<string | null> {
  try {
    const exportMime = EXPORT_AS_TEXT[file.mimeType];
    if (exportMime) {
      const stream = await exportGoogleDoc(auth, file.id, exportMime);
      const text   = await streamToText(stream);
      return text.slice(0, SNIPPET_LIMIT) || null;
    }

    if (DOWNLOAD_AS_TEXT.has(file.mimeType)) {
      return downloadFile(auth, file.id);
    }

    return null;
  } catch {
    return null;
  }
}

// Run tasks with a concurrency cap to avoid hitting Drive API rate limits
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

export async function enrichFiles(
  auth: OAuth2Client,
  files: DriveFile[]
) {
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
