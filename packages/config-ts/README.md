# @omega/config-ts

Configs base de TypeScript compartidas por el monorepo.

## Archivos

- `base.json` — config para librerías: `strict`, `target: ES2022`, `moduleResolution: bundler`, `noEmit`.
- `nextjs.json` — extiende `base.json` con los ajustes que Next.js espera (JSX, paths, `allowJs`).

## Uso

En un paquete nuevo:

```json
{
  "extends": "@omega/config-ts/base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

En una app Next:

```json
{
  "extends": "@omega/config-ts/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*", ".next/types/**/*.ts"]
}
```
