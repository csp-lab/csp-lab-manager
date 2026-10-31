"use client";

import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <OctagonX className="size-4" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          title: "font-mono text-[13px]",
        },
      }}
      style={
        {
          fontFamily: "var(--font-inter), Inter, sans-serif",
          "--normal-bg": "var(--bg-panel)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--bg-card-border)",
          "--success-bg": "#ecfdf5",
          "--success-border": "#a7f3d0",
          "--success-text": "#047857",
          "--error-bg": "#fdf2ef",
          "--error-border": "#f0c2b8",
          "--error-text": "var(--red)",
          "--border-radius": "6px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
