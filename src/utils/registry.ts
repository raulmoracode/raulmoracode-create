const PRIVATE_ICONS_METADATA_URL =
  "https://npm.pkg.github.com/@raulmoracode%2Ficons";

const REQUEST_TIMEOUT_MS = 10_000;

export async function checkPrivateRegistryAccess(): Promise<boolean> {
  const token = process.env.GH_TOKEN;
  if (!token) {
    return false;
  }
  try {
    const response = await fetch(PRIVATE_ICONS_METADATA_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
