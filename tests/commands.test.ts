import { describe, expect, it } from "vitest";
import { commandKind, parseCommand, type Command } from "@/lib/command-parser";
import { SEED_NODES } from "@/lib/graph-data";

const parse = (text: string, selectedNodeId?: string) => parseCommand(text, { nodes: SEED_NODES, selectedNodeId });
const one = (text: string, selectedNodeId?: string): Command => {
  const cmds = parse(text, selectedNodeId);
  expect(cmds).toHaveLength(1);
  return cmds[0];
};

describe("navigation commands (parsed locally)", () => {
  it.each([
    ["Zoom in.", "zoom_in"],
    ["zoom out", "zoom_out"],
    ["Rotate the graph.", "rotate"],
    ["Reset view.", "reset_view"],
    ["Go back.", "go_back"],
    ["Stop speaking.", "stop_speaking"],
    ["Read the answer.", "read_answer"],
  ])("%s → %s", (text, type) => {
    const cmd = one(text);
    expect(cmd.type).toBe(type);
  });

  it("classifies camera commands as navigation", () => {
    expect(commandKind(one("zoom in"))).toBe("navigation");
    expect(commandKind(one("rotate the graph"))).toBe("navigation");
  });
});

describe("exploration commands", () => {
  it("focuses named nodes", () => {
    expect(one("Show me the cooling system.")).toEqual({ type: "focus", nodeId: "cooling_system" });
    expect(one("Find the cooling pump.")).toEqual({ type: "focus", nodeId: "cooling_pump" });
    expect(one("Highlight the radiator.")).toEqual({ type: "focus", nodeId: "radiator" });
    expect(commandKind(one("find the cooling pump"))).toBe("exploration");
  });

  it("handles expand, related, hide and show-all", () => {
    expect(one("Expand this node.")).toEqual({ type: "expand" });
    expect(one("Expand the cooling pump.")).toEqual({ type: "expand", nodeId: "cooling_pump" });
    expect(one("Show related components.").type).toBe("show_related");
    expect(one("Hide unrelated nodes.").type).toBe("hide_unrelated");
    expect(one("Show the entire machine.").type).toBe("show_all");
  });
});

describe("technical search commands", () => {
  it.each([
    "Why is the engine overheating?",
    "What causes low coolant flow?",
    "How do I inspect the cooling pump?",
    "Find the repair procedure for the radiator.",
    "Which components are connected to the temperature sensor?",
  ])("%s → search", (text) => {
    const cmd = one(text);
    expect(cmd.type).toBe("search");
    expect(commandKind(cmd)).toBe("search");
  });

  it("routes explicit research requests to deep research", () => {
    expect(one("Do more research").type).toBe("deep_research");
    expect(one("run deep research on this").type).toBe("deep_research");
  });
});

describe("selected-node context", () => {
  it("resolves 'this component' to the selected node", () => {
    const cmd = one("Explain this component.", "cooling_pump");
    expect(cmd.type).toBe("search");
    if (cmd.type === "search") {
      expect(cmd.query).toContain("Cooling Pump");
      expect(cmd.nodeId).toBe("cooling_pump");
    }
    expect(commandKind(cmd)).toBe("explanation");
  });

  it("resolves 'it' inside a longer question", () => {
    const cmd = one("Explain how to inspect it", "radiator");
    expect(cmd).toEqual({ type: "search", query: "Explain how to inspect the Radiator", nodeId: "radiator" });
  });

  it("asks for a selection when nothing is selected", () => {
    expect(one("Explain this component").type).toBe("needs_selection");
  });
});

describe("compound commands", () => {
  it("focuses first, then searches about the focused node", () => {
    const cmds = parse("Show me the cooling pump and explain why it fails.");
    expect(cmds).toEqual([
      { type: "focus", nodeId: "cooling_pump" },
      { type: "search", query: "explain why the Cooling Pump fails", nodeId: "cooling_pump" },
    ]);
  });

  it("chains two local commands", () => {
    expect(parse("find the radiator and zoom in").map((c) => c.type)).toEqual(["focus", "zoom_in"]);
  });
});
