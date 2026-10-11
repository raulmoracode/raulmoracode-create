import { describe, expect, it, vi } from "vitest";

const textMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());

vi.mock("@clack/prompts", () => ({
  text: textMock,
  select: selectMock,
  cancel: vi.fn(),
  isCancel: () => false,
}));

import {
  DEFAULT_AUTHOR_NAME,
  DEFAULT_AUTHOR_URL,
  promptAuthor,
} from "../src/prompts/author.js";
import { promptLicense } from "../src/prompts/license.js";

describe("promptAuthor", () => {
  it("returns the typed name with the default URL", async () => {
    textMock.mockResolvedValueOnce("Jane Doe");
    await expect(promptAuthor()).resolves.toEqual({
      name: "Jane Doe",
      url: DEFAULT_AUTHOR_URL,
    });
  });

  it("trims the typed name", async () => {
    textMock.mockResolvedValueOnce("  Jane Doe  ");
    await expect(promptAuthor()).resolves.toEqual({
      name: "Jane Doe",
      url: DEFAULT_AUTHOR_URL,
    });
  });

  it("falls back to the default author when the answer is empty", async () => {
    textMock.mockResolvedValueOnce("");
    await expect(promptAuthor()).resolves.toEqual({
      name: DEFAULT_AUTHOR_NAME,
      url: DEFAULT_AUTHOR_URL,
    });
  });

  it("falls back to the default author when the answer is blank", async () => {
    textMock.mockResolvedValueOnce("   ");
    await expect(promptAuthor()).resolves.toEqual({
      name: DEFAULT_AUTHOR_NAME,
      url: DEFAULT_AUTHOR_URL,
    });
  });

  it("falls back to the default author when no answer is given", async () => {
    textMock.mockResolvedValueOnce(undefined as never);
    await expect(promptAuthor()).resolves.toEqual({
      name: DEFAULT_AUTHOR_NAME,
      url: DEFAULT_AUTHOR_URL,
    });
  });
});

describe("promptLicense", () => {
  it("returns the selected license", async () => {
    selectMock.mockResolvedValueOnce("Apache-2.0");
    await expect(promptLicense()).resolves.toBe("Apache-2.0");
  });

  it("rejects a license the CLI does not know", async () => {
    selectMock.mockResolvedValueOnce("bogus");
    await expect(promptLicense()).rejects.toThrow(
      "Licencia desconocida: bogus",
    );
  });
});
