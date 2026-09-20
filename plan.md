# Plan – publicar `@raulmoracode/create` en GitHub

Perfecto, con raulmoracode como usuario queda todo alineado. Plan final (sin ejecutar, solo propuesta):

## Decisión cerrada contigo

- Repo: github.com/raulmoracode/raulmoracode-create (mantener largo, = tu carpeta actual)
- Paquete npm: `@raulmoracode/create` (scope = tu usuario → válido para GitHub Packages, `raulmoracode/create` solo no sería válido en npm)
- Binario: `create-raulmoracode` (sin cambio)
- Uso futuro: `pnpm create @raulmoracode my-app`, `pnpm dlx @raulmoracode/create my-app`, global `npm i -g @raulmoracode/create` → comando `create-raulmoracode`

## Qué falta hoy (visto en tus ficheros)

- `package.json:2` es `create-raulmoracode` → hay que renombrar a `@raulmoracode/create`, añadir `repository: github:raulmoracode/raulmoracode-create`, `publishConfig: {registry: https://npm.pkg.github.com}`.
- `bin.js:1` ok shebang pero sin `+x` (`-rw-r--r--`).
- Falta `.gitignore` (evitar subir `node_modules/`), falta `LICENSE` (declaras MIT), no hay `.git/`.
- `README.md:18,23-24,34` e `index.js:80,280` hablan de `pnpm create raulmoracode` → hay que actualizar a `pnpm create @raulmoracode`.
- Falta workflow `.github/workflows/publish.yml` para publicar el `.tgz` en Packages en cada tag `v*`.

## Plan de ejecución en modo build

1. Preparar: `chmod +x`, crear `.gitignore` + `LICENSE`, editar `package.json`, actualizar `README` + `helpText`, `pnpm run check` + `pnpm pack --dry-run`.
2. Subir código: `git init -b main`, commit inicial, `gh repo create raulmoracode/raulmoracode-create --public --source=. --push`. Código y paquete quedan en el mismo repo como quieres.
3. Publicar en GitHub Packages: login una vez `npm login --registry=https://npm.pkg.github.com` con PAT `write:packages`, o mejor workflow con `GITHUB_TOKEN (packages:write)`. Crear tag `v0.1.0` → aparece en `github.com/raulmoracode?tab=packages`.
4. Instalación global en tu Mac: crear `~/.npmrc` con:
   ```
   @raulmoracode:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=ghp_xxx
   ```
   luego `npm i -g @raulmoracode/create` y verificar `create-raulmoracode --help`.
5. Aviso: Packages, aunque sea público, siempre pide token para instalar. En npmjs no haría falta.
