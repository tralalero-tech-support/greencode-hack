import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing env var: OPENAI_API_KEY");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
