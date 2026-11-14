import { DATASET_LABEL, SEED_GRAPH } from "../graph-data";
import type { Dataset, DatasetId } from "../types";
import { APPLIANCE_DATASET } from "./appliance";
import { AUTOMOTIVE_DATASET } from "./automotive";
import { ENERGY_DATASET } from "./energy";
import { MANUFACTURING_DATASET } from "./manufacturing";

export const AEROSPACE_DATASET: Dataset = {
  id: "aerospace",
  name: "Aerospace",
  label: DATASET_LABEL,
  graph: SEED_GRAPH,
  suggestions: [
    "Show me the cooling system",
    "Why is the engine overheating?",
    "Expand the cooling pump",
    "Hide unrelated nodes",
  ],
};

/** Every example dataset, in switcher order. */
export const DATASETS: Dataset[] = [
  AEROSPACE_DATASET,
  ENERGY_DATASET,
  MANUFACTURING_DATASET,
  APPLIANCE_DATASET,
  AUTOMOTIVE_DATASET,
];

export function getDataset(id: DatasetId): Dataset {
  return DATASETS.find((d) => d.id === id) ?? AEROSPACE_DATASET;
}
