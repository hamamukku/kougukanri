// frontend/src/components/ui/ActionMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export type ActionMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  label?: string;
  items: ActionMenuItem[];
  disabled?: boolean;
};

export default function ActionMenu({ label = "⋯", items, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: 38,
            minWidth: 130,
            padding: 6,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
            zIndex: 40,
          }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              style={{
                width: "100%",
                textAlign: "left",
                border: item.danger ? "1px solid #dc2626" : "none",
                background: item.danger ? "#dc2626" : "transparent",
                padding: "8px 10px",
                borderRadius: 8,
                cursor: item.disabled ? "not-allowed" : "pointer",
                opacity: item.disabled ? 0.5 : 1,
                color: item.danger ? "#ffffff" : "#0f172a",
                fontWeight: item.danger ? 800 : undefined,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}