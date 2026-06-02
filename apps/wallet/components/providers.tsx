"use client";

import { CDPHooksProvider } from "@coinbase/cdp-hooks";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CDPHooksProvider
      config={{
        projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
        basePath:  `${process.env.NEXT_PUBLIC_API_URL ?? "https://turnpike-production.up.railway.app"}/cdp-proxy`,
        ethereum: {
          createOnLogin: "smart",
        },
      }}
    >
      {children}
    </CDPHooksProvider>
  );
}
