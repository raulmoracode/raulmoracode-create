import { multiselect } from "@clack/prompts";
import {
  resolveTechSelection,
  TECH_IDS,
  TECH_OPTIONS,
  type TechSelection,
} from "../config/tech.js";
import { ensureNotCancelled } from "./cancel.js";

export interface TechPresetResult {
  selection: TechSelection;
  notes: string[];
}

export async function promptTechPreset(): Promise<TechPresetResult> {
  const values = ensureNotCancelled(
    await multiselect({
      message:
        "¿Qué tecnologías quieres incluir? (espacio para marcar/desmarcar)",
      options: TECH_OPTIONS.map((option) => ({
        value: option.id,
        label: option.label,
        hint: option.hint,
      })),
      initialValues: [...TECH_IDS],
      required: false,
    }),
  );
  const selected = new Set(values);
  const input = Object.fromEntries(
    TECH_IDS.map((id) => [id, selected.has(id)]),
  ) as TechSelection;
  return resolveTechSelection(input);
}
