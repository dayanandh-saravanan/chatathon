// eslint-config-next 16 ships native flat configs, so they are spread directly
// rather than run through FlatCompat (the eslintrc shim crashes on them).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      // Scratch/reference material, not part of the app source.
      ".context/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
