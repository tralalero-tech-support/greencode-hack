export async function enrichFile(filename: string) {
  const prompt = `
You are a file intelligence assistant. Given a filename, generate metadata for it.

Filename: "${filename}"

Respond ONLY with a JSON object in this exact format, no markdown, no explanation:
{
  "title": "clean human readable title",
  "summary": "one sentence describing what this file likely is",
  "tags": ["tag1", "tag2", "tag3"],
  "status": "Draft" | "Final" | "Template" | "Archive"
}

Rules:
- title should be clean and professional, no underscores or version numbers
- status is "Final" if the filename contains final/done/approved/submitted
- status is "Draft" if it contains draft/v1/v2/wip/temp
- status is "Template" if it contains template/blank/base
- status is "Archive" if it contains old/backup/archive/deprecated
- otherwise status is "Draft"
- tags should reflect the likely topic based on the filename
`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  })

  const data = await res.json()
  const text = data.choices[0].message.content.trim()

  try {
    return JSON.parse(text)
  } catch {
    // If GPT returns something unparseable, return a safe fallback
    return {
      title: filename.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' '),
      summary: 'Could not generate summary.',
      tags: [],
      status: 'Draft'
    }
  }
}