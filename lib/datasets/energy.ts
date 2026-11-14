import { link } from "../graph-data";
import type { Dataset, KnowledgeLink, KnowledgeNode } from "../types";

/**
 * SYNTHETIC DEMO DATA.
 * A fictional onshore wind turbine, written for the repAIr hackathon demo. It is not
 * documentation for any real or certified turbine.
 */
const NODES: KnowledgeNode[] = [
  {
    id: "wind_turbine",
    name: "Wind Turbine",
    type: "machine",
    description:
      "Fictional 3 MW onshore wind turbine used as the energy demo machine. Rotor torque passes through a geared drivetrain to a generator and a grid converter.",
    metadata: { aliases: ["turbine", "the machine"] },
  },

  // Systems
  {
    id: "drivetrain_system",
    name: "Drivetrain",
    type: "system",
    description: "Main shaft, main bearing, gearbox and generator, plus the gearbox lubrication and oil cooling circuit.",
    metadata: { aliases: ["drive train", "drivetrain system"] },
  },
  {
    id: "pitch_system",
    name: "Pitch System",
    type: "system",
    description: "Electric drives that turn each blade to control rotor speed and to feather the blades in a stop.",
    metadata: { aliases: ["pitch", "blade pitch"] },
  },
  {
    id: "yaw_system",
    name: "Yaw System",
    type: "system",
    description: "Drives that turn the nacelle to face the wind, steered by the wind sensor on the nacelle roof.",
    metadata: { aliases: ["yaw"] },
  },
  {
    id: "power_system",
    name: "Power Electronics",
    type: "system",
    description: "Converter and grid connection that turn variable-frequency generator output into grid power.",
    metadata: { aliases: ["electrical system", "grid connection", "power system"] },
  },
  {
    id: "condition_monitoring",
    name: "Condition Monitoring System",
    type: "system",
    description: "Vibration and weather sensing that feeds the turbine controller and the remote SCADA view.",
    metadata: { aliases: ["condition monitoring", "monitoring", "scada", "sensors"] },
  },

  // Components
  {
    id: "main_bearing",
    name: "Main Bearing",
    type: "component",
    description: "Large rolling bearing that carries the rotor weight and thrust on the main shaft.",
    metadata: {
      aliases: ["rotor bearing", "main shaft bearing"],
      inspection:
        "Review the vibration trend at the bearing, check grease condition and purge, and listen for low-frequency rumble at slow rotor speed.",
    },
  },
  {
    id: "gearbox",
    name: "Gearbox",
    type: "component",
    description: "Multi-stage planetary and parallel gearbox that steps rotor speed up to generator speed.",
    metadata: {
      aliases: ["gear box", "gears"],
      inspection:
        "Inspect gear teeth through the inspection ports, check oil temperature against load, and look for metal particles on the debris sensor.",
    },
  },
  {
    id: "gearbox_oil_pump",
    name: "Gearbox Oil Pump",
    type: "component",
    description: "Electric pump that circulates lubricating oil through the gearbox, filter and oil cooler.",
    metadata: {
      aliases: ["oil pump", "lube pump", "lubrication pump"],
      inspection: "Confirm the pump runs when commanded and that oil pressure and flow reach their expected values.",
    },
  },
  {
    id: "oil_cooler",
    name: "Gearbox Oil Cooler",
    type: "component",
    description: "Air-to-oil heat exchanger with a fan that removes gearbox heat.",
    metadata: {
      aliases: ["oil cooler", "cooler", "oil cooler fan"],
      inspection: "Check the cooler core for dirt or blockage, confirm the fan runs, and compare oil temperature in and out.",
    },
  },
  {
    id: "generator",
    name: "Generator",
    type: "component",
    description: "Doubly fed induction generator driven by the gearbox high-speed shaft.",
    metadata: {
      aliases: ["alternator"],
      inspection: "Measure winding insulation resistance, check slip rings and brushes, and review bearing temperatures.",
    },
  },
  {
    id: "power_converter",
    name: "Power Converter",
    type: "component",
    description: "Back-to-back converter that controls generator current and matches grid frequency.",
    metadata: {
      aliases: ["converter", "inverter", "grid converter"],
      inspection: "Read the converter fault log, check cooling fans and filters, and inspect DC-link capacitors for swelling.",
    },
  },
  {
    id: "pitch_motor",
    name: "Pitch Motor",
    type: "component",
    description: "Electric motor and gear that turns one blade about its long axis.",
    metadata: {
      aliases: ["pitch drive", "pitch motors"],
      inspection: "Run a manual pitch test and compare blade angle, speed and motor current with the other two blades.",
    },
  },
  {
    id: "pitch_battery",
    name: "Pitch Backup Battery",
    type: "component",
    description: "Battery bank that powers an emergency blade feather when grid power is lost.",
    metadata: {
      aliases: ["backup battery", "pitch battery", "battery"],
      inspection: "Run the battery capacity test and check cell voltages and the charger status.",
    },
  },
  {
    id: "yaw_drive",
    name: "Yaw Drive",
    type: "component",
    description: "Motor and gear set that rotates the nacelle on the yaw bearing.",
    metadata: {
      aliases: ["yaw motor", "yaw drives"],
      inspection: "Check yaw brake pressure, listen for noise while yawing, and compare nacelle heading with wind direction.",
    },
  },
  {
    id: "vibration_sensor",
    name: "Vibration Sensor",
    type: "component",
    description: "Accelerometers on the main bearing, gearbox and generator.",
    metadata: {
      aliases: ["accelerometer", "vibration probe"],
      inspection: "Check mounting torque and cabling, then compare the signal with a portable reference sensor.",
    },
  },
  {
    id: "anemometer",
    name: "Anemometer",
    type: "component",
    description: "Wind speed and direction sensor on the nacelle roof used for yaw and power control.",
    metadata: {
      aliases: ["wind sensor", "wind speed sensor", "wind vane"],
      inspection: "Check for ice or damage, confirm the heater works, and compare readings with a nearby met mast or turbine.",
    },
  },

  // Symptoms
  {
    id: "gearbox_overheating",
    name: "Gearbox Overheating",
    type: "symptom",
    description: "Gearbox oil or bearing temperature rises above its limit and the turbine derates or stops.",
    metadata: {
      aliases: [
        "gearbox overheat",
        "gearbox overheats",
        "gearbox is overheating",
        "overheating",
        "overheat",
        "running hot",
        "high oil temperature",
      ],
    },
  },
  {
    id: "high_vibration",
    name: "High Vibration",
    type: "symptom",
    description: "Vibration level in the drivetrain exceeds its alarm threshold.",
    metadata: { aliases: ["vibration", "excessive vibration", "vibrating", "shaking"] },
  },
  {
    id: "reduced_power_output",
    name: "Reduced Power Output",
    type: "symptom",
    description: "Power is below the expected power curve for the measured wind speed.",
    metadata: { aliases: ["low power", "low power output", "low output", "power drop", "underperforming"] },
  },
  {
    id: "pitch_fault",
    name: "Pitch Fault",
    type: "symptom",
    description: "A blade fails to reach its commanded angle or the pitch system reports an error.",
    metadata: { aliases: ["pitch error", "pitch failure", "blade pitch fault"] },
  },
  {
    id: "converter_trip",
    name: "Converter Trip",
    type: "symptom",
    description: "The converter disconnects from the grid and the turbine stops producing.",
    metadata: { aliases: ["grid trip", "tripping", "trips", "trip", "trips offline"] },
  },

  // Documents
  {
    id: "gearbox_service_manual",
    name: "Gearbox Service Manual",
    type: "document",
    description: "Synthetic manual for drivetrain lubrication, oil cooling and bearing service.",
    metadata: { synthetic: true, aliases: ["gearbox manual"] },
  },
  {
    id: "pitch_system_guide",
    name: "Pitch System Guide",
    type: "document",
    description: "Synthetic guide to pitch motors, backup batteries and the manual pitch test.",
    metadata: { synthetic: true, aliases: ["pitch guide"] },
  },
  {
    id: "converter_fault_codes",
    name: "Converter Fault Code List",
    type: "document",
    description: "Synthetic list of converter and generator fault codes with likely causes.",
    metadata: { synthetic: true, aliases: ["fault codes", "fault code list"] },
  },

  // Procedures
  {
    id: "check_gearbox_oil",
    name: "Check Gearbox Oil Circuit",
    type: "procedure",
    description:
      "Synthetic procedure: confirm oil pump pressure, inspect the filter and cooler core, and compare oil temperature across the cooler under load.",
    metadata: { synthetic: true, aliases: ["gearbox oil check"] },
  },
  {
    id: "inspect_main_bearing",
    name: "Inspect Main Bearing",
    type: "procedure",
    description:
      "Synthetic procedure: review vibration spectra for bearing frequencies, check grease condition, and inspect seals for leakage.",
    metadata: { synthetic: true },
  },
  {
    id: "test_pitch_battery",
    name: "Test Pitch Backup Battery",
    type: "procedure",
    description: "Synthetic procedure: run a load test on each battery bank and confirm a full emergency feather.",
    metadata: { synthetic: true },
  },
  {
    id: "verify_anemometer",
    name: "Verify Anemometer",
    type: "procedure",
    description: "Synthetic procedure: inspect the sensor, test its heater, and compare its reading with a reference.",
    metadata: { synthetic: true },
  },
  {
    id: "check_power_converter",
    name: "Check Power Converter",
    type: "procedure",
    description: "Synthetic procedure: read the fault log, check converter cooling, and inspect DC-link capacitors.",
    metadata: { synthetic: true },
  },
];

/** Order matters for MAY_CAUSE: the first listed cause of a symptom is treated as the primary suspect. */
const LINKS: KnowledgeLink[] = [
  link("wind_turbine", "HAS_SYSTEM", "drivetrain_system"),
  link("wind_turbine", "HAS_SYSTEM", "pitch_system"),
  link("wind_turbine", "HAS_SYSTEM", "yaw_system"),
  link("wind_turbine", "HAS_SYSTEM", "power_system"),
  link("wind_turbine", "HAS_SYSTEM", "condition_monitoring"),

  link("drivetrain_system", "HAS_COMPONENT", "main_bearing"),
  link("drivetrain_system", "HAS_COMPONENT", "gearbox"),
  link("drivetrain_system", "HAS_COMPONENT", "gearbox_oil_pump"),
  link("drivetrain_system", "HAS_COMPONENT", "oil_cooler"),
  link("drivetrain_system", "HAS_COMPONENT", "generator"),
  link("power_system", "HAS_COMPONENT", "power_converter"),
  link("pitch_system", "HAS_COMPONENT", "pitch_motor"),
  link("pitch_system", "HAS_COMPONENT", "pitch_battery"),
  link("yaw_system", "HAS_COMPONENT", "yaw_drive"),
  link("condition_monitoring", "HAS_COMPONENT", "vibration_sensor"),
  link("condition_monitoring", "HAS_COMPONENT", "anemometer"),

  link("drivetrain_system", "CONNECTED_TO", "power_system"),
  link("main_bearing", "CONNECTED_TO", "gearbox"),
  link("gearbox", "CONNECTED_TO", "generator"),
  link("gearbox_oil_pump", "CONNECTED_TO", "gearbox"),
  link("gearbox_oil_pump", "CONNECTED_TO", "oil_cooler"),
  link("oil_cooler", "CONNECTED_TO", "gearbox"),
  link("generator", "CONNECTED_TO", "power_converter"),
  link("pitch_battery", "CONNECTED_TO", "pitch_motor"),
  link("vibration_sensor", "CONNECTED_TO", "main_bearing"),
  link("vibration_sensor", "CONNECTED_TO", "gearbox"),
  link("anemometer", "CONNECTED_TO", "yaw_drive"),

  link("oil_cooler", "MAY_CAUSE", "gearbox_overheating"),
  link("gearbox_oil_pump", "MAY_CAUSE", "gearbox_overheating"),
  link("gearbox", "MAY_CAUSE", "gearbox_overheating"),
  link("main_bearing", "MAY_CAUSE", "high_vibration"),
  link("gearbox", "MAY_CAUSE", "high_vibration"),
  link("generator", "MAY_CAUSE", "high_vibration"),
  link("power_converter", "MAY_CAUSE", "reduced_power_output"),
  link("pitch_motor", "MAY_CAUSE", "reduced_power_output"),
  link("anemometer", "MAY_CAUSE", "reduced_power_output"),
  link("yaw_drive", "MAY_CAUSE", "reduced_power_output"),
  link("gearbox_overheating", "MAY_CAUSE", "reduced_power_output"),
  link("pitch_fault", "MAY_CAUSE", "reduced_power_output"),
  link("pitch_battery", "MAY_CAUSE", "pitch_fault"),
  link("pitch_motor", "MAY_CAUSE", "pitch_fault"),
  link("power_converter", "MAY_CAUSE", "converter_trip"),
  link("generator", "MAY_CAUSE", "converter_trip"),

  link("wind_turbine", "DOCUMENTED_IN", "gearbox_service_manual"),
  link("main_bearing", "DOCUMENTED_IN", "gearbox_service_manual"),
  link("gearbox", "DOCUMENTED_IN", "gearbox_service_manual"),
  link("gearbox_oil_pump", "DOCUMENTED_IN", "gearbox_service_manual"),
  link("oil_cooler", "DOCUMENTED_IN", "gearbox_service_manual"),
  link("pitch_motor", "DOCUMENTED_IN", "pitch_system_guide"),
  link("pitch_battery", "DOCUMENTED_IN", "pitch_system_guide"),
  link("power_converter", "DOCUMENTED_IN", "converter_fault_codes"),
  link("generator", "DOCUMENTED_IN", "converter_fault_codes"),

  link("gearbox", "INSPECT_USING", "check_gearbox_oil"),
  link("gearbox_oil_pump", "INSPECT_USING", "check_gearbox_oil"),
  link("oil_cooler", "INSPECT_USING", "check_gearbox_oil"),
  link("main_bearing", "INSPECT_USING", "inspect_main_bearing"),
  link("vibration_sensor", "INSPECT_USING", "inspect_main_bearing"),
  link("pitch_battery", "INSPECT_USING", "test_pitch_battery"),
  link("anemometer", "INSPECT_USING", "verify_anemometer"),
  link("power_converter", "INSPECT_USING", "check_power_converter"),
];

export const ENERGY_DATASET: Dataset = {
  id: "energy",
  name: "Energy",
  label: "Synthetic demo dataset · fictional wind turbine",
  graph: { nodes: NODES, links: LINKS },
  suggestions: [
    "Show me the drivetrain",
    "Why is the gearbox overheating?",
    "Expand the pitch backup battery",
    "Hide unrelated nodes",
  ],
};
