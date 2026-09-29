import { select } from "@clack/prompts";
import { type Framework, isFramework } from "../utils/validation.js";
import { ensureNotCancelled } from "./cancel.js";

export async function promptFramework(): Promise<Framework> {
  const framework = ensureNotCancelled(
    await select({
      message: "¿Qué tecnología quieres utilizar?",
      options: [
        {
          value: "vite",
          label: "React + Vite",
          hint: "Vite 8, React 19 y TypeScript 7",
        },
        {
          value: "next",
          label: "Next.js",
          hint: "Next.js 16, App Router y React 19",
        },
      ],
      initialValue: "vite",
    }),
  );
  if (!isFramework(framework)) {
    throw new Error(`Framework desconocido: ${String(framework)}`);
  }
  return framework;
}
