# @omega/config-eslint

Configs base de ESLint compartidas.

## Archivos

- `index.js` — config base para librerías TS.
- `nextjs.js` — extiende `index.js` con las reglas de Next.

## Uso

```js
// .eslintrc.cjs
module.exports = {
  root: true,
  extends: ['@omega/config-eslint'],     // o '@omega/config-eslint/nextjs'
};
```

Hoy los paquetes de librería no corren `lint` (la tarea hace echo). Las apps Next usan `next lint` directamente con `eslint-config-next`.
