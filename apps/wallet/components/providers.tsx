"use client";

import { CDPHooksProvider } from "@coinbase/cdp-hooks";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://turnpike-production.up.railway.app";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CDPHooksProvider
      config={{
        projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
        basePath:  `${BACKEND_URL}/cdp-proxy`,
        ethereum: {
          createOnLogin: "smart",
        },
      }}
    >
      {children}
    </CDPHooksProvider>
  );
}
