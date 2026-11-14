# reAir
Project for the Search Hack

## Branches

We work on `main` plus four short-lived feature branches, one per area of the app.

| Branch | Owner | Scope |
|---|---|---|
| `main` | Everyone | Always demo-ready. The submission is built from here. |
| `feat/search` | Search and retrieval lead | Telem and Tavily search calls, query expansion, result normalization and ranking |
| `feat/graph` | Backend and knowledge graph lead | `components.json`, graph lookup, evidence-to-component mapping, the `/api/search` response |
| `feat/scene` | 3D frontend lead | 3D scene, component highlighting, camera focus |
| `feat/ui` | Product and UX lead | Search panel, source cards, Telem search trace panel |

Telem and Tavily share `feat/search` because both are search providers and touch the same files.

### Why we branch

- **`main` stays working.** Half-finished work on one branch cannot break the demo or anyone else's setup.
- **We can work in parallel.** Each branch mostly touches its own folder, so we do not overwrite each other.
- **Unfinished work is easy to leave out.** At feature freeze, a branch that is not ready is simply not merged.

### Rules

- Before branching, commit the shared contract to `main`: the folder skeleton, the `/api/search` response format, and the five component IDs.
- Merge into `main` in small pieces every 30 to 60 minutes. Do not save one large merge for the end.
- Keep API keys (Telem, Tavily) in `.env` only. Never commit them.
