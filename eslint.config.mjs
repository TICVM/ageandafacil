import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: [".next/*", "node_modules/*", "dist/*"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "@next/next/no-page-custom-font": "off",
    },
  },
];
