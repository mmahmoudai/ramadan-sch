"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface ConfirmModalState {
  open: boolean;
  title: string;
  description?: string;
  requireReason: boolean;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}

export const defaultConfirmModal: ConfirmModalState = {
  open: false,
  title: "",
  description: "",
  requireReason: true,
  destructive: false,
  onConfirm: () => {},
};

interface Props {
  state: ConfirmModalState;
  onClose: () => void;
}

export function ConfirmModal({ state, onClose }: Props) {
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.open) {
      setReason("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [state.open]);

  if (!state.open) return null;

  const canConfirm = !state.requireReason || reason.trim().length >= 3;

  const handleConfirm = () => {
    state.onConfirm(reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-line w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-tight">{state.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {state.description && (
          <p className="text-sm text-gray-600">{state.description}</p>
        )}

        {state.requireReason && (
          <div>
            <label className="block text-sm font-semibold mb-1">
              Reason <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(min 3 chars)</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why you are performing this action"
              className="w-full border-2 border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) handleConfirm();
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-line rounded-xl text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 text-white ${
              state.destructive ? "bg-red-600 hover:bg-red-700" : "bg-ink hover:opacity-90"
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
