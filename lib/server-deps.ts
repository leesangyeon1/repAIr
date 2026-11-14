import { explainWithLlm, llmConfigured } from "./llm";
import type { RetrievalDeps } from "./retrieval";
import { tavilyConfigured, tavilySearch } from "./tavily";
import { telemConfigured, telemFetch, telemSearch } from "./telem";

/** Wire the pipeline to the real services. Keys are read from environment variables only. */
export function liveDeps(): RetrievalDeps {
  return {
    telemConfigured: telemConfigured(),
    tavilyConfigured: tavilyConfigured(),
    telemSearch,
    telemFetch: (urls) => telemFetch(urls),
    tavilySearch: (query) => tavilySearch(query, "advanced"),
    explain: llmConfigured() ? explainWithLlm : undefined,
  };
}

export async function readJsonBody(request: Request, maxBytes = 4096): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}
