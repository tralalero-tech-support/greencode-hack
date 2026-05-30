import { getGeminiModel } from "./client";
import type { DriveFile } from "@/lib/google/types";

export type SearchResult = {
  file: DriveFile;
  relevanceScore: number;
  reason: string;
};

type GeminiMatch = {
  id: string;
  relevanceScore: number;
  reason: string;
};

// Strips fields Gemini doesn't need to save tokens
function toSearchContext(file: DriveFile) {
  return {
    id:               file.id,
    name:             file.name,
    type:             file.mimeType,
    modified:         file.modifiedTime,
    created:          file.createdTime,
    owner:            file.owners?.[0]?.displayName,
    lastEditedBy:     file.lastModifyingUser?.displayName,
    description:      file.description ?? undefined,
    contentSnippet:   (file as DriveFile & { contentSnippet?: string }).contentSnippet ?? undefined,
  };
}

const SYSTEM_PROMPT = `You are a file search assistant for ContextOS, a smart Google Drive file manager.

The user will give you a natural language query describing a file they are looking for.
You will receive a JSON array of Google Drive file metadata objects.

Your job:
1. Identify which files match the user's query — consider file name, type, owner, who last edited it, when it was modified, description, and any content snippets.
2. Score each match from 0.0 (not relevant) to 1.0 (perfect match).
3. Return ONLY files with a score > 0.2, ranked from highest to lowest.

Respond with valid JSON only — no markdown, no explanation outside the JSON.
Format:
[
  {
    "id": "<file id>",
    "relevanceScore": 0.95,
    "reason": "Short human-readable explanation of why this matches"
  }
]

If nothing matches, return an empty array: []`;

export async function searchDriveWithGemini(
  query: string,
  files: DriveFile[]
): Promise<SearchResult[]> {
  if (files.length === 0) return [];

  const model = getGeminiModel();
  const fileContext = files.map(toSearchContext);

  const prompt = `User query: "${query}"

Drive files (${files.length} total):
${JSON.stringify(fileContext, null, 2)}`;

  const result = await model.generateContent({
    systemInstruction: SYSTEM_PROMPT,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature:      0.1, // low temp for consistent ranking
    },
  });

  const raw = result.response.text().trim();

  let matches: GeminiMatch[];
  try {
    matches = JSON.parse(raw);
    if (!Array.isArray(matches)) throw new Error("Not an array");
  } catch {
    // If Gemini returns malformed JSON fall back to empty
    console.error("Gemini returned invalid JSON:", raw);
    return [];
  }

  // Map matches back to full file objects
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
