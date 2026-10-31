"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  typed,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  typed?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const locked = typed ? value !== typed : false;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-terminal/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-panel p-5">
          <Dialog.Title className="text-[16px] leading-snug font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-[15px] leading-normal text-secondary">{body}</Dialog.Description>
          {typed ? (
            <label className="mt-4 block text-[13px] text-muted">
              Type <span className="font-mono text-ink">{typed}</span>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-2 h-9 w-full rounded border border-line bg-white px-3 font-mono text-[13px] outline-none focus:border-terminal"
              />
            </label>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-line bg-card px-4 py-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={locked || pending}
              onClick={onConfirm}
              className="rounded bg-brand px-4 py-2 font-mono text-[13px] text-white disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
