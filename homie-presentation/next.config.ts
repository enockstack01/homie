import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop shell (desktop/electron/main.ts) loads this app from 127.0.0.1, not
  // localhost - Next 16 blocks cross-origin dev-mode requests (HMR websocket, RSC
  // fetches) from any host not in this list by default, which otherwise surfaces as a
  // harmless-looking but noisy "Blocked cross-origin request" warning in the Electron
  // console on every load.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
