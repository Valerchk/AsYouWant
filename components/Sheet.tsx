"use client";

import { motion, useDragControls } from "motion/react";

/* The sheet chrome both editors share: the dimmed day behind, the panel that
   rises from the thumb, and the grab handle.

   The drag lives on the handle rather than on the whole panel so the body can
   scroll — a goal's sixteen colours and sixteen icons are taller than a phone,
   and a panel that drags from anywhere swallows the scroll that would reach
   them. (TemplateSheet still carries its own copy of this chrome.) */

export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const controls = useDragControls();

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-deep/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-label={label}
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-plate border-t border-rule bg-paper shadow-lift"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          // A flick downward dismisses, the way every sheet on the phone does.
          if (info.offset.y > 90 || info.velocity.y > 600) onClose();
        }}
      >
        <div
          onPointerDown={(e) => controls.start(e)}
          className="flex touch-none justify-center pt-3 pb-1"
        >
          <div className="h-1 w-10 rounded-plate bg-rule" />
        </div>

        <div className="mx-auto max-h-[78dvh] max-w-2xl overflow-y-auto px-6 pt-3 pb-6">
          {children}
        </div>
      </motion.div>
    </>
  );
}
