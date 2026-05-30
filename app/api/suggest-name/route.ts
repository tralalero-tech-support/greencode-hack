export async function POST(request: Request) {
  const { existingNames, addingType, purpose } = await request.json();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY not set" }, { status: 503 });
  }

  const prompt = `You are helping name a ${addingType} in a collaborative file management system.
Existing files/folders in this project: ${(existingNames as string[]).join(", ")}
${purpose ? `Purpose: ${purpose}` : ""}
Suggest one concise, descriptive name (2-4 words). Return only the name, nothing else.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    return Response.json({ error: `OpenAI: ${msg}` }, { status: 500 });
  }

  const data = await res.json();
  const name = data.choices?.[0]?.message?.content?.trim() ?? null;
  return Response.json({ name });
}
