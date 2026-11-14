import { getNodeById, matchNodesInText, normalize } from "./graph-utils";
import type { KnowledgeNode } from "./types";

export type Command =
  | { type: "zoom_in" }
  | { type: "zoom_out" }
  | { type: "rotate" }
  | { type: "stop_rotate" }
  | { type: "reset_view" }
  | { type: "go_back" }
  | { type: "focus"; nodeId: string }
  /** nodeId omitted = expand the currently selected node. */
  | { type: "expand"; nodeId?: string }
  | { type: "show_related" }
  | { type: "hide_unrelated" }
  | { type: "show_all" }
  | { type: "search"; query: string; nodeId?: string }
  | { type: "deep_research" }
  | { type: "read_answer" }
  | { type: "stop_speaking" }
  | { type: "needs_selection"; text: string };

export type CommandKind = "navigation" | "exploration" | "search" | "explanation";

export type ParseContext = {
  nodes: KnowledgeNode[];
  selectedNodeId?: string | null;
};

const FOCUS_VERBS =
  /^(?:please )?(?:show me|show|find|go to|focus on|focus|highlight|open|select|locate|zoom to|zoom into|take me to|navigate to|fly to)\s+(.+)$/;

const FILLER = new Set(["the", "a", "an", "me", "my", "please", "node", "component", "part", "symptom"]);

const PRONOUN =/\b(this component|this node|this part|this one|this|that|it)\b/;

/** Replace the first deictic reference ("it", "this component") with the node's name. */
export function resolvePronoun(text: string, nodeName: string): string {
  return text.replace(new RegExp(PRONOUN.source, "i"), `the ${nodeName}`);
}

function bestMatch(nodes: KnowledgeNode[], text: string): KnowledgeNode | undefined {
  const matches = matchNodesInText(nodes, text);
  if (!matches.length) return undefined;
  return [...matches].sort((a, b) => b.length - a.length || a.start - b.start)[0].node;
}

/** Deterministic commands that never need a network call. */
function parseSimple(t: string): Command | null {
  if (/^(?:please )?zoom in\b/.test(t) || /^(?:move |get )?closer$/.test(t)) return { type: "zoom_in" };
  if (/^(?:please )?zoom out\b/.test(t) || /^(?:move )?(?:further|farther)(?: away)?$/.test(t))
    return { type: "zoom_out" };
  if (/^stop (?:rotating|rotation|spinning|the rotation)\b/.test(t)) return { type: "stop_rotate" };
  if (/^(?:please )?(?:rotate|spin)(?: the)?(?: graph| view| hologram| network| universe)?$/.test(t))
    return { type: "rotate" };
  if (
    /^(?:please )?(?:reset|recenter|re center)(?: the)?(?: view| camera| graph)?$/.test(t) ||
    /^(?:go )?home$/.test(t)
  )
    return { type: "reset_view" };
  if (/^(?:go )?back$/.test(t) || /^(?:go to )?(?:the )?previous(?: node)?$/.test(t)) return { type: "go_back" };
  if (/^(?:stop|quit)(?: speaking| talking| reading)?$/.test(t) || /^(?:be )?(?:quiet|silent)$/.test(t))
    return { type: "stop_speaking" };
  if (
    /^(?:read|speak|say)(?: me)?(?: the| that)?(?: answer| explanation| result)(?: aloud| out loud)?$/.test(t) ||
    /^read (?:it|that)(?: aloud| out loud| out)?$/.test(t)
  )
    return { type: "read_answer" };
  if (
    /^show(?: me)?(?: the)? (?:entire|whole|full|complete) (?:machine|graph|network|universe)$/.test(t) ||
    /^show (?:all|everything|all nodes|all the nodes)$/.test(t)
  )
    return { type: "show_all" };
  if (/^hide(?: the)? unrelated(?: nodes| components)?$/.test(t) || /^isolate(?: this| it)?$/.test(t))
    return { type: "hide_unrelated" };
  if (
    /^show(?: me)?(?: the)? (?:related|connected)(?: components| nodes| parts)?$/.test(t) ||
    /^show(?: me)?(?: the)? connections$/.test(t)
  )
    return { type: "show_related" };
  if (/^expand(?: this| it| that| the| selected| the selected)?(?: node| component| one)?$/.test(t))
    return { type: "expand" };
  if (
    /\bdeep research\b/.test(t) ||
    /^(?:do |run |find )?(?:more|additional|further) research\b/.test(t) ||
    /^research (?:this|it|that)?\s*(?:further|deeper|more)$/.test(t)
  )
    return { type: "deep_research" };
  return null;
}

/**
 * Turn typed or spoken text into an ordered list of commands.
 * Navigation and exploration are parsed locally; anything else becomes a `search` command for
 * the retrieval pipeline. Compound requests ("show me the cooling pump and explain why it
 * fails") yield a focus command followed by a search that refers to the focused node.
 */
export function parseCommand(text: string, ctx: ParseContext): Command[] {
  const raw = text.trim().replace(/[.?!]+$/g, "");
  const t = normalize(raw);
  if (!t) return [];

  const simple = parseSimple(t);
  if (simple) return [simple];

  const selected = getNodeById(ctx.nodes, ctx.selectedNodeId);

  // "expand the cooling pump"
  const expand = /^(?:please )?expand\s+(.+)$/.exec(t);
  if (expand) {
    const node = bestMatch(ctx.nodes, expand[1]);
    return node ? [{ type: "expand", nodeId: node.id }] : [{ type: "expand" }];
  }

  // "show me X [and <something else>]"
  const focus = FOCUS_VERBS.exec(t);
  if (focus) {
    const rest = focus[1];
    const split = /^(.*?)\s+(?:and then|then|and)\s+(.+)$/.exec(rest);
    const head = split ? split[1] : rest;
    const tail = split ? split[2] : "";
    const headMatch = [...matchNodesInText(ctx.nodes, head)].sort(
      (a, b) => b.length - a.length || a.start - b.start,
    )[0];
    const headNode = headMatch?.node;
    // Only a plain "show me <node>" is navigation. "Find the repair procedure for the radiator"
    // has words left over once the node name is removed, so it falls through to search.
    const leftover = headMatch
      ? normalize(head)
          .replace(headMatch.phrase, " ")
          .split(" ")
          .filter((w) => w && !FILLER.has(w))
      : [];
    const headIsJustNode = !!headNode && leftover.length === 0;
    if (headNode && headIsJustNode) {
      const commands: Command[] = [{ type: "focus", nodeId: headNode.id }];
      if (tail) commands.push(...parseCommand(tail, { nodes: ctx.nodes, selectedNodeId: headNode.id }));
      return commands;
    }
  }

  // Technical question or explanation request → retrieval pipeline.
  const mentioned = matchNodesInText(ctx.nodes, raw);
  if (!mentioned.length && PRONOUN.test(t)) {
    if (!selected) return [{ type: "needs_selection", text: raw }];
    const resolved = resolvePronoun(raw, selected.name);
    const bare = /^(?:please )?(?:explain|describe|tell me about|what is|what's)\s+the\s+/i.test(resolved);
    const isBareExplain =
      bare && normalize(resolved).split(" ").length <= normalize(selected.name).split(" ").length + 3;
    return [
      {
        type: "search",
        query: isBareExplain
          ? `Explain the ${selected.name}: what it does and how it fails`
          : resolved,
        nodeId: selected.id,
      },
    ];
  }

  return [{ type: "search", query: raw, nodeId: selected?.id }];
}

export function commandKind(command: Command): CommandKind {
  switch (command.type) {
    case "zoom_in":
    case "zoom_out":
    case "rotate":
    case "stop_rotate":
    case "reset_view":
    case "go_back":
      return "navigation";
    case "focus":
    case "expand":
    case "show_related":
    case "hide_unrelated":
    case "show_all":
      return "exploration";
    case "read_answer":
    case "stop_speaking":
    case "needs_selection":
      return "explanation";
    case "search":
      return /^(?:please )?(?:explain|describe|tell me about)\b/i.test(command.query) ? "explanation" : "search";
    case "deep_research":
      return "search";
  }
}
