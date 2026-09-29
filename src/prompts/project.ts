import { text } from "@clack/prompts";
import { validateProjectName } from "../utils/validation.js";
import { ensureNotCancelled } from "./cancel.js";

export async function promptProjectName(): Promise<string> {
  const name = ensureNotCancelled(
    await text({
      message: "¿Cuál es el nombre del proyecto?",
      placeholder: "my-project",
      validate(value) {
        if (!value) {
          return "El nombre del proyecto no puede estar vacío.";
        }
        const result = validateProjectName(value);
        return result.valid ? undefined : result.error;
      },
    }),
  );
  const trimmed = name.trim();
  const check = validateProjectName(trimmed);
  if (!check.valid) {
    throw new Error(check.error);
  }
  return trimmed;
}
