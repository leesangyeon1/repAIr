/**
 * Demo evaluation set: does the query-to-graph mapping land on the expected node?
 * Run with `npm test` (tests/eval.test.ts prints the measured score).
 */
import type { DatasetId } from "./types";

/** Cases without a datasetId run against the aerospace (spacecraft) graph. */
export type EvalCase = { question: string; selectedNodeId?: string; expectedFocusId: string; datasetId?: DatasetId };

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

  { datasetId: "energy", question: "Why is the gearbox overheating?", expectedFocusId: "oil_cooler" },
  { datasetId: "energy", question: "What causes high vibration in the drivetrain?", expectedFocusId: "main_bearing" },
  { datasetId: "energy", question: "How do I test the pitch backup battery?", expectedFocusId: "pitch_battery" },
  { datasetId: "energy", question: "The turbine keeps tripping, what is wrong?", expectedFocusId: "power_converter" },

  { datasetId: "manufacturing", question: "Why is the spindle overheating?", expectedFocusId: "spindle_bearing" },
  { datasetId: "manufacturing", question: "Parts are out of tolerance, what causes that?", expectedFocusId: "ball_screw" },
  { datasetId: "manufacturing", question: "How do I check the drawbar clamp force?", expectedFocusId: "drawbar" },
  { datasetId: "manufacturing", question: "What causes low coolant pressure?", expectedFocusId: "coolant_filter" },

  { datasetId: "appliance", question: "My washer won't drain", expectedFocusId: "drain_filter" },
  { datasetId: "appliance", question: "Why is there a loud noise during spin?", expectedFocusId: "drum_bearing" },
  { datasetId: "appliance", question: "How do I test the heating element?", expectedFocusId: "heating_element" },
  { datasetId: "appliance", question: "The door won't open after the wash", expectedFocusId: "door_lock" },

  { datasetId: "automotive", question: "Why is the engine misfiring?", expectedFocusId: "ignition_coil" },
  { datasetId: "automotive", question: "The car is overheating in traffic", expectedFocusId: "thermostat" },
  { datasetId: "automotive", question: "How do I inspect the spark plugs?", expectedFocusId: "spark_plug" },
  { datasetId: "automotive", question: "Check engine light is on, what does it mean?", expectedFocusId: "oxygen_sensor" },
  { datasetId: "automotive", question: "Low oil pressure warning at idle", expectedFocusId: "oil_pump" },
];
