"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus } from "lucide-react";

export function EmeraldCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
}) {
  const active = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={clsx("inline-flex h-4 w-4 items-center justify-center", className)}
    >
      <motion.span
        animate={{ scale: active ? 1 : 0.95 }}
        transition={{ type: "spring", stiffness: 360, damping: 25 }}
        className={clsx(
          "relative inline-flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
          checked
            ? "border-brand bg-brand"
            : indeterminate
            ? "border-brand/80 bg-brand/70"
            : "border-brand/45 bg-[rgba(10,10,10,0.72)]",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {checked ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              <Check className="h-3 w-3 text-white" aria-hidden />
            </motion.span>
          ) : indeterminate ? (
            <motion.span
              key="minus"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              <Minus className="h-3 w-3 text-white" aria-hidden />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
