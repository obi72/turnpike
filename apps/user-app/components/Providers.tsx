"use client";

import { CDPHooksProvider } from "@coinbase/cdp-hooks";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CDPHooksProvider
      config={{
        projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
        ethereum: { createOnLogin: "smart" },
      }}
    >
      {children}
    </CDPHooksProvider>
  );
}
