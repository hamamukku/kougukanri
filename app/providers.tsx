"use client";

import { ReactNode, useEffect, useState } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  const isMock = process.env.NEXT_PUBLIC_API_MOCK === "on";
  const isMswLogOff = process.env.NEXT_PUBLIC_MSW_LOG === "off";
  const [ready, setReady] = useState(!isMock);

  useEffect(() => {
    if (!isMock) return;

    (async () => {
      // app/ から src/ へ相対参照
      const { worker } = await import("../src/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass", ...(isMswLogOff ? { quiet: true } : {}) });
      setReady(true);
    })();
  }, [isMock]);

  if (!ready) return null;
  return <>{children}</>;
}
