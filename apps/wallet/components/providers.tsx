"use client";

import dynamic from "next/dynamic";
import { CDPHooksProvider } from "@coinbase/cdp-hooks";

function CDPProviderInner({ children }: { children: React.ReactNode }) {
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

const CDPProviderNoSSR = dynamic(() => Promise.resolve(CDPProviderInner), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <CDPProviderNoSSR>{children}</CDPProviderNoSSR>;
}
