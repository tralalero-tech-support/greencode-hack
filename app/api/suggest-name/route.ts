import { getOpenAIClient } from "@/lib/gemini/client";

export async function POST(request: Request) {
  const { kind, fileType, purpose, existingNames } = await request.json() as {
    kind: "folder" | "file";
    fileType?: string;
    purpose: string;
    existingNames: string[];
  };

  if (!purpose?.trim()) {
    return Response.json({ error: "purpose is required" }, { status: 400 });
  }

  try {
    const client = getOpenAIClient();
    const typeDesc = kind === "folder"
      ? "folder"
      : fileType === "presentation" ? "slide deck / presentation"
      : fileType === "spreadsheet" ? "spreadsheet"
      : "document";

    const existingList = existingNames.length > 0
      ? `\nExisting names to avoid: ${existingNames.map(n => `"${n}"`).join(", ")}`
      : "";

    const prompt = `Suggest a concise, descriptive ${typeDesc} name for the following purpose: "${purpose}".${existingList}

Requirements:
- Short (2-5 words max)
- Descriptive and professional
- Must not conflict with existing names
- No file extensions
- Return ONLY the name, nothing else`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 30,
      temperature: 0.7,
    });

    const suggestion = response.choices[0]?.message?.content?.trim() ?? "";
    return Response.json({ suggestion });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "AI error" }, { status: 500 });
  }
}
