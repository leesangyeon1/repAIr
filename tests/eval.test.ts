import { describe, expect, it } from "vitest";
import { getDataset } from "@/lib/datasets";
import { EVAL_SET } from "@/lib/eval-set";
import { analyzeQuery } from "@/lib/retrieval";

describe("demo evaluation set: query → expected component", () => {
  it("has at least 10 questions", () => {
    expect(EVAL_SET.length).toBeGreaterThanOrEqual(10);
  });

  it("measures focus-node accuracy", () => {
    const rows = EVAL_SET.map((c) => {
      const got = analyzeQuery(c.question, c.selectedNodeId ?? null, getDataset(c.datasetId ?? "aerospace").graph).focusNodeId;
      return { ...c, got, pass: got === c.expectedFocusId };
    });
    const passed = rows.filter((r) => r.pass).length;
    for (const r of rows) {
      console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.datasetId ?? "aerospace"}] ${r.question}  → ${r.got ?? "none"} (expected ${r.expectedFocusId})`);
    }
    console.log(`EVAL RESULT: ${passed}/${rows.length} questions mapped to the expected node`);
    // Guardrail, not a target: the measured value is what gets reported.
    expect(passed / rows.length).toBeGreaterThanOrEqual(0.8);
  });
});
