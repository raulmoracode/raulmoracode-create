import { confirm } from "@clack/prompts";
import { ensureNotCancelled } from "./cancel.js";

export async function promptOpenInVscode(): Promise<boolean> {
  const answer = ensureNotCancelled(
    await confirm({
      message: `¿Quieres abrir el proyecto ahora?`,
      active: "Sí",
      inactive: "No",
      initialValue: true,
    }),
  );
  return Boolean(answer);
}
