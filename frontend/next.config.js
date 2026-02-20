const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

/** @type {import('next').NextConfig} */
const baseConfig = {
  transpilePackages: ["shared"],
};

module.exports = (phase) => ({
  ...baseConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
});
