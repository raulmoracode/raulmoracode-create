import {
  FAVICON_URL,
  SITE_TITLE,
  SOCIAL_DESCRIPTION_LIMIT,
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

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function siteValues(options: {
  projectName: string;
  packageJson: unknown;
}): SiteValues {
  const name =
    options.projectName.trim() === "" ? SITE_TITLE : options.projectName;
  const stack = describeStack(options.packageJson);
  const summary = stack === "" ? "" : `${stack}. `;
  return {
    name,
    title: name,
    description: truncate(
      `${name} — ${summary}Generado con raulmoracode-create.`,
      SOCIAL_DESCRIPTION_LIMIT,
    ),
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

function metaTag(name: string, valueExpression: string): string {
  const name_ = JSON.stringify(name);
  return `          { tag: "meta", attrs: { name: ${name_}, content: ${valueExpression} } },`;
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
    "      const { title, description, favicon, socialImage, socialImageAlt, twitter, themeColor } = site;",
    "      return {",
    "        tags: [",
    '          { tag: "title", children: title },',
    metaTag("description", "description"),
    metaTag("theme-color", "themeColor"),
    '          { tag: "link", attrs: { rel: "icon", href: favicon } },',
    metaTag("og:type", '"website"'),
    metaTag("og:title", "title"),
    metaTag("og:description", "description"),
    metaTag("og:image", "socialImage"),
    metaTag("og:image:alt", "socialImageAlt"),
    metaTag("twitter:card", JSON.stringify(TWITTER_CARD)),
    metaTag("twitter:site", "twitter"),
    metaTag("twitter:creator", "twitter"),
    metaTag("twitter:title", "title"),
    metaTag("twitter:description", "description"),
    metaTag("twitter:image", "socialImage"),
    metaTag("twitter:image:alt", "socialImageAlt"),
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
 */
export function nextSiteMetadata(): string {
  return [
    "export const metadata: Metadata = {",
    "  ...(site.url ? { metadataBase: new URL(site.url) } : {}),",
    "  title: site.title,",
    "  description: site.description,",
    "  applicationName: site.name,",
    "  authors: [{ name: site.author }],",
    "  icons: { icon: site.favicon },",
    "  openGraph: {",
    '    type: "website",',
    "    title: site.title,",
    "    description: site.description,",
    "    siteName: site.name,",
    "    locale: site.locale,",
    "    images: [{ url: site.socialImage, alt: site.socialImageAlt }],",
    "  },",
    "  twitter: {",
    `    card: ${JSON.stringify(TWITTER_CARD)},`,
    "    site: site.twitter,",
    "    creator: site.twitter,",
    "    title: site.title,",
    "    description: site.description,",
    "    images: [{ url: site.socialImage, alt: site.socialImageAlt }],",
    "  },",
    "};",
  ].join("\n");
}
