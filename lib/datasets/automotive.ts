import { link } from "../graph-data";
import type { Dataset, KnowledgeLink, KnowledgeNode } from "../types";

/**
 * SYNTHETIC DEMO DATA.
 * A fictional four-cylinder petrol car engine, written for the repAIr hackathon demo. It is not
 * workshop documentation for any real vehicle.
 */
const NODES: KnowledgeNode[] = [
  {
    id: "car_engine",
    name: "Car Engine",
    type: "machine",
    description:
      "Fictional 2.0 L four-cylinder petrol engine used as the car engine demo: coil-on-plug ignition, port fuel injection and a liquid cooling loop.",
    metadata: { aliases: ["engine", "car", "vehicle", "motor", "the machine"] },
  },

  // Systems
  {
    id: "ignition_system",
    name: "Ignition System",
    type: "system",
    description: "Ignition coils and spark plugs that light the mixture in each cylinder.",
    metadata: { aliases: ["ignition"] },
  },
  {
    id: "fuel_system",
    name: "Fuel System",
    type: "system",
    description: "In-tank fuel pump, fuel rail and injectors that meter fuel into each cylinder.",
    metadata: { aliases: ["fuel"] },
  },
  {
    id: "cooling_system",
    name: "Cooling System",
    type: "system",
    description: "Water pump, thermostat, radiator and coolant sensor that hold the engine at working temperature.",
    metadata: { aliases: ["cooling", "coolant system", "cooling loop"] },
  },
  {
    id: "air_intake_system",
    name: "Air Intake System",
    type: "system",
    description: "Air filter, airflow sensor and throttle body that measure and meter intake air.",
    metadata: { aliases: ["air intake", "intake"] },
  },
  {
    id: "engine_management",
    name: "Engine Management",
    type: "system",
    description: "Engine control unit and its sensors, which set fuel, spark and idle and store fault codes.",
    metadata: { aliases: ["engine management system", "ems", "emissions control"] },
  },
  {
    id: "lubrication_system",
    name: "Lubrication System",
    type: "system",
    description: "Oil pump, filter and galleries that keep oil pressure on the bearings and valvetrain.",
    metadata: { aliases: ["lubrication", "oil system"] },
  },

  // Components
  {
    id: "spark_plug",
    name: "Spark Plugs",
    type: "component",
    description: "One plug per cylinder that makes the spark across its electrode gap.",
    metadata: {
      aliases: ["spark plug", "plugs", "plug"],
      inspection: "Remove the plugs, read the electrode colour and deposits, check the gap, and look for cracked insulators.",
    },
  },
  {
    id: "ignition_coil",
    name: "Ignition Coil",
    type: "component",
    description: "Coil-on-plug unit that steps battery voltage up to fire one spark plug.",
    metadata: {
      aliases: ["coil", "coil pack", "ignition coils"],
      inspection: "Swap the suspect coil to another cylinder and check whether the misfire code follows it.",
    },
  },
  {
    id: "fuel_injector",
    name: "Fuel Injectors",
    type: "component",
    description: "Solenoid injectors that spray a metered amount of fuel into each intake port.",
    metadata: {
      aliases: ["fuel injector", "injector", "injectors"],
      inspection: "Listen for each injector clicking, measure coil resistance, and run a balance or flow test.",
    },
  },
  {
    id: "fuel_pump",
    name: "Fuel Pump",
    type: "component",
    description: "In-tank electric pump that supplies fuel at rail pressure.",
    metadata: {
      aliases: ["petrol pump", "gas pump"],
      inspection: "Listen for the pump priming at key-on, then connect a gauge and compare rail pressure with the expected value.",
    },
  },
  {
    id: "water_pump",
    name: "Water Pump",
    type: "component",
    description: "Belt-driven pump that circulates coolant through the block and radiator.",
    metadata: {
      aliases: ["coolant pump"],
      inspection: "Look for coolant weeping at the weep hole, check for shaft play, and confirm flow at the radiator.",
    },
  },
  {
    id: "thermostat",
    name: "Thermostat",
    type: "component",
    description: "Wax valve that opens at temperature to send coolant to the radiator.",
    metadata: {
      aliases: ["thermostat valve"],
      inspection: "Feel or measure the upper radiator hose as the engine warms; it should get hot once the thermostat opens.",
    },
  },
  {
    id: "radiator",
    name: "Radiator",
    type: "component",
    description: "Front heat exchanger, with an electric fan, that rejects coolant heat to the air.",
    metadata: {
      aliases: ["radiator fan", "rad"],
      inspection: "Check for external blockage and leaks, confirm the fan switches on, and compare inlet and outlet hose temperatures.",
    },
  },
  {
    id: "coolant_temp_sensor",
    name: "Coolant Temperature Sensor",
    type: "component",
    description: "Thermistor that reports coolant temperature to the engine control unit and the dashboard gauge.",
    metadata: {
      aliases: ["coolant temp sensor", "ect sensor", "temperature sensor", "temp sensor"],
      inspection: "Compare its live reading with an infrared thermometer at the housing, and check the connector.",
    },
  },
  {
    id: "mass_airflow_sensor",
    name: "Mass Airflow Sensor",
    type: "component",
    description: "Hot-wire sensor that measures the air entering the engine.",
    metadata: {
      aliases: ["maf", "maf sensor", "airflow sensor"],
      inspection: "Check live airflow at idle against the expected value, and inspect the element for dirt or oil.",
    },
  },
  {
    id: "throttle_body",
    name: "Throttle Body",
    type: "component",
    description: "Electronically controlled butterfly valve that sets intake airflow and idle air.",
    metadata: {
      aliases: ["throttle"],
      inspection: "Look for carbon build-up around the plate, and check throttle position readings through the full range.",
    },
  },
  {
    id: "oxygen_sensor",
    name: "Oxygen Sensor",
    type: "component",
    description: "Exhaust sensor that tells the control unit whether the mixture is rich or lean.",
    metadata: {
      aliases: ["o2 sensor", "lambda sensor", "oxygen sensors"],
      inspection: "Watch the live sensor voltage switch at warm idle, and check fuel trims for a lasting rich or lean bias.",
    },
  },
  {
    id: "engine_ecu",
    name: "Engine Control Unit",
    type: "component",
    description: "Computer that reads every engine sensor, drives coils and injectors, and stores diagnostic trouble codes.",
    metadata: {
      aliases: ["ecu", "ecm", "engine computer", "control unit"],
      inspection: "Read stored and pending codes with an OBD-II scanner, and check its power and ground supplies.",
    },
  },
  {
    id: "oil_pump",
    name: "Oil Pump",
    type: "component",
    description: "Crank-driven pump that pressurises engine oil.",
    metadata: {
      aliases: ["engine oil pump"],
      inspection: "Check oil level and condition first, then fit a mechanical gauge and compare pressure at idle and at 2,000 rpm.",
    },
  },

  // Symptoms
  {
    id: "engine_misfire",
    name: "Engine Misfire",
    type: "symptom",
    description: "One or more cylinders fail to fire, felt as a stumble and logged as a misfire code.",
    metadata: { aliases: ["misfire", "misfires", "misfiring", "engine misfires", "stumbling"] },
  },
  {
    id: "engine_overheating",
    name: "Engine Overheating",
    type: "symptom",
    description: "Coolant temperature climbs into the red, often in traffic or on a climb.",
    metadata: {
      aliases: [
        "engine overheat",
        "engine overheats",
        "engine is overheating",
        "overheating",
        "overheat",
        "overheats",
        "running hot",
        "temperature gauge high",
      ],
    },
  },
  {
    id: "rough_idle",
    name: "Rough Idle",
    type: "symptom",
    description: "Engine speed hunts or shakes at idle.",
    metadata: { aliases: ["idles rough", "rough idling", "shaky idle", "idle is rough", "unstable idle"] },
  },
  {
    id: "hard_starting",
    name: "Hard Starting",
    type: "symptom",
    description: "The engine cranks for a long time, or cranks but will not start.",
    metadata: {
      aliases: ["hard start", "won't start", "will not start", "does not start", "cranks but won't start"],
    },
  },
  {
    id: "check_engine_light",
    name: "Check Engine Light",
    type: "symptom",
    description: "The malfunction indicator lamp is on and a diagnostic trouble code is stored.",
    metadata: { aliases: ["engine light", "warning light", "mil", "cel"] },
  },
  {
    id: "low_oil_pressure",
    name: "Low Oil Pressure",
    type: "symptom",
    description: "The oil pressure warning lights, or measured pressure is below specification.",
    metadata: { aliases: ["oil pressure warning", "oil light", "oil pressure low"] },
  },
  {
    id: "poor_fuel_economy",
    name: "Poor Fuel Economy",
    type: "symptom",
    description: "Fuel use is clearly higher than normal for the same driving.",
    metadata: { aliases: ["bad mileage", "poor mileage", "high fuel consumption"] },
  },

  // Documents
  {
    id: "workshop_manual",
    name: "Workshop Manual",
    type: "document",
    description: "Synthetic workshop manual for ignition, fuel, intake and lubrication service.",
    metadata: { synthetic: true, aliases: ["repair manual", "service manual"] },
  },
  {
    id: "dtc_reference",
    name: "Diagnostic Trouble Code Reference",
    type: "document",
    description: "Synthetic list of OBD-II trouble codes for this engine with likely causes.",
    metadata: { synthetic: true, aliases: ["dtc list", "trouble codes", "obd codes"] },
  },
  {
    id: "cooling_service_bulletin",
    name: "Cooling System Service Bulletin",
    type: "document",
    description: "Synthetic bulletin on thermostat, water pump and radiator checks for overheating complaints.",
    metadata: { synthetic: true, aliases: ["cooling bulletin"] },
  },

  // Procedures
  {
    id: "read_obd_codes",
    name: "Read OBD-II Codes",
    type: "procedure",
    description: "Synthetic procedure: connect a scanner, record stored and pending codes and freeze-frame data, then clear and re-test.",
    metadata: { synthetic: true, aliases: ["scan for codes", "obd scan"] },
  },
  {
    id: "inspect_spark_plugs",
    name: "Inspect Spark Plugs",
    type: "procedure",
    description: "Synthetic procedure: remove each plug, compare their condition, check the gap, and refit to the specified torque.",
    metadata: { synthetic: true },
  },
  {
    id: "coil_swap_test",
    name: "Coil Swap Test",
    type: "procedure",
    description: "Synthetic procedure: move the suspect coil to another cylinder, clear codes, and see whether the misfire moves with it.",
    metadata: { synthetic: true },
  },
  {
    id: "cooling_pressure_test",
    name: "Cooling System Pressure Test",
    type: "procedure",
    description: "Synthetic procedure: pressurise the cold system with a tester, watch for pressure loss, and look for leaks.",
    metadata: { synthetic: true },
  },
  {
    id: "fuel_pressure_test",
    name: "Fuel Pressure Test",
    type: "procedure",
    description: "Synthetic procedure: fit a gauge to the rail, compare key-on, idle and hold pressure with specification.",
    metadata: { synthetic: true },
  },
];

/** Order matters for MAY_CAUSE: the first listed cause of a symptom is treated as the primary suspect. */
const LINKS: KnowledgeLink[] = [
  link("car_engine", "HAS_SYSTEM", "ignition_system"),
  link("car_engine", "HAS_SYSTEM", "fuel_system"),
  link("car_engine", "HAS_SYSTEM", "cooling_system"),
  link("car_engine", "HAS_SYSTEM", "air_intake_system"),
  link("car_engine", "HAS_SYSTEM", "engine_management"),
  link("car_engine", "HAS_SYSTEM", "lubrication_system"),

  link("ignition_system", "HAS_COMPONENT", "spark_plug"),
  link("ignition_system", "HAS_COMPONENT", "ignition_coil"),
  link("fuel_system", "HAS_COMPONENT", "fuel_injector"),
  link("fuel_system", "HAS_COMPONENT", "fuel_pump"),
  link("cooling_system", "HAS_COMPONENT", "water_pump"),
  link("cooling_system", "HAS_COMPONENT", "thermostat"),
  link("cooling_system", "HAS_COMPONENT", "radiator"),
  link("cooling_system", "HAS_COMPONENT", "coolant_temp_sensor"),
  link("air_intake_system", "HAS_COMPONENT", "mass_airflow_sensor"),
  link("air_intake_system", "HAS_COMPONENT", "throttle_body"),
  link("engine_management", "HAS_COMPONENT", "engine_ecu"),
  link("engine_management", "HAS_COMPONENT", "oxygen_sensor"),
  link("lubrication_system", "HAS_COMPONENT", "oil_pump"),

  link("ignition_coil", "CONNECTED_TO", "spark_plug"),
  link("engine_ecu", "CONNECTED_TO", "ignition_coil"),
  link("engine_ecu", "CONNECTED_TO", "fuel_injector"),
  link("fuel_pump", "CONNECTED_TO", "fuel_injector"),
  link("water_pump", "CONNECTED_TO", "thermostat"),
  link("thermostat", "CONNECTED_TO", "radiator"),
  link("radiator", "CONNECTED_TO", "water_pump"),
  link("coolant_temp_sensor", "CONNECTED_TO", "engine_ecu"),
  link("mass_airflow_sensor", "CONNECTED_TO", "engine_ecu"),
  link("throttle_body", "CONNECTED_TO", "mass_airflow_sensor"),
  link("throttle_body", "CONNECTED_TO", "engine_ecu"),
  link("oxygen_sensor", "CONNECTED_TO", "engine_ecu"),

  link("ignition_coil", "MAY_CAUSE", "engine_misfire"),
  link("spark_plug", "MAY_CAUSE", "engine_misfire"),
  link("fuel_injector", "MAY_CAUSE", "engine_misfire"),
  link("thermostat", "MAY_CAUSE", "engine_overheating"),
  link("water_pump", "MAY_CAUSE", "engine_overheating"),
  link("radiator", "MAY_CAUSE", "engine_overheating"),
  link("coolant_temp_sensor", "MAY_CAUSE", "engine_overheating"),
  link("spark_plug", "MAY_CAUSE", "rough_idle"),
  link("throttle_body", "MAY_CAUSE", "rough_idle"),
  link("mass_airflow_sensor", "MAY_CAUSE", "rough_idle"),
  link("engine_misfire", "MAY_CAUSE", "rough_idle"),
  link("fuel_pump", "MAY_CAUSE", "hard_starting"),
  link("spark_plug", "MAY_CAUSE", "hard_starting"),
  link("coolant_temp_sensor", "MAY_CAUSE", "hard_starting"),
  link("engine_ecu", "MAY_CAUSE", "hard_starting"),
  link("oxygen_sensor", "MAY_CAUSE", "check_engine_light"),
  link("mass_airflow_sensor", "MAY_CAUSE", "check_engine_light"),
  link("engine_ecu", "MAY_CAUSE", "check_engine_light"),
  link("engine_misfire", "MAY_CAUSE", "check_engine_light"),
  link("oil_pump", "MAY_CAUSE", "low_oil_pressure"),
  link("oxygen_sensor", "MAY_CAUSE", "poor_fuel_economy"),
  link("thermostat", "MAY_CAUSE", "poor_fuel_economy"),
  link("fuel_injector", "MAY_CAUSE", "poor_fuel_economy"),

  link("car_engine", "DOCUMENTED_IN", "workshop_manual"),
  link("spark_plug", "DOCUMENTED_IN", "workshop_manual"),
  link("ignition_coil", "DOCUMENTED_IN", "workshop_manual"),
  link("fuel_injector", "DOCUMENTED_IN", "workshop_manual"),
  link("fuel_pump", "DOCUMENTED_IN", "workshop_manual"),
  link("throttle_body", "DOCUMENTED_IN", "workshop_manual"),
  link("oil_pump", "DOCUMENTED_IN", "workshop_manual"),
  link("engine_ecu", "DOCUMENTED_IN", "dtc_reference"),
  link("oxygen_sensor", "DOCUMENTED_IN", "dtc_reference"),
  link("mass_airflow_sensor", "DOCUMENTED_IN", "dtc_reference"),
  link("coolant_temp_sensor", "DOCUMENTED_IN", "dtc_reference"),
  link("thermostat", "DOCUMENTED_IN", "cooling_service_bulletin"),
  link("water_pump", "DOCUMENTED_IN", "cooling_service_bulletin"),
  link("radiator", "DOCUMENTED_IN", "cooling_service_bulletin"),

  link("engine_ecu", "INSPECT_USING", "read_obd_codes"),
  link("oxygen_sensor", "INSPECT_USING", "read_obd_codes"),
  link("mass_airflow_sensor", "INSPECT_USING", "read_obd_codes"),
  link("spark_plug", "INSPECT_USING", "inspect_spark_plugs"),
  link("ignition_coil", "INSPECT_USING", "coil_swap_test"),
  link("thermostat", "INSPECT_USING", "cooling_pressure_test"),
  link("water_pump", "INSPECT_USING", "cooling_pressure_test"),
  link("radiator", "INSPECT_USING", "cooling_pressure_test"),
  link("fuel_pump", "INSPECT_USING", "fuel_pressure_test"),
  link("fuel_injector", "INSPECT_USING", "fuel_pressure_test"),
];

export const AUTOMOTIVE_DATASET: Dataset = {
  id: "automotive",
  name: "Car Engine",
  label: "Synthetic demo dataset · fictional four-cylinder car engine",
  graph: { nodes: NODES, links: LINKS },
  suggestions: [
    "Show me the ignition system",
    "Why is the engine misfiring?",
    "Expand the ignition coil",
    "Hide unrelated nodes",
  ],
};
