import { link } from "../graph-data";
import type { Dataset, KnowledgeLink, KnowledgeNode } from "../types";

/**
 * SYNTHETIC DEMO DATA.
 * A fictional front-load washing machine, written for the repAIr hackathon demo. It is not
 * documentation for any real appliance. Always unplug an appliance before opening it.
 */
const NODES: KnowledgeNode[] = [
  {
    id: "washing_machine",
    name: "Washing Machine",
    type: "machine",
    description:
      "Fictional front-load washing machine used as the electric appliance demo: an inverter-driven drum, water fill and drain, a heater and a door interlock.",
    metadata: { aliases: ["washer", "the washer", "appliance", "laundry machine", "the machine"] },
  },

  // Systems
  {
    id: "drive_system",
    name: "Drive System",
    type: "system",
    description: "Motor, inverter, belt and drum bearing that turn the drum for washing and spinning.",
    metadata: { aliases: ["drum drive", "drive"] },
  },
  {
    id: "water_system",
    name: "Water System",
    type: "system",
    description: "Inlet valve, level sensing, drain pump and filter that fill and empty the tub.",
    metadata: { aliases: ["water supply", "plumbing", "fill and drain"] },
  },
  {
    id: "heating_system",
    name: "Heating System",
    type: "system",
    description: "Heating element and water temperature sensor that warm the wash water.",
    metadata: { aliases: ["heating"] },
  },
  {
    id: "control_electronics",
    name: "Control Electronics",
    type: "system",
    description: "Main control board and user interface that run the wash program and read every sensor.",
    metadata: { aliases: ["electronics", "control system"] },
  },
  {
    id: "safety_system",
    name: "Door Safety System",
    type: "system",
    description: "Door interlock that keeps the door shut while water or a spinning drum is present.",
    metadata: { aliases: ["safety system", "door system"] },
  },

  // Components
  {
    id: "drum_motor",
    name: "Drum Motor",
    type: "component",
    description: "Brushless motor that drives the drum through the belt.",
    metadata: {
      aliases: ["motor", "washer motor"],
      inspection: "With the washer unplugged, measure winding resistance and check that the rotor turns freely.",
    },
  },
  {
    id: "motor_inverter",
    name: "Motor Inverter",
    type: "component",
    description: "Power board that converts mains power into variable-frequency current for the drum motor.",
    metadata: {
      aliases: ["inverter", "inverter board", "motor control board"],
      inspection: "Read the stored motor error, inspect the board for burnt parts, and check the motor harness.",
    },
  },
  {
    id: "drive_belt",
    name: "Drive Belt",
    type: "component",
    description: "Ribbed belt between the motor pulley and the drum pulley.",
    metadata: {
      aliases: ["belt"],
      inspection: "Check that the belt is on both pulleys, and look for cracks, glazing or stretching.",
    },
  },
  {
    id: "drum_bearing",
    name: "Drum Bearing",
    type: "component",
    description: "Sealed bearings that support the drum shaft in the tub.",
    metadata: {
      aliases: ["bearing", "tub bearing", "drum bearings"],
      inspection: "Turn the empty drum by hand and listen for grinding, and check for rust streaks behind the drum.",
    },
  },
  {
    id: "inlet_valve",
    name: "Water Inlet Valve",
    type: "component",
    description: "Solenoid valve that lets mains water into the dispenser and tub.",
    metadata: {
      aliases: ["inlet valve", "fill valve", "water valve"],
      inspection: "Check the inlet screen for debris and measure the solenoid coil resistance.",
    },
  },
  {
    id: "water_level_sensor",
    name: "Water Level Sensor",
    type: "component",
    description: "Pressure sensor that tells the control board how much water is in the tub.",
    metadata: {
      aliases: ["pressure switch", "level sensor"],
      inspection: "Check the air hose for kinks or blockage and compare the reading with an empty and a full tub.",
    },
  },
  {
    id: "drain_pump",
    name: "Drain Pump",
    type: "component",
    description: "Small electric pump that empties the tub to the drain hose.",
    metadata: {
      aliases: ["pump", "drainage pump"],
      inspection: "Listen for the pump during a drain, check its impeller turns freely, and measure coil resistance.",
    },
  },
  {
    id: "drain_filter",
    name: "Drain Pump Filter",
    type: "component",
    description: "Removable trap in front of the drain pump that catches coins, lint and small items.",
    metadata: {
      aliases: ["pump filter", "drain filter", "lint filter", "coin trap"],
      inspection: "Drain the residual water, unscrew the filter, and clear lint or objects from the filter and housing.",
    },
  },
  {
    id: "heating_element",
    name: "Heating Element",
    type: "component",
    description: "Resistive heater under the drum that warms the wash water.",
    metadata: {
      aliases: ["heater"],
      inspection: "With the washer unplugged, measure element resistance and check insulation to earth.",
    },
  },
  {
    id: "water_temp_sensor",
    name: "Water Temperature Sensor",
    type: "component",
    description: "Thermistor that reports wash water temperature to the control board.",
    metadata: {
      aliases: ["thermistor", "temperature sensor", "ntc"],
      inspection: "Measure the sensor's resistance at room temperature and compare with its expected curve.",
    },
  },
  {
    id: "main_control_board",
    name: "Main Control Board",
    type: "component",
    description: "Board that runs the wash program and switches the valve, pump, heater and door lock.",
    metadata: {
      aliases: ["control board", "main board", "pcb"],
      inspection: "Read the error code history in service mode, and check connectors and relays for heat damage.",
    },
  },
  {
    id: "door_lock",
    name: "Door Lock",
    type: "component",
    description: "Electromechanical interlock that latches the door and confirms it is closed.",
    metadata: {
      aliases: ["door latch", "door interlock", "lid lock"],
      inspection: "Check the latch hook and strike, and confirm the lock clicks and reports locked when commanded.",
    },
  },

  // Symptoms
  {
    id: "will_not_drain",
    name: "Will Not Drain",
    type: "symptom",
    description: "Water stays in the drum at the end of a cycle or the drain step times out.",
    metadata: {
      aliases: ["won't drain", "not draining", "does not drain", "doesn't drain", "standing water"],
    },
  },
  {
    id: "will_not_spin",
    name: "Will Not Spin",
    type: "symptom",
    description: "The drum does not reach spin speed, or does not turn at all.",
    metadata: {
      aliases: ["won't spin", "not spinning", "does not spin", "doesn't spin", "drum not turning"],
    },
  },
  {
    id: "loud_noise_during_spin",
    name: "Loud Noise During Spin",
    type: "symptom",
    description: "Grinding, rumbling or banging that grows with drum speed.",
    metadata: { aliases: ["loud noise", "grinding noise", "rumbling", "banging", "noisy"] },
  },
  {
    id: "water_not_heating",
    name: "Water Not Heating",
    type: "symptom",
    description: "Wash water stays cold on a hot programme.",
    metadata: { aliases: ["not heating", "water is cold", "cold wash", "no hot water"] },
  },
  {
    id: "door_will_not_unlock",
    name: "Door Will Not Unlock",
    type: "symptom",
    description: "The door stays locked after the cycle has ended.",
    metadata: {
      aliases: ["door won't open", "door will not open", "door won't unlock", "door stuck", "door locked"],
    },
  },
  {
    id: "error_code_displayed",
    name: "Error Code Displayed",
    type: "symptom",
    description: "The display shows an error code or blinking lights and the programme stops.",
    metadata: { aliases: ["error code", "fault code", "blinking lights", "error"] },
  },

  // Documents
  {
    id: "washer_service_manual",
    name: "Washer Service Manual",
    type: "document",
    description: "Synthetic service manual covering disassembly, drive parts, water parts and the heater.",
    metadata: { synthetic: true, aliases: ["service manual", "washer manual"] },
  },
  {
    id: "error_code_table",
    name: "Error Code Table",
    type: "document",
    description: "Synthetic table of display error codes, what each one means, and the parts to check.",
    metadata: { synthetic: true, aliases: ["error code list", "error table"] },
  },
  {
    id: "wiring_diagram",
    name: "Wiring Diagram",
    type: "document",
    description: "Synthetic wiring diagram for the control board, inverter and door lock.",
    metadata: { synthetic: true, aliases: ["schematic"] },
  },

  // Procedures
  {
    id: "clean_drain_filter",
    name: "Clean Drain Pump Filter",
    type: "procedure",
    description:
      "Synthetic procedure: unplug the washer, drain residual water through the emergency hose, then remove and clean the filter.",
    metadata: { synthetic: true },
  },
  {
    id: "test_drain_pump",
    name: "Test Drain Pump",
    type: "procedure",
    description: "Synthetic procedure: run a drain-only cycle, listen for the pump, then check the impeller and coil.",
    metadata: { synthetic: true },
  },
  {
    id: "check_drum_bearing",
    name: "Check Drum Bearing",
    type: "procedure",
    description: "Synthetic procedure: rock and turn the empty drum by hand, listening for play and grinding.",
    metadata: { synthetic: true },
  },
  {
    id: "test_heating_element",
    name: "Test Heating Element",
    type: "procedure",
    description: "Synthetic procedure: unplug the washer, measure element and sensor resistance, and check for earth leakage.",
    metadata: { synthetic: true },
  },
  {
    id: "test_door_lock",
    name: "Test Door Lock",
    type: "procedure",
    description: "Synthetic procedure: inspect the latch, then confirm the lock engages and releases in service mode.",
    metadata: { synthetic: true },
  },
];

/** Order matters for MAY_CAUSE: the first listed cause of a symptom is treated as the primary suspect. */
const LINKS: KnowledgeLink[] = [
  link("washing_machine", "HAS_SYSTEM", "drive_system"),
  link("washing_machine", "HAS_SYSTEM", "water_system"),
  link("washing_machine", "HAS_SYSTEM", "heating_system"),
  link("washing_machine", "HAS_SYSTEM", "control_electronics"),
  link("washing_machine", "HAS_SYSTEM", "safety_system"),

  link("drive_system", "HAS_COMPONENT", "drum_motor"),
  link("drive_system", "HAS_COMPONENT", "motor_inverter"),
  link("drive_system", "HAS_COMPONENT", "drive_belt"),
  link("drive_system", "HAS_COMPONENT", "drum_bearing"),
  link("water_system", "HAS_COMPONENT", "inlet_valve"),
  link("water_system", "HAS_COMPONENT", "water_level_sensor"),
  link("water_system", "HAS_COMPONENT", "drain_pump"),
  link("water_system", "HAS_COMPONENT", "drain_filter"),
  link("heating_system", "HAS_COMPONENT", "heating_element"),
  link("heating_system", "HAS_COMPONENT", "water_temp_sensor"),
  link("control_electronics", "HAS_COMPONENT", "main_control_board"),
  link("safety_system", "HAS_COMPONENT", "door_lock"),

  link("main_control_board", "CONNECTED_TO", "motor_inverter"),
  link("motor_inverter", "CONNECTED_TO", "drum_motor"),
  link("drum_motor", "CONNECTED_TO", "drive_belt"),
  link("drive_belt", "CONNECTED_TO", "drum_bearing"),
  link("main_control_board", "CONNECTED_TO", "inlet_valve"),
  link("main_control_board", "CONNECTED_TO", "drain_pump"),
  link("drain_filter", "CONNECTED_TO", "drain_pump"),
  link("water_level_sensor", "CONNECTED_TO", "main_control_board"),
  link("main_control_board", "CONNECTED_TO", "heating_element"),
  link("water_temp_sensor", "CONNECTED_TO", "main_control_board"),
  link("main_control_board", "CONNECTED_TO", "door_lock"),

  link("drain_filter", "MAY_CAUSE", "will_not_drain"),
  link("drain_pump", "MAY_CAUSE", "will_not_drain"),
  link("main_control_board", "MAY_CAUSE", "will_not_drain"),
  link("drive_belt", "MAY_CAUSE", "will_not_spin"),
  link("motor_inverter", "MAY_CAUSE", "will_not_spin"),
  link("drum_motor", "MAY_CAUSE", "will_not_spin"),
  link("door_lock", "MAY_CAUSE", "will_not_spin"),
  link("will_not_drain", "MAY_CAUSE", "will_not_spin"),
  link("drum_bearing", "MAY_CAUSE", "loud_noise_during_spin"),
  link("drain_pump", "MAY_CAUSE", "loud_noise_during_spin"),
  link("drive_belt", "MAY_CAUSE", "loud_noise_during_spin"),
  link("heating_element", "MAY_CAUSE", "water_not_heating"),
  link("water_temp_sensor", "MAY_CAUSE", "water_not_heating"),
  link("main_control_board", "MAY_CAUSE", "water_not_heating"),
  link("door_lock", "MAY_CAUSE", "door_will_not_unlock"),
  link("water_level_sensor", "MAY_CAUSE", "door_will_not_unlock"),
  link("will_not_drain", "MAY_CAUSE", "door_will_not_unlock"),
  link("water_level_sensor", "MAY_CAUSE", "error_code_displayed"),
  link("inlet_valve", "MAY_CAUSE", "error_code_displayed"),
  link("drain_pump", "MAY_CAUSE", "error_code_displayed"),

  link("washing_machine", "DOCUMENTED_IN", "washer_service_manual"),
  link("drum_motor", "DOCUMENTED_IN", "washer_service_manual"),
  link("drive_belt", "DOCUMENTED_IN", "washer_service_manual"),
  link("drum_bearing", "DOCUMENTED_IN", "washer_service_manual"),
  link("inlet_valve", "DOCUMENTED_IN", "washer_service_manual"),
  link("drain_pump", "DOCUMENTED_IN", "washer_service_manual"),
  link("heating_element", "DOCUMENTED_IN", "washer_service_manual"),
  link("main_control_board", "DOCUMENTED_IN", "error_code_table"),
  link("water_level_sensor", "DOCUMENTED_IN", "error_code_table"),
  link("water_temp_sensor", "DOCUMENTED_IN", "error_code_table"),
  link("main_control_board", "DOCUMENTED_IN", "wiring_diagram"),
  link("motor_inverter", "DOCUMENTED_IN", "wiring_diagram"),
  link("door_lock", "DOCUMENTED_IN", "wiring_diagram"),

  link("drain_filter", "INSPECT_USING", "clean_drain_filter"),
  link("drain_pump", "INSPECT_USING", "test_drain_pump"),
  link("drain_pump", "INSPECT_USING", "clean_drain_filter"),
  link("drum_bearing", "INSPECT_USING", "check_drum_bearing"),
  link("heating_element", "INSPECT_USING", "test_heating_element"),
  link("water_temp_sensor", "INSPECT_USING", "test_heating_element"),
  link("door_lock", "INSPECT_USING", "test_door_lock"),
];

export const APPLIANCE_DATASET: Dataset = {
  id: "appliance",
  name: "Electric Appliance",
  label: "Synthetic demo dataset · fictional front-load washing machine",
  graph: { nodes: NODES, links: LINKS },
  suggestions: [
    "Show me the water system",
    "Why won't the washer drain?",
    "Expand the drum bearing",
    "Hide unrelated nodes",
  ],
};
