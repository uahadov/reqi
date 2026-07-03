import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { BRANDS } from '../lib/constants';
import Toast from './Toast';

// SEC-009: hard limit that matches the DB CHECK constraint on orders.order_text
const MAX_ORDER_TEXT = 2000;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('az-AZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BranchDashboard() {
  const { user, logout } = useAuth();
  const supabase = useSupabase();

  const [selectedBrand, setSelectedBrand] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [inventoryUpdated, setInventoryUpdated] = useState(null);
  const [orderText, setOrderText] = useState('');
  const [orders, setOrders] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const fetchInventory = async (brand) => {
    setLoadingInventory(true);
    const { data, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('brand', brand)
      .order('product_name', { ascending: true });

    if (invError) {
      setError(`Ehtiyat yüklənə bilmədi: ${invError.message}`);
      setInventory([]);
    } else {
      setInventory(data || []);
      const latest = (data || []).map((r) => r.uploaded_at).filter(Boolean).sort().pop();
      setInventoryUpdated(latest);
    }
    setLoadingInventory(false);
  };

  const fetchOrders = async () => {
    const { data, error: ordError } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', user.id)
      .order('created_at', { ascending: false });

    if (!ordError) setOrders(data || []);
  };

  useEffect(() => {
    fetchOrders();
  }, [user.id, supabase]);

  useEffect(() => {
    if (selectedBrand) fetchInventory(selectedBrand);
  }, [selectedBrand]);

  const handleBrandSelect = (brand) => {
    setSelectedBrand(brand);
    setOrderText('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBrand) return;

    const trimmedText = orderText.trim();

    if (!trimmedText) {
      setError('Zəhmət olmasa sifariş detallarını daxil edin.');
      return;
    }

    // SEC-009: enforce max length before sending to the server
    if (trimmedText.length > MAX_ORDER_TEXT) {
      setError(`Sifariş mətni çox uzundur. Maksimum ${MAX_ORDER_TEXT} simvol ola bilər.`);
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: insertError } = await supabase.from('orders').insert({
      branch_id:   user.id,
      branch_name: user.display_name,
      brand:       selectedBrand,
      order_text:  trimmedText,
    });

    setSubmitting(false);

    if (insertError) {
      setError(`Sifariş göndərilə bilmədi: ${insertError.message}`);
    } else {
      setOrderText('');
      setToast({ message: 'Sifariş göndərildi', type: 'success' });
      fetchOrders();
    }
  };

  return (
    <div className="dashboard branch-dashboard">
      <header className="dash-header">
        <div className="dash-brand">
          <img src="/logo.jpeg" alt="BOUTIQUE" className="dash-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Filial: {user.display_name}</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={logout}>
          Çıxış
        </button>
      </header>

      <main className="dash-body">
        <section className="brand-picker">
          <h2>Brend seçin</h2>
          <div className="brand-grid">
            {BRANDS.map((brand) => (
              <button
                key={brand}
                className={`brand-tile ${selectedBrand === brand ? 'selected' : ''}`}
                onClick={() => handleBrandSelect(brand)}
              >
                <span className="tile-hole" />
                <span className="tile-label">{brand}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedBrand && (
          <section className="brand-workspace">
            <div className="panel inventory-panel">
              <div className="panel-header">
                <h3>{selectedBrand} ehtiyatı</h3>
                {inventoryUpdated && (
                  <span className="muted">Yeniləndi {formatDate(inventoryUpdated)}</span>
                )}
              </div>

              {loadingInventory ? (
                <p className="muted">Ehtiyat yüklənir…</p>
              ) : inventory.length === 0 ? (
                <p className="muted">{selectedBrand} üçün hələ ehtiyat yüklənməyib.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>Məhsul</th>
                        <th className="numeric">Say</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name}</td>
                          <td className="numeric mono">{item.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <form className="panel order-panel" onSubmit={handleSubmit}>
              <h3>Sifariş ver — {selectedBrand}</h3>
              <p className="hint">
                Aşağıya ehtiyacınız olanı yazın. Ehtiyatı bələdçi kimi istifadə edə bilərsiniz,
                ancaq istənilən sərbəst mətn sifarişi qəbul edilir.
              </p>
              <textarea
                rows={6}
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                placeholder={`məs. Vancat balıq 2kq — 10 ədəd, Vancat toyuq konservi 400qr — 24 ədəd`}
                maxLength={MAX_ORDER_TEXT}
              />
              {/* SEC-009: live character counter so user knows the limit */}
              <p className="hint" style={{ textAlign: 'right', marginTop: '4px' }}>
                {orderText.length} / {MAX_ORDER_TEXT}
              </p>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Göndərilir…' : 'Sifarişi göndər'}
              </button>
            </form>
          </section>
        )}

        <section className="panel history-panel">
          <h3>Sifariş tarixçəm</h3>
          {orders.length === 0 ? (
            <p className="muted">Hələ sifariş göndərilməyib.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarix</th>
                    <th>Brend</th>
                    <th>Sifariş</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono nowrap">{formatDate(o.created_at)}</td>
                      <td>{o.brand}</td>
                      <td>{o.order_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
