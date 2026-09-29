# Changelog

Todas las novedades de `@raulmoracode/create` se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
el versionado sigue [SemVer](https://semver.org/lang/es/).

## [Unreleased]

Nada pendiente.

## [1.0.0] - 2026-09-29

Primera release estable de `@raulmoracode/create`, publicada en npmjs.

### Añadido

- CLI interactiva con Clack que pide framework (React + Vite o Next.js), preset
  técnico, nombre del proyecto y URL del repositorio de GitHub.
- Scaffolding con los generadores oficiales: `create-vite@9.2.1` y
  `create-next-app@16.3.6`, con versiones pineadas exactas.
- Doce pasos de configuración sobre el proyecto generado: Tailwind CSS,
  branding, shadcn/ui, TanStack Query, Biome, Vitest, VS Code, `.nvmrc`,
  `.editorconfig`, Git hooks, `patchPackageJson` y `.gitignore`.
- Presets seleccionables mediante *multiselect*: Tailwind, shadcn/ui,
  TanStack Query, Biome, testing y Husky + Commitlint.
- Instalación de dependencias con pnpm, con normalización de versiones
  exactas (sin `^` ni `~`).
- Inicialización de Git sobre `main`, commit inicial
  `chore: initial project setup` y `push -u origin main` a GitHub.
- Preflights de Node >= 24, pnpm, git e identidad de git antes de empezar.
- Publicación en npmjs como paquete público con `dist-tag latest`.

[Unreleased]: https://github.com/raulmoracode/raulmoracode-create/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/raulmoracode/raulmoracode-create/releases/tag/v1.0.0
