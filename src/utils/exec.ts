import { spawn } from "node:child_process";

export interface ExecOptions {
  cwd?: string;
  verbose?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class ExecError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly code: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly spawnError: string | null;

  constructor(params: {
    command: string;
    args: string[];
    code: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    spawnError?: string;
  }) {
    const label = `${params.command} ${params.args.join(" ")}`.trim();
    const detail = params.spawnError
      ? `Failed to spawn "${params.command}": ${params.spawnError}`
      : params.stderr.trim() ||
        params.stdout.trim() ||
        `Exited with code ${params.code}`;
    super(`Command failed: ${label}\n${detail}`);
    this.name = "ExecError";
    this.command = params.command;
    this.args = params.args;
    this.code = params.code;
    this.signal = params.signal;
    this.stdout = params.stdout;
    this.stderr = params.stderr;
    this.spawnError = params.spawnError ?? null;
  }
}

function resolveExecutable(name: string): string {
  if (process.platform !== "win32") return name;
  if (/[\\/]/.test(name)) return name;
  if (name.endsWith(".cmd") || name.endsWith(".exe") || name.endsWith(".bat"))
    return name;
  return `${name}.cmd`;
}

export function resolveCommand(command: string): string {
  return resolveExecutable(command);
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}

export async function exec(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const resolved = resolveExecutable(command);
  return new Promise<ExecResult>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(resolved, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      reject(
        new ExecError({
          command,
          args,
          code: null,
          signal: null,
          stdout: "",
          stderr: "",
          spawnError: error instanceof Error ? error.message : String(error),
        }),
      );
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      if (options.verbose) process.stdout.write(text);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      if (options.verbose) process.stderr.write(text);
    });
    child.on("error", (error: Error) => {
      if (settled) return;
      settled = true;
      reject(
        new ExecError({
          command,
          args,
          code: null,
          signal: null,
          stdout,
          stderr,
          spawnError: error.message,
        }),
      );
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new ExecError({ command, args, code, signal, stdout, stderr }));
      }
    });
  });
}
