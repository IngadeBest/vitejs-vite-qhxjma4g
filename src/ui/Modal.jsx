import React from 'react';

export default function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={(e)=>{ if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 10, maxWidth: 900, width: 'min(96%,900px)', boxShadow: '0 10px 40px rgba(2,6,23,0.3)', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          {title ? <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3> : null}
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => onClose && onClose()} aria-label="Sluit" style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}
