import type { Framework } from "../utils/validation.js";

/**
 * Header every generated `.env.example` shares. The comments tell a developer
 * (or a coding agent reading the generated AGENTS.md) how to go from the
 * template to a real `.env` without the CLI inventing any secret.
 */
const HEADER = [
  "# Environment variables",
  "#",
  "# Copy this file to `.env` and fill in the values:",
  "#   cp .env.example .env",
  "#",
  "# Never commit `.env` files: `.gitignore` ignores them. Commit only",
  "# `.env.example`, with placeholder values.",
].join("\n");

/**
 * Placeholder variables for a Vite project. Only `VITE_*` reaches the browser
 * (read with `import.meta.env.VITE_*`); any other variable stays on the server.
 */
const VITE_VARS = [
  "# Vite exposes `VITE_*` variables to the browser code via `import.meta.env`.",
  "",
  "VITE_API_URL=",
  "VITE_PUBLIC_KEY=",
].join("\n");

/**
 * Placeholder variables for a Next.js project. `NEXT_PUBLIC_*` is inlined into
 * the browser bundle; any other variable is only available on the server
 * through `process.env`.
 */
const NEXT_VARS = [
  "# `NEXT_PUBLIC_*` variables are inlined into the browser bundle; any other",
  "# variable is only available on the server through `process.env`.",
  "",
  "NEXT_PUBLIC_API_URL=",
  "NEXT_PUBLIC_ANALYTICS_ID=",
  "DATABASE_URL=",
].join("\n");

/** Renders the `.env.example` template for the given framework. */
export function envExample(frameworkId: Framework): string {
  return `${HEADER}\n\n${frameworkId === "next" ? NEXT_VARS : VITE_VARS}\n`;
}
