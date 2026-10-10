import { describe, expect, it } from "vitest";
import {
  FAVICON_URL,
  SITE_TITLE,
  TWITTER_CARD,
  TWITTER_SITE_HANDLE,
} from "../src/config/branding.js";
import {
  describeStack,
  nextSiteMetadata,
  SITE_CONFIG_PATH,
  SITE_HEAD_COMMENT,
  type SiteValues,
  siteConfigTs,
  siteValues,
  viteSiteHeadImport,
  viteSiteHeadPlugin,
} from "../src/config/site.js";
import { viteTailwindConfig } from "../src/config/tailwind.js";

const VITE_PACKAGE_JSON = {
  name: "my-project",
  dependencies: { react: "19.3.0" },
  devDependencies: { vite: "8.3.1", typescript: "7.0.2" },
};

const NEXT_PACKAGE_JSON = {
  name: "my-app",
  dependencies: { next: "16.3.6", react: "19.3.0" },
  devDependencies: { typescript: "7.0.2" },
};

function values(overrides: Partial<SiteValues> = {}): SiteValues {
  return {
    name: "my-project",
    title: "my-project",
    description: "",
    url: "",
    favicon: FAVICON_URL,
    socialImage: "/imagen.png",
    socialImageAlt: "my-project",
    author: "Raul Mora",
    twitter: TWITTER_SITE_HANDLE,
    locale: "es_ES",
    themeColor: "#ffffff",
    ...overrides,
  };
}

const MACHINE_PATH_PATTERNS = [
  /\/Users\//,
  /\/home\//,
  /\/private\/var/,
  /\/var\/folders/,
  /[A-Za-z]:\\Users/,
  /[A-Za-z]:\\/,
];

describe("describeStack", () => {
  it("summarizes a Vite project from package.json", () => {
    expect(describeStack(VITE_PACKAGE_JSON)).toBe(
      "React 19 + Vite 8 + TypeScript 7",
    );
  });

  it("summarizes a Next.js project from package.json", () => {
    expect(describeStack(NEXT_PACKAGE_JSON)).toBe(
      "React 19 + Next.js 16 + TypeScript 7",
    );
  });

  it("keeps the documented entry order regardless of package.json order", () => {
    expect(
      describeStack({
        dependencies: {
          typescript: "7.0.2",
          "react-dom": "19.3.0",
          vite: "8.3.1",
          react: "19.3.0",
        },
      }),
    ).toBe("React 19 + Vite 8 + TypeScript 7");
  });

  it("takes the major version and strips range prefixes", () => {
    expect(
      describeStack({
        dependencies: { react: "^19.3.0" },
        devDependencies: { vite: "~8.3.1", typescript: ">=7.0.2 <8" },
      }),
    ).toBe("React 19 + Vite 8 + TypeScript 7");
  });

  it("ignores unknown dependencies and non-string versions", () => {
    expect(
      describeStack({
        dependencies: { react: "19.3.0", zustand: "5.0.15", lodash: 4 },
        devDependencies: { tailwindcss: null },
      }),
    ).toBe("React 19");
  });

  it("lets devDependencies win on conflict", () => {
    expect(
      describeStack({
        dependencies: { react: "18.2.0" },
        devDependencies: { react: "19.3.0" },
      }),
    ).toBe("React 19");
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(describeStack(undefined)).toBe("");
    expect(describeStack(null)).toBe("");
    expect(describeStack("package.json")).toBe("");
    expect(describeStack(42)).toBe("");
    expect(describeStack({})).toBe("");
    expect(describeStack([])).toBe("");
  });
});

describe("siteValues", () => {
  it("derives the identity from the project name and package.json", () => {
    const site = siteValues({
      projectName: "my-project",
      packageJson: VITE_PACKAGE_JSON,
    });
    expect(site).toEqual({
      name: "my-project",
      title: "my-project",
      description: "",
      url: "",
      favicon: FAVICON_URL,
      socialImage: "/imagen.png",
      socialImageAlt: "my-project — React 19 + Vite 8 + TypeScript 7",
      author: "Raul Mora",
      twitter: TWITTER_SITE_HANDLE,
      locale: "es_ES",
      themeColor: "#ffffff",
    });
  });

  it("falls back to the brand name for a blank project name", () => {
    const site = siteValues({ projectName: "   ", packageJson: {} });
    expect(site.name).toBe(SITE_TITLE);
    expect(site.title).toBe(SITE_TITLE);
    expect(site.socialImageAlt).toBe(SITE_TITLE);
  });

  it("keeps description and url empty by default", () => {
    const site = siteValues({
      projectName: "my-project",
      packageJson: NEXT_PACKAGE_JSON,
    });
    expect(site.description).toBe("");
    expect(site.url).toBe("");
    expect(site.socialImageAlt).toBe(
      "my-project — React 19 + Next.js 16 + TypeScript 7",
    );
  });
});

describe("siteConfigTs", () => {
  it("renders every field of the site object with a trailing newline", () => {
    expect(siteConfigTs(values())).toBe(
      [
        "/**",
        " * Single source of truth for the identity of this site.",
        " *",
        " * Change it here and both the browser tab and the social preview",
        " * (X, WhatsApp, Slack, LinkedIn) follow: the Vite plugin and the Next.js",
        " * metadata read these values, so nothing has to be repeated in",
        " * `index.html` or `src/app/layout.tsx`.",
        " */",
        "",
        "export const site = {",
        '  name: "my-project",',
        '  title: "my-project",',
        '  description: "",',
        '  url: "",',
        `  favicon: ${JSON.stringify(FAVICON_URL)},`,
        '  socialImage: "/imagen.png",',
        '  socialImageAlt: "my-project",',
        '  author: "Raul Mora",',
        `  twitter: ${JSON.stringify(TWITTER_SITE_HANDLE)},`,
        '  locale: "es_ES",',
        '  themeColor: "#ffffff",',
        "} as const;",
        "",
      ].join("\n"),
    );
  });

  it("JSON-escapes quotes and themeColor in values", () => {
    const content = siteConfigTs(
      values({ themeColor: "#050505", description: 'a "quoted" value' }),
    );
    expect(content).toContain('themeColor: "#050505",');
    expect(content).toContain('description: "a \\"quoted\\" value",');
    expect(content.endsWith("\n")).toBe(true);
    expect(content).not.toContain("\r");
  });

  it("exposes the documented site config path", () => {
    expect(SITE_CONFIG_PATH).toBe("src/config/site.ts");
  });
});

describe("viteSiteHeadPlugin", () => {
  const plugin = viteSiteHeadPlugin();

  it("declares the plugin name and transform order", () => {
    expect(plugin).toContain("const siteHead = () => ({");
    expect(plugin).toContain('name: "raulmoracode-site-head",');
    expect(plugin).toContain("transformIndexHtml: {");
    expect(plugin).toContain('order: "pre" as const,');
  });

  it("destructures every value it renders, including themeColor", () => {
    for (const field of [
      "name",
      "title",
      "description",
      "favicon",
      "socialImage",
      "socialImageAlt",
      "twitter",
      "themeColor",
    ]) {
      expect(plugin, field).toMatch(new RegExp(`^\\s*${field},$`, "m"));
    }
  });

  it("resolves local images against site.url with absolute()", () => {
    expect(plugin).toContain("const absolute = (value: string) =>");
    expect(plugin).toContain('site.url && value.startsWith("/")');
    expect(plugin).toContain("? new URL(value, site.url).href");
    expect(plugin).toContain(": value;");
    expect(plugin).toContain("const image = absolute(socialImage);");
  });

  it("emits the title, theme-color and always-on Open Graph tags", () => {
    expect(plugin).toContain('{ tag: "title" as const, children: title },');
    expect(plugin).toContain('meta("theme-color", themeColor),');
    expect(plugin).toContain('meta("og:type", "website"),');
    expect(plugin).toContain('meta("og:title", title),');
    expect(plugin).toContain('meta("og:site_name", name),');
  });

  it("spreads optional values away instead of emitting blank tags", () => {
    expect(plugin).toContain("...(description");
    expect(plugin).toContain('meta("description", description),');
    expect(plugin).toContain('meta("og:description", description),');
    expect(plugin).toContain('meta("twitter:description", description),');
    expect(plugin).toContain("...(favicon");
    expect(plugin).toContain('attrs: { rel: "icon", href: favicon }');
    expect(plugin).toContain("...(twitter");
    expect(plugin).toContain(
      `meta("twitter:card", ${JSON.stringify(TWITTER_CARD)}),`,
    );
    expect(plugin).toContain('meta("twitter:site", twitter),');
    expect(plugin).toContain('meta("twitter:creator", twitter),');
    expect(plugin).toContain("...(socialImage");
    expect(plugin).toContain('meta("og:image", image),');
    expect(plugin).toContain('meta("og:image:alt", socialImageAlt),');
    expect(plugin).toContain('meta("twitter:image", image),');
    expect(plugin).toContain('meta("twitter:image:alt", socialImageAlt),');
  });

  it("carries no machine-specific paths", () => {
    for (const pattern of MACHINE_PATH_PATTERNS) {
      expect(plugin, pattern.source).not.toMatch(pattern);
    }
  });

  it("imports the site config and is wired into the Vite config", () => {
    expect(viteSiteHeadImport()).toBe(
      'import { site } from "./src/config/site";',
    );
    const config = viteTailwindConfig();
    expect(config).toContain(viteSiteHeadImport());
    expect(config).toContain("plugins: [react(), tailwindcss(), siteHead()]");
    expect(config).toContain("const siteHead = () => ({");
    expect(SITE_HEAD_COMMENT).toBe(
      "<!-- title, favicon and social preview come from src/config/site.ts -->",
    );
  });
});

describe("nextSiteMetadata", () => {
  const metadata = nextSiteMetadata();

  it("opens the metadata export and closes it", () => {
    expect(metadata.startsWith("export const metadata: Metadata = {")).toBe(
      true,
    );
    expect(metadata.endsWith("};")).toBe(true);
    expect(metadata).not.toContain("\r");
  });

  it("resolves relative URLs through metadataBase, conditionally", () => {
    expect(metadata).toContain(
      "...(site.url ? { metadataBase: new URL(site.url) } : {}),",
    );
  });

  it("maps the site fields onto the Next metadata shape", () => {
    expect(metadata).toContain("title: site.title,");
    expect(metadata).toContain("applicationName: site.name,");
    expect(metadata).toContain("authors: [{ name: site.author }],");
    expect(metadata).toContain(
      "...(site.favicon ? { icons: { icon: site.favicon } } : {}),",
    );
  });

  it("spreads empty values away in every block", () => {
    const spreads = metadata.match(
      /\.\.\.\(site\.description \? \{ description: site\.description \} : \{\}\)/g,
    );
    expect(spreads).toHaveLength(3);
    expect(metadata).toContain(
      "...(site.twitter\n      ? { site: site.twitter, creator: site.twitter }\n      : {}),",
    );
  });

  it("builds the openGraph and twitter cards with the social image", () => {
    expect(metadata).toContain('type: "website",');
    expect(metadata).toContain("siteName: site.name,");
    expect(metadata).toContain("locale: site.locale,");
    expect(metadata).toContain(`card: ${JSON.stringify(TWITTER_CARD)},`);
    expect(metadata).toContain(
      "...site.socialImage\n      ? { images: [{ url: site.socialImage, alt: site.socialImageAlt }] }\n      : {}",
    );
    expect(metadata.match(/images: \{/g)).toBeNull();
    expect(metadata.match(/\{ images: \[/g)).toHaveLength(2);
  });

  it("carries no machine-specific paths", () => {
    for (const pattern of MACHINE_PATH_PATTERNS) {
      expect(metadata, pattern.source).not.toMatch(pattern);
    }
  });
});
