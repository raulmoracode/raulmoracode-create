import { describe, expect, it } from "vitest";
import {
  isFramework,
  satisfiesNodeVersion,
  validateFramework,
  validateGitHubUrl,
  validateProjectName,
} from "../src/utils/validation.js";

describe("validateProjectName", () => {
  it("accepts valid project names", () => {
    for (const name of [
      "my-project",
      "myproject",
      "my.project",
      "my_project",
      "my~project",
      "a",
      "project123",
    ]) {
      expect(validateProjectName(name).valid, name).toBe(true);
    }
  });

  it("rejects empty and blank names", () => {
    expect(validateProjectName("").valid).toBe(false);
    expect(validateProjectName("   ").valid).toBe(false);
  });

  it("rejects uppercase names", () => {
    expect(validateProjectName("My-Project").valid).toBe(false);
    expect(validateProjectName("myProject").valid).toBe(false);
  });

  it("rejects names starting with dot or underscore", () => {
    expect(validateProjectName(".hidden").valid).toBe(false);
    expect(validateProjectName("_private").valid).toBe(false);
  });

  it("rejects names with spaces or invalid characters", () => {
    expect(validateProjectName("my project").valid).toBe(false);
    expect(validateProjectName("my project ").valid).toBe(false);
    expect(validateProjectName("my@project").valid).toBe(false);
    expect(validateProjectName("my/project").valid).toBe(false);
    expect(validateProjectName("path/../traversal").valid).toBe(false);
  });

  it("rejects names longer than 214 characters", () => {
    expect(validateProjectName(`a`.repeat(215)).valid).toBe(false);
    expect(validateProjectName(`a`.repeat(214)).valid).toBe(true);
  });

  it("rejects reserved names", () => {
    expect(validateProjectName("node_modules").valid).toBe(false);
    expect(validateProjectName("favicon.ico").valid).toBe(false);
    expect(validateProjectName("CON").valid).toBe(false);
  });
});

describe("validateGitHubUrl", () => {
  it("accepts valid GitHub URLs", () => {
    for (const url of [
      "https://github.com/raulmoracode/my-project",
      "https://github.com/raulmoracode/my-project.git",
      "https://github.com/raulmoracode/my-project/",
    ]) {
      const result = validateGitHubUrl(url);
      expect(result.valid, url).toBe(true);
      expect(result.owner).toBe("raulmoracode");
      expect(result.repo).toBe("my-project");
    }
    const other = validateGitHubUrl("https://github.com/user123/repo_name.js");
    expect(other.valid).toBe(true);
    expect(other.owner).toBe("user123");
    expect(other.repo).toBe("repo_name.js");
  });

  it("rejects non-https URLs", () => {
    expect(validateGitHubUrl("http://github.com/owner/repo").valid).toBe(false);
  });

  it("rejects non-GitHub hosts", () => {
    expect(validateGitHubUrl("https://gitlab.com/owner/repo").valid).toBe(
      false,
    );
    expect(validateGitHubUrl("https://bitbucket.org/owner/repo").valid).toBe(
      false,
    );
  });

  it("rejects malformed URLs", () => {
    expect(validateGitHubUrl("").valid).toBe(false);
    expect(validateGitHubUrl("not-a-url").valid).toBe(false);
    expect(validateGitHubUrl("https://github.com/owner").valid).toBe(false);
    expect(validateGitHubUrl("https://github.com/owner/repo/extra").valid).toBe(
      false,
    );
  });

  it("rejects URLs containing credentials", () => {
    expect(
      validateGitHubUrl("https://user:pass@github.com/owner/repo").valid,
    ).toBe(false);
  });

  it("rejects invalid owner or repository names", () => {
    expect(validateGitHubUrl("https://github.com/-invalid/repo").valid).toBe(
      false,
    );
    expect(validateGitHubUrl("https://github.com/owner/..").valid).toBe(false);
  });
});

describe("isFramework", () => {
  it("accepts vite and next", () => {
    expect(isFramework("vite")).toBe(true);
    expect(isFramework("next")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isFramework("react")).toBe(false);
    expect(isFramework("")).toBe(false);
    expect(isFramework(undefined)).toBe(false);
    expect(isFramework(42)).toBe(false);
  });

  it("validateFramework returns a descriptive error", () => {
    const result = validateFramework("svelte");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("svelte");
  });
});

describe("satisfiesNodeVersion", () => {
  it("accepts Node 24 and above", () => {
    expect(satisfiesNodeVersion("v24.0.0", 24).valid).toBe(true);
    expect(satisfiesNodeVersion("v26.1.2", 24).valid).toBe(true);
  });

  it("rejects Node below the minimum", () => {
    const result = satisfiesNodeVersion("v22.11.0", 24);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("24");
  });

  it("rejects unparseable versions", () => {
    expect(satisfiesNodeVersion("unknown", 24).valid).toBe(false);
  });
});
