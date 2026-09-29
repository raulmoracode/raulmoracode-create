import { cancel, isCancel } from "@clack/prompts";

export function ensureNotCancelled<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Operación cancelada.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}
