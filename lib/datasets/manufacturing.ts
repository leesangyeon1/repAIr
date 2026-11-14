import { link } from "../graph-data";
import type { Dataset, KnowledgeLink, KnowledgeNode } from "../types";

/**
 * SYNTHETIC DEMO DATA.
 * A fictional vertical CNC machining center, written for the repAIr hackathon demo. It is not
 * documentation for any real machine tool.
 */
const NODES: KnowledgeNode[] = [
  {
    id: "cnc_machine",
    name: "CNC Machining Center",
    type: "machine",
    description:
      "Fictional three-axis vertical machining center used as the manufacturing demo machine: spindle, axis drives, coolant and an automatic tool changer.",
    metadata: { aliases: ["cnc", "cnc machine", "machining center", "mill", "the machine"] },
  },

  // Systems
  {
    id: "spindle_system",
    name: "Spindle System",
    type: "system",
    description: "Motorised spindle, its bearings, the tool clamp and the orientation encoder.",
    metadata: { aliases: ["spindle assembly"] },
  },
  {
    id: "motion_system",
    name: "Axis Motion System",
    type: "system",
    description: "X, Y and Z axes: servo drives, ball screws and linear guides that position the tool.",
    metadata: { aliases: ["motion system", "axes", "axis motion", "axis system"] },
  },
  {
    id: "coolant_system",
    name: "Coolant System",
    type: "system",
    description: "Tank, pump and filter that deliver cutting fluid to the tool and flush chips away.",
    metadata: { aliases: ["coolant", "cutting fluid"] },
  },
  {
    id: "tool_changer_system",
    name: "Automatic Tool Changer",
    type: "system",
    description: "Tool magazine and change arm that swap tools in the spindle.",
    metadata: { aliases: ["tool changer", "atc"] },
  },
  {
    id: "control_system",
    name: "Control System",
    type: "system",
    description: "CNC controller and cabinet electronics that run the part program and the machine logic.",
    metadata: { aliases: ["control cabinet", "controls"] },
  },

  // Components
  {
    id: "spindle_motor",
    name: "Spindle Motor",
    type: "component",
    description: "Built-in motor that turns the spindle up to its rated speed.",
    metadata: {
      aliases: ["spindle drive motor"],
      inspection: "Check motor current and temperature at a fixed speed, and confirm the cooling jacket flow.",
    },
  },
  {
    id: "spindle_bearing",
    name: "Spindle Bearings",
    type: "component",
    description: "Angular contact bearings that set spindle stiffness and runout.",
    metadata: {
      aliases: ["spindle bearing", "bearings", "bearing"],
      inspection: "Measure runout with a test bar and dial indicator, and listen for noise across the speed range.",
    },
  },
  {
    id: "drawbar",
    name: "Drawbar",
    type: "component",
    description: "Spring-loaded clamp that pulls the tool holder into the spindle taper.",
    metadata: {
      aliases: ["tool clamp", "drawbar clamp", "clamp"],
      inspection: "Measure clamping force with a drawbar gauge and inspect the taper for fretting or dirt.",
    },
  },
  {
    id: "spindle_encoder",
    name: "Spindle Encoder",
    type: "component",
    description: "Encoder that reports spindle position for orientation and rigid tapping.",
    metadata: {
      aliases: ["encoder"],
      inspection: "Check the cable and connector, and verify the orientation position against the reference mark.",
    },
  },
  {
    id: "ball_screw",
    name: "Ball Screw",
    type: "component",
    description: "Precision screw and nut that turn servo rotation into axis travel.",
    metadata: {
      aliases: ["ballscrew", "lead screw", "screw"],
      inspection: "Measure backlash with a dial indicator, and check the screw for wear, noise and lubrication.",
    },
  },
  {
    id: "servo_drive",
    name: "Servo Drive",
    type: "component",
    description: "Amplifier and servo motor that move one axis under controller command.",
    metadata: {
      aliases: ["servo", "axis drive", "servo amplifier", "servo motor"],
      inspection: "Read the drive alarm history, compare following error between axes, and check the motor cable.",
    },
  },
  {
    id: "linear_guide",
    name: "Linear Guide",
    type: "component",
    description: "Rails and carriages that keep each axis straight under cutting load.",
    metadata: {
      aliases: ["linear guides", "guide rail", "ways"],
      inspection: "Check lubrication, wipers and carriage preload, and look for scoring on the rails.",
    },
  },
  {
    id: "coolant_pump",
    name: "Coolant Pump",
    type: "component",
    description: "Pump that delivers cutting fluid to the nozzles and through-spindle coolant.",
    metadata: {
      aliases: ["pump"],
      inspection: "Confirm the pump runs, check outlet pressure, and listen for cavitation at low tank level.",
    },
  },
  {
    id: "coolant_filter",
    name: "Coolant Filter",
    type: "component",
    description: "Filter that removes chips and fines before the fluid returns to the pump.",
    metadata: {
      aliases: ["filter", "chip filter"],
      inspection: "Check the pressure drop across the filter and replace or clean the element when it is clogged.",
    },
  },
  {
    id: "tool_magazine",
    name: "Tool Magazine",
    type: "component",
    description: "Carousel that stores tools and presents the next tool to the change arm.",
    metadata: {
      aliases: ["carousel", "magazine", "tool carousel"],
      inspection: "Check pocket alignment and sensors, and run a slow tool change while watching each step.",
    },
  },
  {
    id: "cnc_controller",
    name: "CNC Controller",
    type: "component",
    description: "Numerical controller that interprets the part program and coordinates every drive.",
    metadata: {
      aliases: ["controller", "control unit", "nc"],
      inspection: "Read the alarm history and diagnostic screens, and confirm the I/O signals for the faulting function.",
    },
  },

  // Symptoms
  {
    id: "spindle_overheating",
    name: "Spindle Overheating",
    type: "symptom",
    description: "Spindle housing or bearing temperature rises above its limit during long cuts.",
    metadata: {
      aliases: ["spindle overheat", "spindle overheats", "spindle is hot", "overheating", "overheat", "running hot"],
    },
  },
  {
    id: "chatter",
    name: "Chatter",
    type: "symptom",
    description: "Self-excited vibration between tool and part that leaves regular marks and noise.",
    metadata: { aliases: ["chatter marks", "chattering", "vibration", "vibrating"] },
  },
  {
    id: "poor_surface_finish",
    name: "Poor Surface Finish",
    type: "symptom",
    description: "Machined surfaces are rougher than the program and tooling should produce.",
    metadata: { aliases: ["bad surface finish", "rough finish", "rough surface", "surface finish"] },
  },
  {
    id: "dimensional_error",
    name: "Dimensional Error",
    type: "symptom",
    description: "Finished parts measure outside tolerance or drift in size during a run.",
    metadata: {
      aliases: ["out of tolerance", "parts out of tolerance", "inaccurate parts", "positioning error", "dimensions are off"],
    },
  },
  {
    id: "tool_change_failure",
    name: "Tool Change Failure",
    type: "symptom",
    description: "A tool change stops part-way, drops a tool, or raises a tool changer alarm.",
    metadata: {
      aliases: ["tool change failed", "tool change fails", "tool won't change", "tool will not change", "atc alarm"],
    },
  },
  {
    id: "low_coolant_pressure",
    name: "Low Coolant Pressure",
    type: "symptom",
    description: "Coolant flow at the tool is weak or the low-pressure alarm is active.",
    metadata: { aliases: ["low coolant", "weak coolant", "coolant pressure low", "weak coolant flow"] },
  },

  // Documents
  {
    id: "spindle_service_manual",
    name: "Spindle Service Manual",
    type: "document",
    description: "Synthetic manual covering spindle bearings, the drawbar and spindle orientation.",
    metadata: { synthetic: true, aliases: ["spindle manual"] },
  },
  {
    id: "axis_maintenance_guide",
    name: "Axis Maintenance Guide",
    type: "document",
    description: "Synthetic guide to ball screw, servo and linear guide maintenance and compensation.",
    metadata: { synthetic: true, aliases: ["axis guide"] },
  },
  {
    id: "alarm_code_reference",
    name: "Alarm Code Reference",
    type: "document",
    description: "Synthetic list of controller and tool changer alarms with likely causes.",
    metadata: { synthetic: true, aliases: ["alarm codes", "alarm list"] },
  },

  // Procedures
  {
    id: "check_spindle_runout",
    name: "Check Spindle Runout",
    type: "procedure",
    description:
      "Synthetic procedure: clamp a test bar, measure runout near and far from the nose, and compare with the limit.",
    metadata: { synthetic: true, aliases: ["runout check"] },
  },
  {
    id: "check_tool_clamp",
    name: "Check Tool Clamp Force",
    type: "procedure",
    description: "Synthetic procedure: measure drawbar force with a gauge and clean and inspect the spindle taper.",
    metadata: { synthetic: true },
  },
  {
    id: "measure_backlash",
    name: "Measure Axis Backlash",
    type: "procedure",
    description: "Synthetic procedure: reverse each axis against a dial indicator and record lost motion.",
    metadata: { synthetic: true, aliases: ["backlash test"] },
  },
  {
    id: "inspect_coolant_circuit",
    name: "Inspect Coolant Circuit",
    type: "procedure",
    description: "Synthetic procedure: check tank level and concentration, clean the filter, and measure pump pressure.",
    metadata: { synthetic: true },
  },
  {
    id: "read_alarm_history",
    name: "Read Alarm History",
    type: "procedure",
    description: "Synthetic procedure: export the controller alarm log and match codes against the alarm reference.",
    metadata: { synthetic: true },
  },
];

/** Order matters for MAY_CAUSE: the first listed cause of a symptom is treated as the primary suspect. */
const LINKS: KnowledgeLink[] = [
  link("cnc_machine", "HAS_SYSTEM", "spindle_system"),
  link("cnc_machine", "HAS_SYSTEM", "motion_system"),
  link("cnc_machine", "HAS_SYSTEM", "coolant_system"),
  link("cnc_machine", "HAS_SYSTEM", "tool_changer_system"),
  link("cnc_machine", "HAS_SYSTEM", "control_system"),

  link("spindle_system", "HAS_COMPONENT", "spindle_motor"),
  link("spindle_system", "HAS_COMPONENT", "spindle_bearing"),
  link("spindle_system", "HAS_COMPONENT", "drawbar"),
  link("spindle_system", "HAS_COMPONENT", "spindle_encoder"),
  link("motion_system", "HAS_COMPONENT", "ball_screw"),
  link("motion_system", "HAS_COMPONENT", "servo_drive"),
  link("motion_system", "HAS_COMPONENT", "linear_guide"),
  link("coolant_system", "HAS_COMPONENT", "coolant_pump"),
  link("coolant_system", "HAS_COMPONENT", "coolant_filter"),
  link("tool_changer_system", "HAS_COMPONENT", "tool_magazine"),
  link("control_system", "HAS_COMPONENT", "cnc_controller"),

  link("spindle_motor", "CONNECTED_TO", "spindle_bearing"),
  link("spindle_encoder", "CONNECTED_TO", "spindle_motor"),
  link("spindle_encoder", "CONNECTED_TO", "cnc_controller"),
  link("cnc_controller", "CONNECTED_TO", "spindle_motor"),
  link("cnc_controller", "CONNECTED_TO", "servo_drive"),
  link("servo_drive", "CONNECTED_TO", "ball_screw"),
  link("ball_screw", "CONNECTED_TO", "linear_guide"),
  link("coolant_pump", "CONNECTED_TO", "coolant_filter"),
  link("tool_magazine", "CONNECTED_TO", "drawbar"),
  link("cnc_controller", "CONNECTED_TO", "tool_magazine"),

  link("spindle_bearing", "MAY_CAUSE", "spindle_overheating"),
  link("spindle_motor", "MAY_CAUSE", "spindle_overheating"),
  link("spindle_bearing", "MAY_CAUSE", "chatter"),
  link("drawbar", "MAY_CAUSE", "chatter"),
  link("linear_guide", "MAY_CAUSE", "chatter"),
  link("drawbar", "MAY_CAUSE", "poor_surface_finish"),
  link("coolant_filter", "MAY_CAUSE", "poor_surface_finish"),
  link("chatter", "MAY_CAUSE", "poor_surface_finish"),
  link("ball_screw", "MAY_CAUSE", "dimensional_error"),
  link("servo_drive", "MAY_CAUSE", "dimensional_error"),
  link("linear_guide", "MAY_CAUSE", "dimensional_error"),
  link("spindle_overheating", "MAY_CAUSE", "dimensional_error"),
  link("drawbar", "MAY_CAUSE", "tool_change_failure"),
  link("tool_magazine", "MAY_CAUSE", "tool_change_failure"),
  link("spindle_encoder", "MAY_CAUSE", "tool_change_failure"),
  link("cnc_controller", "MAY_CAUSE", "tool_change_failure"),
  link("coolant_filter", "MAY_CAUSE", "low_coolant_pressure"),
  link("coolant_pump", "MAY_CAUSE", "low_coolant_pressure"),

  link("cnc_machine", "DOCUMENTED_IN", "alarm_code_reference"),
  link("spindle_motor", "DOCUMENTED_IN", "spindle_service_manual"),
  link("spindle_bearing", "DOCUMENTED_IN", "spindle_service_manual"),
  link("drawbar", "DOCUMENTED_IN", "spindle_service_manual"),
  link("spindle_encoder", "DOCUMENTED_IN", "spindle_service_manual"),
  link("ball_screw", "DOCUMENTED_IN", "axis_maintenance_guide"),
  link("servo_drive", "DOCUMENTED_IN", "axis_maintenance_guide"),
  link("linear_guide", "DOCUMENTED_IN", "axis_maintenance_guide"),
  link("cnc_controller", "DOCUMENTED_IN", "alarm_code_reference"),
  link("tool_magazine", "DOCUMENTED_IN", "alarm_code_reference"),

  link("spindle_bearing", "INSPECT_USING", "check_spindle_runout"),
  link("drawbar", "INSPECT_USING", "check_tool_clamp"),
  link("ball_screw", "INSPECT_USING", "measure_backlash"),
  link("servo_drive", "INSPECT_USING", "measure_backlash"),
  link("coolant_pump", "INSPECT_USING", "inspect_coolant_circuit"),
  link("coolant_filter", "INSPECT_USING", "inspect_coolant_circuit"),
  link("cnc_controller", "INSPECT_USING", "read_alarm_history"),
  link("tool_magazine", "INSPECT_USING", "read_alarm_history"),
];

export const MANUFACTURING_DATASET: Dataset = {
  id: "manufacturing",
  name: "Manufacturing",
  label: "Synthetic demo dataset · fictional CNC machining center",
  graph: { nodes: NODES, links: LINKS },
  suggestions: [
    "Show me the spindle system",
    "Why is the spindle overheating?",
    "Expand the ball screw",
    "Hide unrelated nodes",
  ],
};
