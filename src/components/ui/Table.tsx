import React from "react";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
      }}
    >
      {children}
    </table>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
      {children}
    </td>
  );
}