/**
 * The single shared project-structure model consumed by the generated
 * `AGENTS.md` (`src/config/agents.ts`) and `README.md` (`src/config/readme.ts`).
 *
 * The two documents used to carry byte-identical copies of `TreeNode` and
 * `renderTree`; they now come from here, together with the pure mechanism that
 * crosses the tree with what actually exists on disk: the caller detects
 * existence (I/O) and passes the list of existing paths in, `pruneStructure`
 * filters the tree, `structureBlock` renders it.
 *
 * Pure by construction (§3: `src/config/` performs no I/O): nothing here
 * touches the filesystem or spawns processes.
 */

/** A node of the project tree. Directory names end with a trailing slash. */
export interface TreeNode {
  name: string;
  comment?: string;
  children?: TreeNode[];
}

/** Renders siblings with correct ├──/└── connectors and aligned comments. */
export function renderTree(nodes: TreeNode[], prefix = ""): string[] {
  const width = Math.max(...nodes.map((node) => node.name.length));
  const lines: string[] = [];
  nodes.forEach((node, i) => {
    const last = i === nodes.length - 1;
    const label = node.comment
      ? `${node.name.padEnd(width)}  # ${node.comment}`
      : node.name;
    lines.push(`${prefix}${last ? "└──" : "├──"} ${label}`);
    if (node.children && node.children.length > 0) {
      lines.push(
        ...renderTree(node.children, `${prefix}${last ? "    " : "│   "}`),
      );
    }
  });
  return lines;
}

/** The POSIX project-relative path of a node, without a trailing slash. */
function keyOf(parentPath: string, name: string): string {
  const key = parentPath === "" ? name : `${parentPath}/${name}`;
  return key.endsWith("/") ? key.slice(0, -1) : key;
}

/**
 * Every POSIX project-relative path the tree declares, depth-first and with
 * parent directories included. Directory entries keep their trailing slash so
 * callers can tell them apart from files; the disk check strips it.
 */
export function structurePaths(nodes: TreeNode[], parentPath = ""): string[] {
  const paths: string[] = [];
  const walk = (list: TreeNode[], parent: string): void => {
    for (const node of list) {
      const key = parent === "" ? node.name : `${parent}/${node.name}`;
      paths.push(key);
      if (node.children && node.children.length > 0) {
        walk(node.children, keyOf(parent, node.name));
      }
    }
  };
  walk(nodes, parentPath);
  return paths;
}

/**
 * The tree restricted to what exists on disk. A node is kept when its own path
 * is in `existing`; a directory is additionally kept when at least one of its
 * descendants is kept (so `src/` survives the deletion of a file inside it,
 * but a directory the CLI never wrote, like `src/components/` before the first
 * shadcn component, is not documented). Pure: the caller detects existence.
 */
export function pruneStructure(
  nodes: TreeNode[],
  existing: ReadonlySet<string>,
  parentPath = "",
): TreeNode[] {
  const kept: TreeNode[] = [];
  for (const node of nodes) {
    const key = keyOf(parentPath, node.name);
    let children: TreeNode[] | undefined;
    if (node.children && node.children.length > 0) {
      children = pruneStructure(node.children, existing, key);
    }
    const hasChildren = children !== undefined && children.length > 0;
    if (existing.has(key) || hasChildren) {
      const next: TreeNode = { name: node.name, comment: node.comment };
      if (hasChildren) {
        next.children = children;
      }
      kept.push(next);
    }
  }
  return kept;
}

/**
 * The ```text code fence every generated document uses for its project tree.
 * When `existingPaths` is given the tree is pruned to those paths, so a project
 * whose files changed or were deleted is documented as it actually is.
 */
export function structureBlock(
  nodes: TreeNode[],
  existingPaths?: readonly string[],
): string[] {
  const pruned = existingPaths
    ? pruneStructure(nodes, new Set(existingPaths))
    : nodes;
  return ["```text", ...renderTree(pruned), "```"];
}
