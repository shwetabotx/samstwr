import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <div className="modal-h"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}
export const Field = ({ label, children, hint }) => (<label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>);

export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => {
    const h = e => { setT(e.detail); setTimeout(() => setT(null), 3500); };
    window.addEventListener('toast', h); return () => window.removeEventListener('toast', h);
  }, []);
  return t ? <div className={'toast ' + t.type}>{t.msg}</div> : null;
}
export const Empty = ({ text }) => <div className="empty">{text}</div>;
export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Other'];
