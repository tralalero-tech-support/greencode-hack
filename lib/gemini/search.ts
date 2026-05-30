import { getOpenAIClient } from "./client";
import type { DriveFile } from "@/lib/google/types";
import type { CachedFile } from "@/lib/drive-cache";

export type SearchResult = {
  file: CachedFile;
  relevanceScore: number;
  reason: string;
};

type OpenAIMatch = {
  id: string;
  relevanceScore: number;
  reason: string;
};

const SEARCH_SYSTEM_PROMPT = `You are a file search assistant for ContextOS, a smart Google Drive file manager.

The user will give you a natural language query describing a file they are looking for.
You will receive a JSON array of Drive files, each with a pre-computed summary of its contents.

Your job:
1. Identify which files match the user's query — use the summary, file name, type, who last edited it, and when it was modified.
2. Score each match from 0.0 (not relevant) to 1.0 (perfect match).
3. Return ONLY files with a score > 0.2, ranked from highest to lowest.

Respond with valid JSON only — no markdown, no extra text.
Format:
[{ "id": "<file id>", "relevanceScore": 0.95, "reason": "Short explanation of why this matches" }]

If nothing matches, return an empty array: []`;

const SUMMARIZE_SYSTEM_PROMPT = `You are a file indexing assistant for ContextOS, a smart Google Drive file manager.

You will receive a JSON array of Drive files. Each file may include a contentSnippet — actual text extracted from the file's body.

For each file, write a 2-3 sentence summary that a person could use to find the file later by describing what it's about, NOT its filename. Prioritise the contentSnippet over the filename — the file may have a vague or unrelated name.

The summary must capture:
- The actual subject matter and key topics (use the contentSnippet as the primary source)
- Any people, organisations, projects, events, or places mentioned
- The type of document and its purpose
- Specific details someone might remember (e.g. "essay about Imperial stormtroopers in Star Wars", not just "essay")

IMPORTANT: If a contentSnippet is provided, base the summary primarily on its content, not the filename.

Respond with valid JSON only — no markdown:
[{ "id": "<file id>", "summary": "..." }]`;

function parseMatches(raw: string): OpenAIMatch[] {
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? parsed.files ?? Object.values(parsed)[0]);
    if (!Array.isArray(arr)) throw new Error("No array found");
    return arr;
  } catch {
    console.error("OpenAI returned unexpected JSON:", raw);
    return [];
  }
}

// Search against pre-computed summaries stored in the client cache
export async function searchWithSummaries(
  query: string,
  files: CachedFile[]
): Promise<SearchResult[]> {
  if (files.length === 0) return [];

  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model:           "gpt-4o-mini",
    temperature:     0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SEARCH_SYSTEM_PROMPT },
      {
        role:    "user",
        content: `User query: "${query}"\n\nFiles (${files.length} total):\n${JSON.stringify(files, null, 2)}`,
      },
    ],
  });

  const matches = parseMatches(completion.choices[0].message.content?.trim() ?? "");
  const fileMap = new Map(files.map((f) => [f.id, f]));

  return matches
    .filter((m) => fileMap.has(m.id) && m.relevanceScore > 0.2)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .map((m) => ({
      file:           fileMap.get(m.id)!,
      relevanceScore: m.relevanceScore,
      reason:         m.reason,
    }));
}

export type FileForSummary = {
  id:              string;
  name:            string;
  mimeType:        string;
  modifiedTime:    string;
  lastEditedBy?:   string;
  owner?:          string;
  description?:    string;
  contentSnippet?: string;
};

// Summarize a batch of files — called during indexing
export async function summarizeFiles(
  files: FileForSummary[]
): Promise<{ id: string; summary: string }[]> {
  if (files.length === 0) return [];

  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model:           "gpt-4o-mini",
    temperature:     0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
      {
        role:    "user",
        content: JSON.stringify(files, null, 2),
      },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? parsed.files ?? Object.values(parsed)[0]);
    return Array.isArray(arr) ? arr : [];
  } catch {
    console.error("OpenAI summarize returned unexpected JSON:", raw);
    return [];
  }
}

// Legacy: search raw DriveFile objects without cached summaries (fallback)
export async function searchDriveWithAI(
  query: string,
  files: DriveFile[]
): Promise<SearchResult[]> {
  const asCached: CachedFile[] = files.map((f) => ({
    id:           f.id,
    name:         f.name,
    mimeType:     f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink:  f.webViewLink,
    lastEditedBy: f.lastModifyingUser?.displayName,
    owner:        f.owners?.[0]?.displayName,
    summary:      (f as DriveFile & { contentSnippet?: string }).contentSnippet ?? f.description ?? "",
  }));
  return searchWithSummaries(query, asCached);
}
