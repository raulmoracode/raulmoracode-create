import { describe, expect, it } from "vitest";
import {
  FULL_TECH_SELECTION,
  TECH_IDS,
  type TechSelection,
} from "../src/config/tech.js";
import { frameworks } from "../src/frameworks/index.js";
import {
  devDependencies,
  pinnedPackages,
  runtimeDependencies,
} from "../src/generators/configure-project.js";
import {
  managedDependencyPins,
  managedFiles,
} from "../src/upgrade/managed-files.js";

const NONE: TechSelection = Object.fromEntries(
  TECH_IDS.map((id) => [id, false]),
) as TechSelection;

function without(...ids: Array<keyof TechSelection>): TechSelection {
  const selection: TechSelection = { ...FULL_TECH_SELECTION };
  for (const id of ids) {
    selection[id] = false;
  }
  return selection;
}

function withOnly(id: keyof TechSelection): TechSelection {
  const selection: TechSelection = { ...NONE };
  selection[id] = true;
  return selection;
}

describe("runtime pins: zustand and forms", () => {
  it("pins zustand alone", () => {
    expect(runtimeDependencies(withOnly("zustand"))).toEqual({
      zustand: "5.0.15",
    });
  });

  it("pins react-hook-form and zod together", () => {
    expect(runtimeDependencies(withOnly("forms"))).toEqual({
      "react-hook-form": "7.89.0",
      zod: "4.6.5",
    });
  });

  it("pins both stacks when both are selected", () => {
    expect(
      runtimeDependencies({ ...NONE, zustand: true, forms: true }),
    ).toEqual({
      zustand: "5.0.15",
      "react-hook-form": "7.89.0",
      zod: "4.6.5",
    });
  });

  it("adds nothing when neither is selected", () => {
    expect(runtimeDependencies(NONE)).toEqual({});
  });

  it("uses exact versions without range prefixes", () => {
    for (const selection of [withOnly("zustand"), withOnly("forms")]) {
      for (const [name, version] of Object.entries(
        runtimeDependencies(selection),
      )) {
        expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
  });
});

describe("dev pin: theme", () => {
  it("pins tw-animate-css only with the theme", () => {
    for (const framework of Object.values(frameworks)) {
      expect(devDependencies(framework, withOnly("theme"))).toEqual({
        "tw-animate-css": "1.4.0",
      });
      expect(
        devDependencies(framework, { ...FULL_TECH_SELECTION, theme: false })[
          "tw-animate-css"
        ],
      ).toBeUndefined();
    }
  });

  it("surfaces the theme pin through the manifest pins and workspace excludes", () => {
    for (const framework of Object.values(frameworks)) {
      const pins = managedDependencyPins(framework.id, FULL_TECH_SELECTION);
      expect(pins["tw-animate-css"]).toBe("1.4.0");
      expect(pinnedPackages(framework, FULL_TECH_SELECTION)).toContain(
        "tw-animate-css@1.4.0",
      );
      expect(
        managedDependencyPins(framework.id, without("theme"))["tw-animate-css"],
      ).toBeUndefined();
    }
  });
});

describe("theme, zustand and forms write no files", () => {
  it("keep the managed tree identical when toggled", () => {
    for (const framework of Object.values(frameworks)) {
      const base = Object.keys(managedFiles(framework.id, NONE)).sort();
      for (const id of ["theme", "zustand", "forms"] as const) {
        expect(
          Object.keys(managedFiles(framework.id, withOnly(id))).sort(),
          `${framework.id}/${id}`,
        ).toEqual(base);
      }
      const full = Object.keys(managedFiles(framework.id, FULL_TECH_SELECTION));
      for (const id of ["theme", "zustand", "forms"] as const) {
        expect(
          Object.keys(managedFiles(framework.id, without(id))).sort(),
          `${framework.id}/without ${id}`,
        ).toEqual([...full].sort());
      }
    }
  });

  it("never manages application code for these techs", () => {
    for (const framework of Object.values(frameworks)) {
      const paths = Object.keys(
        managedFiles(framework.id, FULL_TECH_SELECTION),
      );
      for (const path of paths) {
        expect(path.startsWith("src/"), path).toBe(false);
      }
    }
  });

  it("exposes the zustand and forms pins through the manifest", () => {
    for (const framework of Object.values(frameworks)) {
      const pins = managedDependencyPins(framework.id, FULL_TECH_SELECTION);
      expect(pins.zustand).toBe("5.0.15");
      expect(pins["react-hook-form"]).toBe("7.89.0");
      expect(pins.zod).toBe("4.6.5");
      const withoutStacks = managedDependencyPins(
        framework.id,
        without("zustand", "forms"),
      );
      expect(withoutStacks.zustand).toBeUndefined();
      expect(withoutStacks["react-hook-form"]).toBeUndefined();
      expect(withoutStacks.zod).toBeUndefined();
    }
  });
});
