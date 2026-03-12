import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className="modal"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: .18 }}
            onClick={e => e.stopPropagation()}>
            {title && <div className="modal-title">{title}</div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}