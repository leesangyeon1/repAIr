import type { KnowledgeGraph, KnowledgeLink, KnowledgeNode, NodeType } from "./types";

/**
 * SYNTHETIC DEMO DATA.
 * This knowledge base describes a fictional spacecraft engine cooling loop. It was written
 * for the repAIr hackathon demo and is not documentation for any real or certified machine.
 */
export const DATASET_LABEL = "Synthetic demo dataset · fictional spacecraft cooling system";

export const SEED_NODES: KnowledgeNode[] = [
  {
    id: "spacecraft_engine",
    name: "Spacecraft Engine",
    type: "machine",
    description:
      "Fictional liquid-cooled orbital manoeuvring engine used as the demo machine. Five subsystems share one thermal loop and one control bus.",
    metadata: { aliases: ["engine", "the machine", "spacecraft"] },
  },

  // Systems
  {
    id: "propulsion_system",
    name: "Propulsion System",
    type: "system",
    description:
      "Combustion chamber and nozzle assembly. Its heat load is carried away by the cooling loop, so cooling faults show up here first.",
    metadata: { aliases: ["propulsion"] },
  },
  {
    id: "cooling_system",
    name: "Cooling System",
    type: "system",
    description:
      "Closed coolant loop that moves heat from the engine jacket to the radiator: pump, pipework, radiator and fan.",
    metadata: { aliases: ["cooling", "cooling loop", "coolant loop", "thermal loop"] },
  },
  {
    id: "electrical_system",
    name: "Electrical System",
    type: "system",
    description:
      "Power distribution and control electronics that drive the pump, the fan and the sensor bus.",
    metadata: { aliases: ["electrical", "electronics"] },
  },
  {
    id: "fuel_system",
    name: "Fuel System",
    type: "system",
    description: "Propellant feed line and metering hardware supplying the propulsion system.",
    metadata: { aliases: ["fuel"] },
  },
  {
    id: "monitoring_system",
    name: "Monitoring System",
    type: "system",
    description:
      "Temperature and pressure sensing that feeds the controller and the operator's fault display.",
    metadata: { aliases: ["monitoring", "sensors", "telemetry"] },
  },

  // Components
  {
    id: "cooling_pump",
    name: "Cooling Pump",
    type: "component",
    description:
      "Electrically driven centrifugal pump that circulates coolant through the engine jacket and radiator.",
    metadata: {
      aliases: ["coolant pump", "pump", "circulation pump"],
      inspection:
        "Confirm the pump receives a start command and supply voltage, listen for bearing noise or cavitation, then compare delivered flow against the loop's expected flow.",
    },
  },
  {
    id: "radiator",
    name: "Radiator",
    type: "component",
    description: "Finned heat exchanger that rejects coolant heat; depends on unobstructed coolant and air paths.",
    metadata: {
      aliases: ["heat exchanger"],
      inspection:
        "Check fins for blockage or damage, look for leaks at the headers, and compare inlet and outlet coolant temperatures under load.",
    },
  },
  {
    id: "temperature_sensor",
    name: "Temperature Sensor",
    type: "component",
    description: "Thermistor probe on the coolant outlet; its reading drives pump and fan demand.",
    metadata: {
      aliases: ["temp sensor", "thermal sensor", "thermistor", "temperature probe"],
      inspection:
        "Compare the reading against a reference thermometer, inspect the connector and harness, and check resistance against the expected curve.",
    },
  },
  {
    id: "coolant_pipe",
    name: "Coolant Pipe",
    type: "component",
    description: "Pipework and fittings joining pump, engine jacket and radiator.",
    metadata: {
      aliases: ["coolant line", "coolant hose", "pipe", "pipework", "coolant pipes"],
      inspection:
        "Walk the line for kinks, leaks and loose fittings; a restriction shows as a pressure difference across the affected section.",
    },
  },
  {
    id: "cooling_fan",
    name: "Cooling Fan",
    type: "component",
    description: "Forced-air fan that moves air across the radiator when commanded by the controller.",
    metadata: {
      aliases: ["fan", "radiator fan"],
      inspection:
        "Verify the fan spins freely, reaches commanded speed and that its blades and shroud are intact.",
    },
  },
  {
    id: "controller",
    name: "Controller",
    type: "component",
    description: "Engine control unit that reads the sensors and commands the pump and fan.",
    metadata: {
      aliases: ["control unit", "electrical controller", "ecu", "control module"],
      inspection:
        "Read stored fault codes, confirm sensor inputs are plausible, and check that pump and fan outputs switch when commanded.",
    },
  },
  {
    id: "power_supply",
    name: "Power Supply",
    type: "component",
    description: "Regulated supply feeding the controller and the pump and fan drivers.",
    metadata: {
      aliases: ["power unit", "psu", "power"],
      inspection: "Measure output voltage at rest and under pump start-up load; check fuses and connectors.",
    },
  },
  {
    id: "fuel_injector",
    name: "Fuel Injector",
    type: "component",
    description: "Metering injector that delivers propellant to the combustion chamber.",
    metadata: {
      aliases: ["injector"],
      inspection: "Check spray pattern and feed pressure, and inspect the seal for leakage.",
    },
  },
  {
    id: "pressure_sensor",
    name: "Pressure Sensor",
    type: "component",
    description: "Transducer reporting coolant line pressure to the controller.",
    metadata: {
      aliases: ["pressure transducer", "pressure probe"],
      inspection: "Compare against a calibrated gauge and inspect the sensing port for blockage.",
    },
  },

  // Symptoms
  {
    id: "engine_overheating",
    name: "Engine Overheating",
    type: "symptom",
    description: "Coolant outlet temperature climbs above its operating band during a burn.",
    metadata: {
      aliases: [
        "engine overheat",
        "engine overheats",
        "engine is overheating",
        "overheating",
        "overheat",
        "overheats",
        "running hot",
        "too hot",
      ],
    },
  },
  {
    id: "low_coolant_flow",
    name: "Low Coolant Flow",
    type: "symptom",
    description: "Measured coolant flow is below the expected value for the commanded pump speed.",
    metadata: { aliases: ["low flow", "reduced coolant flow", "poor coolant flow", "weak coolant flow"] },
  },
  {
    id: "pressure_drop",
    name: "Pressure Drop",
    type: "symptom",
    description: "Line pressure falls below its expected value, or drops sharply across one section.",
    metadata: { aliases: ["pressure loss", "low pressure", "loss of pressure", "pressure drops"] },
  },
  {
    id: "temperature_sensor_failure",
    name: "Temperature Sensor Failure",
    type: "symptom",
    description: "Temperature reading is missing, frozen or implausible compared with engine state.",
    metadata: {
      aliases: ["sensor failure", "temperature sensor fault", "bad temperature reading", "temp sensor failure"],
    },
  },
  {
    id: "pump_activation_failure",
    name: "Pump Activation Failure",
    type: "symptom",
    description: "The pump does not start, or stops, when the controller commands it on.",
    metadata: {
      aliases: [
        "pump not starting",
        "pump will not start",
        "pump won't start",
        "pump does not start",
        "pump fails to start",
        "pump failure to start",
      ],
    },
  },

  // Documents
  {
    id: "cooling_system_manual",
    name: "Cooling System Manual",
    type: "document",
    description: "Synthetic manual describing the coolant loop layout, operating limits and service intervals.",
    metadata: { synthetic: true, aliases: ["cooling manual"] },
  },
  {
    id: "pump_maintenance_guide",
    name: "Pump Maintenance Guide",
    type: "document",
    description: "Synthetic guide covering pump inspection, bearing checks and replacement criteria.",
    metadata: { synthetic: true, aliases: ["pump guide", "pump manual"] },
  },
  {
    id: "sensor_troubleshooting_guide",
    name: "Sensor Troubleshooting Guide",
    type: "document",
    description: "Synthetic guide for validating temperature and pressure sensor readings and wiring.",
    metadata: { synthetic: true, aliases: ["sensor guide"] },
  },
  {
    id: "equipment_specification",
    name: "Equipment Specification",
    type: "document",
    description: "Synthetic specification sheet listing ratings for the controller, power supply and injector.",
    metadata: { synthetic: true, aliases: ["spec sheet", "specification", "specifications"] },
  },

  // Procedures
  {
    id: "inspect_coolant_flow",
    name: "Inspect Coolant Flow",
    type: "procedure",
    description:
      "Synthetic procedure: run the pump at a fixed speed, record flow and line pressure, and compare both with expected values to locate a restriction or leak.",
    metadata: { synthetic: true },
  },
  {
    id: "check_cooling_pump",
    name: "Check Cooling Pump",
    type: "procedure",
    description:
      "Synthetic procedure: verify start command and supply voltage at the pump, check for noise and vibration, then confirm delivered flow.",
    metadata: { synthetic: true, aliases: ["check the pump", "pump check"] },
  },
  {
    id: "inspect_radiator",
    name: "Inspect Radiator",
    type: "procedure",
    description:
      "Synthetic procedure: inspect fins and headers, clear obstructions, and measure the temperature difference across the radiator.",
    metadata: { synthetic: true },
  },
  {
    id: "verify_temperature_sensor",
    name: "Verify Temperature Sensor",
    type: "procedure",
    description:
      "Synthetic procedure: compare the sensor against a reference reading and check connector, harness and resistance.",
    metadata: { synthetic: true },
  },
  {
    id: "check_electrical_controller",
    name: "Check Electrical Controller",
    type: "procedure",
    description:
      "Synthetic procedure: read fault codes, confirm supply voltage, and exercise the pump and fan outputs.",
    metadata: { synthetic: true, aliases: ["check the controller", "controller check"] },
  },
];

const link = (source: string, relation: KnowledgeLink["relation"], target: string): KnowledgeLink => ({
  source,
  target,
  relation,
});

/** Order matters for MAY_CAUSE: the first listed cause of a symptom is treated as the primary suspect. */
export const SEED_LINKS: KnowledgeLink[] = [
  link("spacecraft_engine", "HAS_SYSTEM", "propulsion_system"),
  link("spacecraft_engine", "HAS_SYSTEM", "cooling_system"),
  link("spacecraft_engine", "HAS_SYSTEM", "electrical_system"),
  link("spacecraft_engine", "HAS_SYSTEM", "fuel_system"),
  link("spacecraft_engine", "HAS_SYSTEM", "monitoring_system"),

  link("cooling_system", "HAS_COMPONENT", "cooling_pump"),
  link("cooling_system", "HAS_COMPONENT", "radiator"),
  link("cooling_system", "HAS_COMPONENT", "coolant_pipe"),
  link("cooling_system", "HAS_COMPONENT", "cooling_fan"),
  link("monitoring_system", "HAS_COMPONENT", "temperature_sensor"),
  link("monitoring_system", "HAS_COMPONENT", "pressure_sensor"),
  link("electrical_system", "HAS_COMPONENT", "controller"),
  link("electrical_system", "HAS_COMPONENT", "power_supply"),
  link("fuel_system", "HAS_COMPONENT", "fuel_injector"),

  link("fuel_system", "CONNECTED_TO", "propulsion_system"),
  link("cooling_system", "CONNECTED_TO", "propulsion_system"),
  link("cooling_pump", "CONNECTED_TO", "radiator"),
  link("cooling_pump", "CONNECTED_TO", "coolant_pipe"),
  link("coolant_pipe", "CONNECTED_TO", "radiator"),
  link("radiator", "CONNECTED_TO", "cooling_fan"),
  link("controller", "CONNECTED_TO", "cooling_pump"),
  link("controller", "CONNECTED_TO", "cooling_fan"),
  link("power_supply", "CONNECTED_TO", "controller"),
  link("power_supply", "CONNECTED_TO", "cooling_pump"),
  link("temperature_sensor", "CONNECTED_TO", "controller"),
  link("pressure_sensor", "CONNECTED_TO", "controller"),
  link("pressure_sensor", "CONNECTED_TO", "coolant_pipe"),

  link("cooling_pump", "MAY_CAUSE", "engine_overheating"),
  link("radiator", "MAY_CAUSE", "engine_overheating"),
  link("cooling_fan", "MAY_CAUSE", "engine_overheating"),
  link("temperature_sensor", "MAY_CAUSE", "engine_overheating"),
  link("low_coolant_flow", "MAY_CAUSE", "engine_overheating"),
  link("cooling_pump", "MAY_CAUSE", "low_coolant_flow"),
  link("coolant_pipe", "MAY_CAUSE", "low_coolant_flow"),
  link("radiator", "MAY_CAUSE", "low_coolant_flow"),
  link("pump_activation_failure", "MAY_CAUSE", "low_coolant_flow"),
  link("coolant_pipe", "MAY_CAUSE", "pressure_drop"),
  link("cooling_pump", "MAY_CAUSE", "pressure_drop"),
  link("fuel_injector", "MAY_CAUSE", "pressure_drop"),
  link("temperature_sensor", "MAY_CAUSE", "temperature_sensor_failure"),
  link("controller", "MAY_CAUSE", "temperature_sensor_failure"),
  link("controller", "MAY_CAUSE", "pump_activation_failure"),
  link("power_supply", "MAY_CAUSE", "pump_activation_failure"),
  link("cooling_pump", "MAY_CAUSE", "pump_activation_failure"),

  link("cooling_system", "DOCUMENTED_IN", "cooling_system_manual"),
  link("radiator", "DOCUMENTED_IN", "cooling_system_manual"),
  link("coolant_pipe", "DOCUMENTED_IN", "cooling_system_manual"),
  link("cooling_fan", "DOCUMENTED_IN", "cooling_system_manual"),
  link("cooling_pump", "DOCUMENTED_IN", "pump_maintenance_guide"),
  link("temperature_sensor", "DOCUMENTED_IN", "sensor_troubleshooting_guide"),
  link("pressure_sensor", "DOCUMENTED_IN", "sensor_troubleshooting_guide"),
  link("spacecraft_engine", "DOCUMENTED_IN", "equipment_specification"),
  link("controller", "DOCUMENTED_IN", "equipment_specification"),
  link("power_supply", "DOCUMENTED_IN", "equipment_specification"),
  link("fuel_injector", "DOCUMENTED_IN", "equipment_specification"),

  link("cooling_pump", "INSPECT_USING", "check_cooling_pump"),
  link("cooling_pump", "INSPECT_USING", "inspect_coolant_flow"),
  link("coolant_pipe", "INSPECT_USING", "inspect_coolant_flow"),
  link("radiator", "INSPECT_USING", "inspect_radiator"),
  link("temperature_sensor", "INSPECT_USING", "verify_temperature_sensor"),
  link("controller", "INSPECT_USING", "check_electrical_controller"),
  link("power_supply", "INSPECT_USING", "check_electrical_controller"),
];

export const SEED_GRAPH: KnowledgeGraph = { nodes: SEED_NODES, links: SEED_LINKS };

/** Node types shown on first load. Documents and procedures emerge when a node is expanded. */
export const INITIAL_TYPES: NodeType[] = ["machine", "system", "component", "symptom"];

export function initialGraph(): KnowledgeGraph {
  const nodes = SEED_NODES.filter((n) => INITIAL_TYPES.includes(n.type));
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, links: SEED_LINKS.filter((l) => ids.has(l.source) && ids.has(l.target)) };
}

export const NODE_STYLE: Record<NodeType, { color: string; label: string; radius: number }> = {
  machine: { color: "#22d3ee", label: "Machine", radius: 13 },
  system: { color: "#3b82f6", label: "System", radius: 8.5 },
  component: { color: "#b9ecf8", label: "Component", radius: 5.5 },
  symptom: { color: "#fb923c", label: "Symptom", radius: 4.8 },
  document: { color: "#a78bfa", label: "Document", radius: 4.2 },
  procedure: { color: "#34d399", label: "Repair procedure", radius: 4.2 },
};

export const RELATION_LABEL: Record<KnowledgeLink["relation"], string> = {
  HAS_SYSTEM: "has system",
  HAS_COMPONENT: "has component",
  CONNECTED_TO: "connected to",
  MAY_CAUSE: "may cause",
  DOCUMENTED_IN: "documented in",
  INSPECT_USING: "inspect using",
};
