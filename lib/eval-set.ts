/**
 * Demo evaluation set: does the query-to-graph mapping land on the expected node?
 * Run with `npm test` (tests/eval.test.ts prints the measured score).
 */
export type EvalCase = { question: string; selectedNodeId?: string; expectedFocusId: string };

export const EVAL_SET: EvalCase[] = [
  { question: "Why is the engine overheating?", expectedFocusId: "cooling_pump" },
  { question: "What causes low coolant flow?", expectedFocusId: "cooling_pump" },
  { question: "How do I inspect the cooling pump?", expectedFocusId: "cooling_pump" },
  { question: "Find the repair procedure for the radiator", expectedFocusId: "radiator" },
  { question: "Which components are connected to the temperature sensor?", expectedFocusId: "temperature_sensor" },
  { question: "Why does the pump not start when commanded?", expectedFocusId: "cooling_pump" },
  { question: "The temp sensor reading looks frozen, how do I verify it?", expectedFocusId: "temperature_sensor" },
  { question: "What could cause a pressure drop in the coolant line?", expectedFocusId: "coolant_pipe" },
  { question: "Is the radiator fan running at the right speed?", expectedFocusId: "cooling_fan" },
  { question: "How do I check the control unit for fault codes?", expectedFocusId: "controller" },
  { question: "Explain how to inspect it", selectedNodeId: "radiator", expectedFocusId: "radiator" },
  { question: "What does the power supply feed?", expectedFocusId: "power_supply" },
  { question: "Why is there a loss of pressure near the injector?", expectedFocusId: "fuel_injector" },
  { question: "Tell me about the cooling loop", expectedFocusId: "cooling_system" },
];
