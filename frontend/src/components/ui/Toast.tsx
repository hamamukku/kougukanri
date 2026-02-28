"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string | null;
  onClose?: () => void;
  duration?: number;
};

export default function Toast({ message, onClose, duration = 2200 }: ToastProps) {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 2000,
        background: "#0f172a",
        color: "#ffffff",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      {message}
    </div>
  );
}
