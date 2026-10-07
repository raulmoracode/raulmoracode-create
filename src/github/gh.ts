export interface CreatePullRequestOptions {
  cwd: string;
  base: string;
  head: string;
  title: string;
  body: string;
  verbose: boolean;
}

/** Throws when `gh` is missing or not authenticated. */
export async function requireGhAuth(_verbose: boolean): Promise<void> {
  throw new Error("requireGhAuth: not implemented yet");
}

/** URL of the open pull request whose head is `head`, or null. */
export async function findOpenPullRequest(
  _cwd: string,
  _head: string,
  _verbose: boolean,
): Promise<string | null> {
  throw new Error("findOpenPullRequest: not implemented yet");
}

/** Creates a ready-for-review (never draft) pull request and returns its URL. */
export async function createPullRequest(
  _options: CreatePullRequestOptions,
): Promise<string> {
  throw new Error("createPullRequest: not implemented yet");
}
