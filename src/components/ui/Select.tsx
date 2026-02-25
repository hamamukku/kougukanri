"use client";

import React from "react";

export default function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const base: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    width: "100%",
    background: "#ffffff",
  };

  return <select {...props} style={{ ...base, ...props.style }} />;
}