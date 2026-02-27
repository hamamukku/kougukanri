"use client";

import React from "react";

export default function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const base: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    width: "100%",
  };

  return <input {...props} style={{ ...base, ...props.style }} />;
}