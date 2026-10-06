/**
 * Next.js error pages. Both are file conventions: Next picks them up with no
 * wiring, so they cannot break the app and there is nothing to connect later.
 *
 * They use only Tailwind utilities that exist in every project, never theme
 * tokens, so the nature theme from the registry cannot leave them unstyled.
 * `error.tsx` must be a Client Component because it receives `reset`. Its
 * default export is named `ErrorPage`, not `Error`: Biome runs in the generated
 * project with `noShadowRestrictedNames`, which fails the build on a function
 * called `Error`. The file convention is what Next looks at, not the name.
 */

const WRAPPER = [
  'className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center"',
].join("\n");

export function nextErrorPage(): string {
  return [
    '"use client";',
    "",
    "export default function ErrorPage({",
    "  error,",
    "  reset,",
    "}: {",
    "  error: Error & { digest?: string };",
    "  reset: () => void;",
    "}) {",
    "  return (",
    `    <main ${WRAPPER}>`,
    '      <h1 className="text-2xl font-semibold">Something went wrong</h1>',
    '      <p className="text-sm opacity-70">{error.message}</p>',
    "      <button",
    '        type="button"',
    '        className="rounded-md border px-4 py-2 text-sm font-medium"',
    "        onClick={reset}",
    "      >",
    "        Try again",
    "      </button>",
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
}

export function nextNotFoundPage(): string {
  return [
    'import Link from "next/link";',
    "",
    "export default function NotFound() {",
    "  return (",
    `    <main ${WRAPPER}>`,
    '      <h1 className="text-4xl font-semibold">404</h1>',
    '      <p className="text-sm opacity-70">This page does not exist.</p>',
    '      <Link href="/" className="text-sm font-medium underline">',
    "        Back to home",
    "      </Link>",
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");
}
