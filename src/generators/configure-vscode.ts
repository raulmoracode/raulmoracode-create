import { vscodeExtensions, vscodeSettings } from "../config/vscode.js";
import { joinPath, writeTextFile } from "../utils/filesystem.js";

export async function configureVscode(projectDir: string): Promise<void> {
  await writeTextFile(
    joinPath(projectDir, ".vscode", "settings.json"),
    vscodeSettings(),
  );
  await writeTextFile(
    joinPath(projectDir, ".vscode", "extensions.json"),
    vscodeExtensions(),
  );
}
