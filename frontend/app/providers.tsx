"use client";

import { ReactNode, useEffect, useState } from "react";
import ConfirmProvider from "../src/components/ui/ConfirmProvider";

export default function Providers({ children }: { children: ReactNode }) {
  const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "1";
  const [ready, setReady] = useState(!useMocks);

  useEffect(() => {
    if (!useMocks) return;

    (async () => {
      const { worker } = await import("../src/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass" });
      setReady(true);
    })();
  }, [useMocks]);

  if (!ready) return null;
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
