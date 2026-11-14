# repAIr

**Explore Knowledge. Diagnose Smarter. Repair Faster.**

repAIr turns maintenance knowledge into a voice-controlled 3D knowledge graph. Machines, systems, components, symptoms, documents and repair procedures float as a holographic network in the browser. You navigate it by mouse, text or voice, and technical questions are answered with live, cited web sources retrieved through **Telem AI**, with **Tavily** as fallback and as an explicit "Deep Research" step.

> The bundled knowledge bases are **synthetic demo data** for fictional machines. They are not documentation for any real or certified machine, and the app labels them that way.

## Example datasets

Pick an industry from the **Example** switcher in the header. Each one is its own knowledge graph with matching suggestion chips, and searches and Deep Research run against the selected graph.

| Industry | Fictional machine | Try asking |
| --- | --- | --- |
| Aerospace | Spacecraft engine cooling loop | "Why is the engine overheating?" |
| Energy | 3 MW onshore wind turbine | "Why is the gearbox overheating?" |
| Manufacturing | Three-axis CNC machining center | "Parts are out of tolerance, what causes that?" |
| Electric Appliance | Front-load washing machine | "My washer won't drain" |
| Car Engine | 2.0 L four-cylinder petrol engine | "Why is the engine misfiring?" |

Datasets live in `lib/datasets/` (aerospace stays in `lib/graph-data.ts`). To add one, copy a dataset file, add its id to `DATASET_IDS` in `lib/types.ts`, register it in `lib/datasets/index.ts`, and add a few cases to `lib/eval-set.ts`. `npm test` checks every dataset's integrity and suggestions.

One Next.js app. No database, no Python, no separate backend. Deploys to Vercel as is.

## What it does

| Area | What works |
| --- | --- |
| 3D hologram | Force-directed graph (`3d-force-graph` + Three.js) with custom glowing nodes, halos, wireframe shells, labels, starfield, bloom, particles on active links, smooth camera flights |
| Mouse | Left-drag orbit, wheel zoom, right-drag pan, hover tooltip, click to focus, double-click to expand, selection highlights neighbours and dims the rest |
| Voice | Push-to-talk speech recognition, spoken answers, voice-output toggle, text fallback everywhere |
| Commands | Navigation and exploration parsed locally with no API call; compound commands ("show me the cooling pump and explain why it fails"); "this/it" resolves to the selected node |
| Search | Query understanding, component-aware query expansion, Telem multi-provider search, de-duplication, ranking, Telem page fetch for fuller text, evidence selection, citations |
| Graph updates | Expanding a node reveals its seeded neighbourhood and adds live source documents as new, clickable nodes with stable ids |
| Transparency | Search Intelligence panel shows original and expanded query, providers, per-provider status and latency, source count, timings, evidence, and fallback status |

## Quick start

```bash
npm install
cp .env.example .env.local   # then add your keys
npm run dev                  # http://localhost:3000
```

The app works immediately without keys (interactive demo mode). Add keys to switch on live search.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEM_API_KEY` | for live search | Primary retrieval through `https://router.telem.ai` |
| `TAVILY_API_KEY` | for fallback and Deep Research | Direct Tavily search |
| `ANTHROPIC_API_KEY` | optional | Lets an LLM summarise the selected evidence quotes. Without it, answers are extractive quotes |

Keys are read only in server Route Handlers. `GET /api/health` reports whether each key is present and never returns key material.

### Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
```

## Modes

- **Interactive demo mode** (no keys): the seeded graph, mouse and voice navigation, node details and graph-based answers all work. Search controls say that live search is not configured. No sources are shown.
- **Live search mode** (keys set): real sources, real provider metadata, citations, and source nodes added to the graph.
- **Cached-result fallback**: not included. The spec made it optional, and no genuine captured retrievals were available to ship, so nothing is presented as cached or live that is not.

If a configured key is rejected or a call fails, the app says so: the header pill turns red and the retrieval log shows the error returned. It never substitutes invented results.

## How retrieval works

```
question
  → intent classification (diagnostic / procedure / relationship / explanation / general)
  → match graph nodes in the text (names + aliases, longest phrase wins)
  → follow graph relations (e.g. symptom → MAY_CAUSE → components) to pick a focus node
  → component-aware query expansion
  → Telem POST /v1/search   (auto_routing: accuracy; retried with pinned exa + brave if rejected or empty)
  → Tavily direct search    (only if Telem failed or returned nothing relevant)
  → de-duplicate by canonical URL, remembering every provider that returned a page
  → rank by term relevance (graph-derived terms weigh double)
  → Telem POST /v1/fetch for fuller text of the top Telem-sourced results
  → select evidence quotes above a relevance threshold
  → answer + highlight nodes + (on expand) new source nodes
```

Design choices worth knowing:

- **Telem's response is parsed as documented**: `preprocessor_runs[]` holds one envelope per provider with its own status, latency, error and `output_payload.results`. Provider provenance is kept on every source, and `routing` is shown when Telem returns it.
- **Search routing**: questions about how parts relate ("which components are connected to…") are answered from the graph and make no external call.
- **Tavily is not called on every query.** It runs as fallback (the reason is displayed) or when you press **Deep Research**. A Tavily call routed by Telem shows up as a Telem provider; a direct call is logged separately as `tavily-direct`.
- **No generated claims without an LLM key.** The default answer quotes passages verbatim from the retrieved pages. If nothing passes the threshold, the app says evidence is incomplete.
- **Graph context is kept apart from evidence.** What the seeded graph says is shown in its own box, labelled synthetic and unverified.
- **Source nodes only.** Expansion adds nodes for retrieved source documents. It never invents procedures from a search result title.
- **Numbers shown are real.** Latency is either measured by the app around the request or reported by Telem per provider, and each is labelled. The relevance score is repAIr's own and is labelled as such.

### API

| Route | Purpose |
| --- | --- |
| `POST /api/search` | `{ query, selectedNodeId?, mode?: "normal" \| "expand" }` → answer, focus and highlight node ids, new nodes and links, sources, evidence, retrieval log |
| `POST /api/research` | `{ query, selectedNodeId? }` → same shape, from one direct Tavily search |
| `GET /api/health` | `{ status, telemConfigured, tavilyConfigured, llmConfigured }` |

Requests and responses are validated with shared Zod schemas in `lib/types.ts`. Queries are limited to 300 characters, bodies to 4 KB, and every upstream call has a timeout. The server only ever calls Telem and Tavily; page fetches are restricted to URLs that Telem search itself returned.

## Voice commands

Press the microphone, speak one command, and it runs. Listening never starts by itself, and the microphone and speech output are mutually exclusive so the app does not hear its own voice. Speech recognition needs a Chromium-based browser or Safari; elsewhere the same commands work typed.

| Kind | Examples |
| --- | --- |
| Navigation | "Zoom in", "Zoom out", "Rotate the graph", "Reset view", "Go back" |
| Exploration | "Show me the cooling system", "Find the cooling pump", "Highlight the radiator", "Expand this node", "Show related components", "Hide unrelated nodes", "Show the entire machine" |
| Technical search | "Why is the engine overheating?", "What causes low coolant flow?", "How do I inspect the cooling pump?" |
| Explanation | "Explain this component", "Read the answer", "Stop speaking" |
| Compound | "Show me the cooling pump and explain why it fails" |
| Research | "Do more research" (runs Deep Research) |

## Project structure

```text
app/
  page.tsx                  main client page: state, command execution, layout
  layout.tsx, globals.css
  api/search|research|health/route.ts
components/
  HolographicGraph.tsx      WebGL scene (client only, loaded with ssr: false)
  GraphToolbar.tsx  CommandBar.tsx  VoiceControls.tsx
  KnowledgePanel.tsx  SearchIntelligencePanel.tsx  GraphErrorBoundary.tsx
hooks/useVoiceCommands.ts   speech recognition + synthesis
lib/
  graph-data.ts             synthetic seed graph (29 nodes, 62 links)
  graph-utils.ts            lookup, neighbours, merge without duplicates, stable ids
  command-parser.ts         deterministic command parsing
  telem.ts  tavily.ts       service clients and response normalisation
  retrieval.ts              the pipeline above
  llm.ts                    optional grounded-summary adapter
  types.ts                  shared types and Zod schemas
  eval-set.ts               demo evaluation questions
tests/                      Vitest suites and fixtures
```

## Tests

`npm test` runs 55 tests covering node lookup, neighbour detection, duplicate prevention, command classification, component selection, Telem and Tavily normalisation, and fallback behaviour (with injected services, so no network is used).

**Evaluation set** (`lib/eval-set.ts`, 14 questions): measures whether a question maps to the expected graph node. Last run: **14 of 14**. Treat this as a regression check, not a benchmark: the questions and the alias list were written together, by the same author, against a 29-node graph.

The Telem fixtures in `tests/fixtures/` are built from the field list in Telem's API reference. They are schema-compatible, not recordings of live responses.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository. The framework preset (Next.js) and build settings are detected automatically; the project root is the repository root.
3. Under **Settings → Environment Variables**, add `TELEM_API_KEY` and `TAVILY_API_KEY` (and optionally `ANTHROPIC_API_KEY`) for Production and Preview.
4. Deploy. Open the URL and check `/api/health`.
5. After changing environment variables, redeploy (**Deployments → ⋯ → Redeploy**); variables are read at build and function start, not live. Code changes redeploy on every push.

With the CLI instead:

```bash
npm i -g vercel
vercel                                  # link and create a preview deployment
vercel env add TELEM_API_KEY production
vercel env add TAVILY_API_KEY production
vercel --prod
```

Route Handlers run on the Node.js runtime with `maxDuration = 60`. If your plan caps function duration lower, lower that value in the three route files. Nothing is written to disk and no server memory is relied on between requests.

## Three-minute demo script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Open the deployed URL. Let the graph settle. | "Maintenance knowledge lives in scattered manuals. repAIr turns it into a space you can walk through." |
| 0:20 | Drag to orbit, scroll to zoom. Point at the legend. | "Cyan is the machine, blue its systems, then components, symptoms in orange." |
| 0:35 | Click **Cooling Pump**. | "Click any part: the camera flies in, its neighbours light up, and the panel shows what it connects to and how to inspect it." |
| 0:55 | Press the mic: "Show me the cooling system." | "Navigation commands are parsed in the browser. No API call, so it is instant." |
| 1:10 | Mic: "Why is the engine overheating?" | "Now a real question. repAIr recognises the symptom, follows the graph to the likely components, and sends an expanded query to Telem." |
| 1:30 | Let it read the answer. Scroll the evidence. | "These are verbatim quotes from live sources, each with its citation and the provider that found it." |
| 1:50 | Open **Search Intelligence**, scroll to the retrieval log. | "This is what Telem did: which providers its router chose, each one's status, result count and latency. Nothing here is mocked." |
| 2:10 | Mic: "Expand the cooling pump." | "Expanding brings in the manuals and procedures, plus new nodes for the live sources we just retrieved. Click one to open it." |
| 2:30 | Press **Deep Research → Run**. | "When you want a second opinion, Deep Research makes a separate, direct Tavily search, logged on its own." |
| 2:45 | "Hide unrelated nodes", then "Show the entire machine". | "Today this is one prepared dataset. The product is the same experience on your own manuals, for every technician in the field." |

If the microphone is unavailable, type the same phrases or use the suggestion chips.

## Known limitations

- **Live Telem path is not yet verified end to end.** During development the supplied Telem key was rejected by the API (`401 Invalid API key`), so parsing was written from the published API reference and tested against schema-compatible fixtures. Once a working key is in place, run one query and confirm the retrieval log looks right. In particular, the `auto_routing: "accuracy"` request (sent without a provider list) has not been exercised live; if Telem rejects it, the pipeline retries with pinned `exa` + `brave`.
- **Direct Tavily path is untested live** (no key was available). Normalisation is covered by tests against the SDK's response type.
- **Ranking is lexical.** Sources are scored by term overlap, not by meaning, so relevant pages that use different vocabulary can rank low.
- **Web sources describe comparable real equipment**, not the fictional demo machine. The app states this next to the evidence.
- **Speech recognition depends on the browser** (Chrome, Edge, Safari) and usually on a network connection.
- **Dynamic nodes are per session.** Retrieved source nodes live in browser state and vanish on reload.
- **No cached demo results** are bundled.
- **Headless verification only.** The 3D view was checked in headless Chrome with software rendering; frame rate on real hardware was not measured. A "reduce visual effects" toggle turns off bloom and lowers detail.

## Next steps

1. Ingest real manuals (PDF → entities and relations) to build the graph automatically.
2. Semantic ranking with embeddings, and claim-level verification of answers against sources.
3. Persist graphs and retrieved sources per organisation.
4. Use Telem sessions (`session_id`) to link follow-up questions into one trajectory.
5. Field mode: offline cache of the graph, work-order integration, AR overlay.
