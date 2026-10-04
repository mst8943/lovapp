import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "apps/**", "backups/**", "artifacts/**", "tmp/**", "recovery/**", "recovery3/**", "recovery4/**", "components/components/**", "test-verify.js"]),
]);
