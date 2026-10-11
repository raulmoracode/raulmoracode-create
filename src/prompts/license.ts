import { select } from "@clack/prompts";
import { isLicenseChoice, type LicenseChoice } from "../config/license.js";
import { ensureNotCancelled } from "./cancel.js";

export const LICENSE_OPTIONS: ReadonlyArray<{
  value: LicenseChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "MIT",
    label: "MIT",
    hint: "Permisiva, la más habitual",
  },
  {
    value: "Apache-2.0",
    label: "Apache-2.0",
    hint: "Permisiva, con cláusula de patentes",
  },
  {
    value: "UNLICENSED",
    label: "Proprietary",
    hint: "Todos los derechos reservados",
  },
  {
    value: "none",
    label: "Ninguna",
    hint: "Sin campo license ni archivo LICENSE",
  },
];

export async function promptLicense(): Promise<LicenseChoice> {
  const choice = ensureNotCancelled(
    await select({
      message: "¿Qué licencia quieres para el proyecto?",
      options: LICENSE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
      })),
      initialValue: "MIT",
    }),
  );
  if (!isLicenseChoice(choice)) {
    throw new Error(`Licencia desconocida: ${String(choice)}`);
  }
  return choice;
}
