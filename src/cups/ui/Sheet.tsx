// A bottom sheet or overlay rendered above the whole app (and the tab bar), in the Cups look.
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Sheet({ onClose, children, center = false, z = 70 }: { onClose?: () => void; children: ReactNode; center?: boolean; z?: number }) {
  return createPortal(
    <div className={`run-portal fixed inset-0 flex ${center ? 'items-center' : 'items-end'} justify-center bg-black/65`} style={{ zIndex: z, background: 'rgba(0,0,0,.65)' }} onClick={onClose}>
      <div className={`run-panel run-fadeup safe-bottom max-h-[88%] w-full max-w-md overflow-y-auto ${center ? 'mx-4' : 'rounded-b-none'} p-5`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
