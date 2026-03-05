// frontend/src/components/ui/Button.tsx
"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export default function Button({ variant = "primary", style, ...props }: Props) {
  const base: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    cursor: "pointer",

    background:
      variant === "primary"
        ? "#0f172a"
        : variant === "danger"
          ? "#dc2626"
          : "#ffffff",

    color:
      variant === "primary"
        ? "#ffffff"
        : variant === "danger"
          ? "#ffffff"
          : "#0f172a",

    borderColor: variant === "danger" ? "#dc2626" : "#cbd5e1",
    fontWeight: variant === "danger" ? 800 : undefined,
  };

  const disabled: React.CSSProperties = props.disabled ? { opacity: 0.5, cursor: "not-allowed" } : {};

  return <button {...props} style={{ ...base, ...disabled, ...style }} />;
}