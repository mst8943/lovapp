"use client";

import { motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { useDialog } from "@/lib/use-dialog";

export function PremiumNotice({ message, onClose }: { message: string; onClose: () => void }) {
  const dialog = useDialog(onClose);
  useEffect(() => { const timer = window.setTimeout(onClose, 6_000); return () => window.clearTimeout(timer); }, [onClose]);

  return <motion.div className="premium-notice-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div ref={dialog} className="premium-notice" role="alertdialog" aria-modal="true" aria-label="Bilgilendirme" initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97, y: 8 }} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 80) onClose(); }} onClick={(event) => event.stopPropagation()}>
      <span><Sparkles size={18} /></span><div><small>Lovask</small><p>{message}</p></div><button type="button" aria-label="Bildirimi kapat" onClick={onClose}><X size={18} /></button>
    </motion.div>
  </motion.div>;
}
