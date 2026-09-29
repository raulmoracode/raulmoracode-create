export const TECH_IDS = [
  "tailwind",
  "shadcn",
  "tanstack-query",
  "zustand",
  "forms",
  "registry",
  "biome",
  "testing",
  "husky",
  "vscode",
] as const;

export type TechId = (typeof TECH_IDS)[number];

export type TechSelection = Record<TechId, boolean>;

export interface TechOption {
  id: TechId;
  label: string;
  hint: string;
}

export const TECH_OPTIONS: TechOption[] = [
  { id: "tailwind", label: "Tailwind CSS", hint: "Estilos con Tailwind 4" },
  {
    id: "shadcn",
    label: "shadcn",
    hint: "components.json + cn() (requiere Tailwind)",
  },
  {
    id: "tanstack-query",
    label: "TanStack Query",
    hint: "QueryClient + provider",
  },
  { id: "zustand", label: "Zustand", hint: "Estado global" },
  {
    id: "forms",
    label: "React Hook Form + Zod",
    hint: "Formularios con validación",
  },
  {
    id: "registry",
    label: "Registro @raulmoracode",
    hint: ".npmrc + @raulmoracode/icons",
  },
  {
    id: "biome",
    label: "Biome",
    hint: "Formato, lint y scripts check/format/lint",
  },
  {
    id: "testing",
    label: "Testing",
    hint: "Vitest + Testing Library y script test",
  },
  {
    id: "husky",
    label: "Husky + Commitlint",
    hint: "Git hooks y Conventional Commits",
  },
  {
    id: "vscode",
    label: "VS Code",
    hint: ".vscode/settings.json + extensions.json",
  },
];

export const FULL_TECH_SELECTION: TechSelection = {
  tailwind: true,
  shadcn: true,
  "tanstack-query": true,
  zustand: true,
  forms: true,
  registry: true,
  biome: true,
  testing: true,
  husky: true,
  vscode: true,
};

export interface ResolvedTechSelection {
  selection: TechSelection;
  notes: string[];
}

export function resolveTechSelection(
  input: TechSelection,
): ResolvedTechSelection {
  const selection: TechSelection = { ...input };
  const notes: string[] = [];
  if (selection.shadcn && !selection.tailwind) {
    selection.tailwind = true;
    notes.push("shadcn necesita Tailwind CSS: se mantiene Tailwind.");
  }
  return { selection, notes };
}

export function applyPrivateAccess(
  selection: TechSelection,
  hasPrivateAccess: boolean,
): TechSelection {
  if (hasPrivateAccess) {
    return selection;
  }
  return { ...selection, registry: false };
}
