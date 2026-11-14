import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/command-parser";
import { DATASETS } from "@/lib/datasets";
import { SEED_GRAPH, SEED_LINKS, SEED_NODES, initialGraph } from "@/lib/graph-data";
import {
  canonicalUrl,
  componentsForSymptom,
  findNodeByName,
  findOwningSystem,
  getNeighborIds,
  getNodeById,
  getSystemSubgraphIds,
  matchNodesInText,
  mergeGraph,
  sourceNodeId,
} from "@/lib/graph-utils";
import type { KnowledgeNode } from "@/lib/types";

describe("seed graph integrity", () => {
  it("has unique deterministic ids and no dangling links", () => {
    const ids = SEED_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
    for (const l of SEED_LINKS) {
      expect(ids).toContain(l.source);
      expect(ids).toContain(l.target);
    }
  });

  it("starts with 20-30 nodes and keeps every node reachable", () => {
    const g = initialGraph();
    expect(g.nodes.length).toBeGreaterThanOrEqual(20);
    expect(g.nodes.length).toBeLessThanOrEqual(30);
    for (const n of SEED_NODES) expect(getNeighborIds(SEED_LINKS, n.id).size).toBeGreaterThan(0);
  });
});

describe.each(DATASETS.map((d) => [d.id, d] as const))("%s dataset integrity", (_id, dataset) => {
  const { nodes, links } = dataset.graph;

  it("has unique deterministic ids and no dangling links", () => {
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
    for (const l of links) {
      expect(ids).toContain(l.source);
      expect(ids).toContain(l.target);
    }
  });

  it("has one machine, starts with 20-30 nodes and keeps every node reachable", () => {
    expect(nodes.filter((n) => n.type === "machine")).toHaveLength(1);
    const g = initialGraph(dataset.graph);
    expect(g.nodes.length).toBeGreaterThanOrEqual(20);
    expect(g.nodes.length).toBeLessThanOrEqual(30);
    for (const n of nodes) expect(getNeighborIds(links, n.id).size).toBeGreaterThan(0);
  });

  it("gives every symptom at least one component cause", () => {
    for (const s of nodes.filter((n) => n.type === "symptom")) {
      expect(componentsForSymptom(dataset.graph, s.id).length).toBeGreaterThan(0);
    }
  });

  it("labels the data as synthetic and offers suggestions that resolve to its nodes", () => {
    expect(dataset.label).toMatch(/synthetic/i);
    for (const text of dataset.suggestions) {
      const [command] = parseCommand(text, { nodes });
      if (/^show me/i.test(text)) expect(command.type).toBe("focus");
      if (/^expand/i.test(text)) expect(command).toMatchObject({ type: "expand", nodeId: expect.any(String) });
      if (/^why/i.test(text)) expect(command.type).toBe("search");
    }
  });
});

describe("node lookup", () => {
  it("finds nodes by id, name and alias", () => {
    expect(getNodeById(SEED_NODES, "cooling_pump")?.name).toBe("Cooling Pump");
    expect(getNodeById(SEED_NODES, "nope")).toBeUndefined();
    expect(findNodeByName(SEED_NODES, "the Cooling System")?.id).toBe("cooling_system");
    expect(findNodeByName(SEED_NODES, "coolant pump")?.id).toBe("cooling_pump");
    expect(findNodeByName(SEED_NODES, "RADIATOR!")?.id).toBe("radiator");
    expect(findNodeByName(SEED_NODES, "warp core")).toBeUndefined();
  });

  it("prefers the longest phrase and never double-counts overlapping words", () => {
    const ids = matchNodesInText(SEED_NODES, "Why is the engine overheating?").map((m) => m.node.id);
    expect(ids).toEqual(["engine_overheating"]);
    const two = matchNodesInText(SEED_NODES, "does the temperature sensor affect the radiator").map((m) => m.node.id);
    expect(two).toEqual(["temperature_sensor", "radiator"]);
  });
});

describe("neighbor detection", () => {
  it("returns neighbors in both directions", () => {
    const n = getNeighborIds(SEED_LINKS, "cooling_pump");
    for (const id of ["cooling_system", "radiator", "controller", "low_coolant_flow", "pump_maintenance_guide", "check_cooling_pump"]) {
      expect(n.has(id)).toBe(true);
    }
    expect(n.has("fuel_injector")).toBe(false);
  });

  it("lists symptom causes with the primary suspect first", () => {
    expect(componentsForSymptom(SEED_GRAPH, "engine_overheating").map((c) => c.id)).toEqual([
      "cooling_pump",
      "radiator",
      "cooling_fan",
      "temperature_sensor",
    ]);
  });

  it("resolves owning systems and system subgraphs", () => {
    expect(findOwningSystem(SEED_GRAPH, "radiator")?.id).toBe("cooling_system");
    expect(findOwningSystem(SEED_GRAPH, "verify_temperature_sensor")?.id).toBe("monitoring_system");
    const sub = getSystemSubgraphIds(SEED_GRAPH, "cooling_system");
    expect(sub.has("cooling_pump")).toBe(true);
    expect(sub.has("check_cooling_pump")).toBe(true);
    expect(sub.has("fuel_injector")).toBe(false);
  });
});

describe("duplicate prevention", () => {
  const doc: KnowledgeNode = { id: "src_abc", name: "A source", type: "document", description: "d" };

  it("does not add the same node or link twice", () => {
    const base = initialGraph();
    const link = { source: "cooling_pump", target: "src_abc", relation: "DOCUMENTED_IN" as const };
    const once = mergeGraph(base, [doc], [link]);
    expect(once.addedNodeIds).toEqual(["src_abc"]);
    const twice = mergeGraph(once, [doc, doc], [link, link]);
    expect(twice.addedNodeIds).toEqual([]);
    expect(twice.nodes.length).toBe(once.nodes.length);
    expect(twice.links.length).toBe(once.links.length);
  });

  it("skips links whose endpoints are missing", () => {
    const base = initialGraph();
    const merged = mergeGraph(base, [], [{ source: "cooling_pump", target: "ghost", relation: "CONNECTED_TO" }]);
    expect(merged.links.length).toBe(base.links.length);
  });

  it("gives the same URL the same stable node id regardless of tracking noise", () => {
    const a = sourceNodeId("https://www.Example.org/pumps/low-flow/?utm_source=x#top");
    const b = sourceNodeId("https://example.org/pumps/low-flow");
    expect(a).toBe(b);
    expect(a).toMatch(/^src_[0-9a-f]{8}$/);
    expect(sourceNodeId("https://example.org/other")).not.toBe(a);
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
  });
});
