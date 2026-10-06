import {
  FAVICON_URL,
  SITE_TITLE,
  SOCIAL_IMAGE_URL,
  TWITTER_CARD,
  TWITTER_SITE_HANDLE,
} from "./branding.js";

export interface SiteValues {
  name: string;
  title: string;
  description: string;
  url: string;
  favicon: string;
  socialImage: string;
  socialImageAlt: string;
  author: string;
  twitter: string;
  locale: string;
  themeColor: string;
}

const STACK_ENTRIES: Array<{ dependency: string; label: string }> = [
  { dependency: "react", label: "React" },
  { dependency: "next", label: "Next.js" },
  { dependency: "vite", label: "Vite" },
  { dependency: "typescript", label: "TypeScript" },
];

function majorVersion(range: unknown): string | null {
  if (typeof range !== "string") {
    return null;
  }
  const cleaned = range.trim().replace(/^[\^~>=<\s]+/, "");
  const match = /^(\d+)/.exec(cleaned);
  return match?.[1] ?? null;
}

/**
 * Short stack summary used in the default description and image alt text. It
 * is read from `package.json` so the value matches the pinned versions.
 */
export function describeStack(packageJson: unknown): string {
  if (!packageJson || typeof packageJson !== "object") {
    return "";
  }
  const record = packageJson as Record<string, unknown>;
  const dependencies = {
    ...(record.dependencies as Record<string, unknown> | undefined),
    ...(record.devDependencies as Record<string, unknown> | undefined),
  };
  const parts: string[] = [];
  for (const entry of STACK_ENTRIES) {
    const major = majorVersion(dependencies[entry.dependency]);
    if (major) {
      parts.push(`${entry.label} ${major}`);
    }
  }
  return parts.join(" + ");
}

export function siteValues(options: {
  projectName: string;
  packageJson: unknown;
}): SiteValues {
  const name =
    options.projectName.trim() === "" ? SITE_TITLE : options.projectName;
  const stack = describeStack(options.packageJson);
  return {
    name,
    title: name,
    description: "",
    url: "",
    favicon: FAVICON_URL,
    socialImage: SOCIAL_IMAGE_URL,
    socialImageAlt: stack === "" ? name : `${name} — ${stack}`,
    author: "Raul Mora",
    twitter: TWITTER_SITE_HANDLE,
    locale: "es_ES",
    themeColor: "#ffffff",
  };
}

export const SITE_CONFIG_PATH = "src/config/site.ts";

export const SITE_HEAD_COMMENT =
  "<!-- title, favicon and social preview come from src/config/site.ts -->";

const SITE_CONFIG_HEADER = [
  "/**",
  " * Single source of truth for the identity of this site.",
  " *",
  " * Change it here and both the browser tab and the social preview",
  " * (X, WhatsApp, Slack, LinkedIn) follow: the Vite plugin and the Next.js",
  " * metadata read these values, so nothing has to be repeated in",
  " * `index.html` or `src/app/layout.tsx`.",
  " */",
].join("\n");

export function siteConfigTs(values: SiteValues): string {
  const field = (key: keyof SiteValues, value: string): string =>
    `  ${key}: ${JSON.stringify(value)},`;
  return [
    SITE_CONFIG_HEADER,
    "",
    "export const site = {",
    field("name", values.name),
    field("title", values.title),
    field("description", values.description),
    field("url", values.url),
    field("favicon", values.favicon),
    field("socialImage", values.socialImage),
    field("socialImageAlt", values.socialImageAlt),
    field("author", values.author),
    field("twitter", values.twitter),
    field("locale", values.locale),
    field("themeColor", values.themeColor),
    "} as const;",
    "",
  ].join("\n");
}

/**
 * Vite plugin injected into `vite.config.ts`. Vite owns `index.html`, so the
 * head tags are produced from `src/config/site.ts` at dev and build time via
 * `transformIndexHtml` instead of being hardcoded in the HTML.
 */
export function viteSiteHeadPlugin(): string {
  return [
    "",
    "const siteHead = () => ({",
    '  name: "raulmoracode-site-head",',
    "  transformIndexHtml: {",
    '    order: "pre" as const,',
    "    handler: () => {",
    "      const {",
    "        name,",
    "        title,",
    "        description,",
    "        favicon,",
    "        socialImage,",
    "        socialImageAlt,",
    "        twitter,",
    "        themeColor,",
    "      } = site;",
    "      const meta = (name: string, content: string) => ({",
    '        tag: "meta" as const,',
    "        attrs: { name, content },",
    "      });",
    "      return {",
    "        tags: [",
    '          { tag: "title" as const, children: title },',
    '          meta("theme-color", themeColor),',
    "          ...(description",
    "            ? [",
    '                meta("description", description),',
    '                meta("og:description", description),',
    '                meta("twitter:description", description),',
    "              ]",
    "            : []),",
    "          ...(favicon",
    '            ? [{ tag: "link" as const, attrs: { rel: "icon", href: favicon } }]',
    "            : []),",
    '          meta("og:type", "website"),',
    '          meta("og:title", title),',
    '          meta("og:site_name", name),',
    "          ...(twitter",
    "            ? [",
    `              meta("twitter:card", ${JSON.stringify(TWITTER_CARD)}),`,
    '              meta("twitter:site", twitter),',
    '              meta("twitter:creator", twitter),',
    '              meta("twitter:title", title),',
    "            ]",
    "            : []),",
    "          ...(socialImage",
    "            ? [",
    '                meta("og:image", socialImage),',
    '                meta("og:image:alt", socialImageAlt),',
    '                meta("twitter:image", socialImage),',
    '                meta("twitter:image:alt", socialImageAlt),',
    "              ]",
    "            : []),",
    "        ],",
    "      };",
    "    },",
    "  },",
    "});",
  ].join("\n");
}

export function viteSiteHeadImport(): string {
  return 'import { site } from "./src/config/site";';
}

/**
 * Replaces the `metadata` export in the Next.js root layout. Next resolves the
 * `twitter` and `openGraph` fields itself, so it needs no Vite-style plugin.
 * Empty values are spread away so no blank meta tag is ever emitted.
 */
export function nextSiteMetadata(): string {
  const images =
    "...site.socialImage\n      ? { images: [{ url: site.socialImage, alt: site.socialImageAlt }] }\n      : {}";
  return [
    "export const metadata: Metadata = {",
    "  ...(site.url ? { metadataBase: new URL(site.url) } : {}),",
    "  title: site.title,",
    "  ...(site.description ? { description: site.description } : {}),",
    "  applicationName: site.name,",
    "  authors: [{ name: site.author }],",
    "  ...(site.favicon ? { icons: { icon: site.favicon } } : {}),",
    "  openGraph: {",
    '    type: "website",',
    "    title: site.title,",
    "    ...(site.description ? { description: site.description } : {}),",
    "    siteName: site.name,",
    "    locale: site.locale,",
    `    ${images},`,
    "  },",
    "  twitter: {",
    `    card: ${JSON.stringify(TWITTER_CARD)},`,
    "    ...(site.twitter",
    "      ? { site: site.twitter, creator: site.twitter }",
    "      : {}),",
    "    title: site.title,",
    "    ...(site.description ? { description: site.description } : {}),",
    `    ${images},`,
    "  },",
    "};",
  ].join("\n");
}
