"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export default function Button({ variant = "primary", style, ...props }: Props) {
  const base: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    cursor: "pointer",
    background: variant === "primary" ? "#0f172a" : "#ffffff",
    color: variant === "primary" ? "#ffffff" : "#0f172a",
  };

  const disabled: React.CSSProperties = props.disabled
    ? { opacity: 0.5, cursor: "not-allowed" }
    : {};

  return <button {...props} style={{ ...base, ...disabled, ...style }} />;
}