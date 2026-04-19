/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],
  ignorePatterns: ["node_modules", ".next", "dist", ".turbo"],
};
