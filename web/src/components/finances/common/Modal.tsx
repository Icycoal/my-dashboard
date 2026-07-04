import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-2xl border border-white/[0.08] bg-gray-900 p-0 text-gray-100 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight text-gray-50">{title}</h2>
        <button onClick={onClose} className="-mr-1 flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200">
          <span className="text-lg leading-none">&times;</span>
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
