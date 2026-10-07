import { log } from "@clack/prompts";

export interface UpgradeOptions {
  verbose?: boolean;
}

export async function runUpgrade(_options: UpgradeOptions = {}): Promise<void> {
  log.error("El comando upgrade todavía no está disponible.");
  process.exit(1);
}
