import {
  SITE_TITLE,
  SOCIAL_DESCRIPTION_LIMIT,
  SOCIAL_IMAGE_URL,
  TWITTER_CARD,
  TWITTER_CREATOR_HANDLE,
  TWITTER_SITE_HANDLE,
} from "./branding.js";

export interface SocialMetaOptions {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  site: string;
  creator: string;
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
 * Short stack summary used in titles and descriptions. It is read from
 * `package.json` so the scaffolder (before the extra dependencies are added)
 * and `migrate` (on projects that already exist) produce the same text.
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

export function socialMetaOptions(
  projectName: string,
  packageJson: unknown,
): SocialMetaOptions {
  const name = projectName.trim() === "" ? SITE_TITLE : projectName;
  const stack = describeStack(packageJson);
  const summary = stack === "" ? "" : `${stack}. `;
  return {
    title: name,
    description: truncate(
      `${name} — ${summary}Generado con raulmoracode-create.`,
      SOCIAL_DESCRIPTION_LIMIT,
    ),
    imageUrl: SOCIAL_IMAGE_URL,
    imageAlt: stack === "" ? name : `${name} — ${stack}`,
    site: TWITTER_SITE_HANDLE,
    creator: TWITTER_CREATOR_HANDLE,
  };
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Raw `<meta>` block for Vite's `index.html`. The indentation is relative to
 * the `</head>` line so the result matches the template it lands in.
 */
export function viteSocialMetaTags(
  options: SocialMetaOptions,
  indent = "  ",
): string {
  const tag = (name: string, content: string): string =>
    `${indent}<meta name="${name}" content="${escapeAttribute(content)}" />`;
  return [
    tag("twitter:card", TWITTER_CARD),
    tag("twitter:site", options.site),
    tag("twitter:creator", options.creator),
    tag("twitter:title", options.title),
    tag("twitter:description", options.description),
    tag("twitter:image", options.imageUrl),
    tag("twitter:image:alt", options.imageAlt),
  ].join("\n");
}

export type SocialMetaPatch =
  | { kind: "ready"; content: string; changed: boolean }
  | { kind: "conflict"; message: string; manual: string[] };

export function hasViteSocialMeta(html: string): boolean {
  return html.includes('name="twitter:card"');
}

export function hasNextSocialMeta(layout: string): boolean {
  return /twitter:\s*\{/.test(layout);
}

/**
 * Inserts the block right before `</head>`, keeping the indentation of the
 * template it lands in. When the anchor is missing the file is left untouched
 * and the caller gets the manual snippet instead.
 */
export function withViteSocialMeta(
  html: string,
  options: SocialMetaOptions,
): SocialMetaPatch {
  if (hasViteSocialMeta(html)) {
    return { kind: "ready", content: html, changed: false };
  }
  const head = /(^[\t ]*)<\/head>/m.exec(html);
  if (!head) {
    return {
      kind: "conflict",
      message:
        "No se encontró </head> en index.html: el archivo está demasiado modificado para parchearlo con seguridad.",
      manual: viteSocialMetaTags(options).split("\n"),
    };
  }
  const anchor = head[0];
  const indent = `${head[1] ?? ""}  `;
  const content = html.replace(
    anchor,
    `${viteSocialMetaTags(options, indent)}\n${anchor}`,
  );
  return { kind: "ready", content, changed: content !== html };
}

/**
 * Inserts `twitter` + `openGraph` as the first fields of the `metadata`
 * object. Same contract as `withViteSocialMeta`.
 */
export function withNextSocialMeta(
  layout: string,
  options: SocialMetaOptions,
): SocialMetaPatch {
  if (hasNextSocialMeta(layout)) {
    return { kind: "ready", content: layout, changed: false };
  }
  const anchor = /(export const metadata: Metadata = \{\r?\n)/.exec(layout);
  if (!anchor) {
    return {
      kind: "conflict",
      message:
        'No se encontró "export const metadata: Metadata = {" en src/app/layout.tsx: el archivo está demasiado modificado para parchearlo con seguridad.',
      manual: nextSocialMetaFields(options).split("\n"),
    };
  }
  const matched = anchor[0];
  const content = layout.replace(
    matched,
    `${matched}${nextSocialMetaFields(options)}\n`,
  );
  return { kind: "ready", content, changed: content !== layout };
}

/**
 * `twitter` + `openGraph` fields for the Next.js `Metadata` object. Values go
 * through `JSON.stringify` so they are always valid TypeScript string literals
 * and Next's own types are respected.
 */
export function nextSocialMetaFields(
  options: SocialMetaOptions,
  indent = "  ",
): string {
  const inner = `${indent}  `;
  const images = [
    `${inner}images: [`,
    `${inner}  {`,
    `${inner}    url: ${JSON.stringify(options.imageUrl)},`,
    `${inner}    alt: ${JSON.stringify(options.imageAlt)},`,
    `${inner}  },`,
    `${inner}],`,
  ];
  const lines = [
    `${indent}twitter: {`,
    `${inner}card: ${JSON.stringify(TWITTER_CARD)},`,
    `${inner}site: ${JSON.stringify(options.site)},`,
    `${inner}creator: ${JSON.stringify(options.creator)},`,
    `${inner}title: ${JSON.stringify(options.title)},`,
    `${inner}description: ${JSON.stringify(options.description)},`,
    ...images,
    `${indent}},`,
    `${indent}openGraph: {`,
    `${inner}type: "website",`,
    `${inner}title: ${JSON.stringify(options.title)},`,
    `${inner}description: ${JSON.stringify(options.description)},`,
    ...images,
    `${indent}},`,
  ];
  return lines.join("\n");
}
