import { useEffect, useRef } from 'react';

export default function OrderDeleteModal({ order, onConfirm, onCancel, loading }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onCancel();
  };

  if (!order) return null;

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-card" role="dialog" aria-modal="true">
        <h3>Bu sifarişi sil?</h3>
        <p className="modal-warning">
          Bu sifarişi silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.
        </p>

        <div className="modal-order-summary">
          <div>
            <span className="label">Filial</span>
            <span className="value">{order.branch_name}</span>
          </div>
          <div>
            <span className="label">Brend</span>
            <span className="value">{order.brand}</span>
          </div>
          <div>
            <span className="label">Tarix</span>
            <span className="value mono">{new Date(order.created_at).toLocaleString('az-AZ')}</span>
          </div>
          <div className="full">
            <span className="label">Sifariş mətni</span>
            <span className="value">{order.order_text}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Xeyr, ləğv et
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Silinir…' : 'Bəli, sil'}
          </button>
        </div>
      </div>
    </div>
  );
}
