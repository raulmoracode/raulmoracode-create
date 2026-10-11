import { text } from "@clack/prompts";
import { ensureNotCancelled } from "./cancel.js";

export const DEFAULT_AUTHOR_NAME = "Raul Mora";
export const DEFAULT_AUTHOR_URL = "https://raulmoracode.com";

export interface AuthorInfo {
  name: string;
  url: string;
}

/**
 * Asks for the project author. The input is prefilled with the brand default:
 * leaving it empty (or clearing it) falls back to `DEFAULT_AUTHOR_NAME`, so
 * the author can just press Enter. The URL is never prompted: it keeps the
 * brand default, matching the `homepage` the project will get from the GitHub
 * URL (a personal site would add nothing the generated project uses).
 */
export async function promptAuthor(): Promise<AuthorInfo> {
  const value = ensureNotCancelled(
    await text({
      message: "¿Quién es el autor del proyecto?",
      placeholder: DEFAULT_AUTHOR_NAME,
      initialValue: DEFAULT_AUTHOR_NAME,
    }),
  );
  const name = (value ?? "").trim() || DEFAULT_AUTHOR_NAME;
  return { name, url: DEFAULT_AUTHOR_URL };
}
