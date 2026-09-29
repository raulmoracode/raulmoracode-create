import { text } from "@clack/prompts";
import { validateGitHubUrl } from "../utils/validation.js";
import { ensureNotCancelled } from "./cancel.js";

export async function promptGitHubUrl(): Promise<string> {
  const url = ensureNotCancelled(
    await text({
      message: "¿Dónde se va a alojar el código?",
      placeholder: "https://github.com/raulmoracode/my-project",
      validate(value) {
        if (!value) {
          return "La URL del repositorio no puede estar vacía.";
        }
        const result = validateGitHubUrl(value);
        return result.valid ? undefined : result.error;
      },
    }),
  );
  const trimmed = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const check = validateGitHubUrl(trimmed);
  if (!check.valid) {
    throw new Error(check.error);
  }
  return trimmed;
}
