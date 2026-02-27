"use client";

import {
  createContext,
  CSSProperties,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  okText?: string;
  cancelText?: string;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  backgroundColor: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialogStyle: CSSProperties = {
  minWidth: 320,
  maxWidth: "90vw",
  background: "#ffffff",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  padding: 16,
};

const buttonBase: CSSProperties = {
  minHeight: 36,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  padding: "0 16px",
  fontWeight: 700,
};

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        title: options.title,
        message: options.message,
        okText: options.okText || "OK",
        cancelText: options.cancelText || "キャンセル",
        resolve,
      });
    });
  }, []);

  const close = useCallback(
    (next: boolean) => {
      setState((current) => {
        if (current) {
          current.resolve(next);
        }
        return null;
      });
    },
    []
  );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state ? (
        <div style={overlayStyle} onClick={() => close(false)}>
          <div
            style={dialogStyle}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {state.title ? <h3 style={{ margin: "0 0 8px" }}>{state.title}</h3> : null}
            <p style={{ margin: "0 0 12px" }}>{state.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => close(false)}
                style={{ ...buttonBase, background: "#fff" }}
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                style={{ ...buttonBase, background: "#0f172a", color: "#fff", borderColor: "#0f172a" }}
              >
                {state.okText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
