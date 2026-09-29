import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPrivateRegistryAccess } from "../src/utils/registry.js";

beforeEach(() => {
  delete process.env.GH_TOKEN;
  vi.unstubAllGlobals();
});

afterEach(() => {
  delete process.env.GH_TOKEN;
  vi.unstubAllGlobals();
});

describe("checkPrivateRegistryAccess", () => {
  it("returns false without calling fetch when GH_TOKEN is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkPrivateRegistryAccess()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns true when the registry responds ok", async () => {
    process.env.GH_TOKEN = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true })),
    );
    await expect(checkPrivateRegistryAccess()).resolves.toBe(true);
  });

  it("returns false on unauthorized or not found", async () => {
    process.env.GH_TOKEN = "bad-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 })),
    );
    await expect(checkPrivateRegistryAccess()).resolves.toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    await expect(checkPrivateRegistryAccess()).resolves.toBe(false);
  });

  it("returns false when the request throws", async () => {
    process.env.GH_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(checkPrivateRegistryAccess()).resolves.toBe(false);
  });

  it("sends the bearer token to the icons metadata endpoint", async () => {
    process.env.GH_TOKEN = "my-token";
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await checkPrivateRegistryAccess();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("npm.pkg.github.com"),
      expect.objectContaining({
        headers: { Authorization: "Bearer my-token" },
      }),
    );
  });
});
