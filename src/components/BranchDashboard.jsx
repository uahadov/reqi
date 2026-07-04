import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { BRANDS } from '../lib/constants';
import Toast from './Toast';

const MAX_PRODUCT_CODE = 200;
const MAX_NOTE = 200;
const MAX_QTY = 1_000_000;

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

function createEmptyLine() {
  return { productCode: '', qty: '', note: '' };
}

export default function BranchDashboard() {
  const { user, logout } = useAuth();
  const supabase = useSupabase();

  const [selectedBrands, setSelectedBrands] = useState([]);
  const [brandLines, setBrandLines] = useState({});
  const [orders, setOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

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

  const toggleBrand = (brand) => {
    setSelectedBrands((prev) => {
      const exists = prev.includes(brand);
      if (exists) {
        return prev.filter((b) => b !== brand);
      }
      setBrandLines((lines) => ({
        ...lines,
        [brand]: [createEmptyLine()],
      }));
      return [...prev, brand];
    });
    setError('');
  };

  const updateLine = (brand, index, field, value) => {
    setBrandLines((prev) => {
      const next = { ...prev };
      const lines = [...(next[brand] || [createEmptyLine()])];
      lines[index] = { ...lines[index], [field]: value };
      next[brand] = lines;
      return next;
    });
  };

  const addLine = (brand) => {
    setBrandLines((prev) => ({
      ...prev,
      [brand]: [...(prev[brand] || [createEmptyLine()]), createEmptyLine()],
    }));
  };

  const removeLine = (brand, index) => {
    setBrandLines((prev) => {
      const lines = prev[brand] || [createEmptyLine()];
      if (lines.length <= 1) {
        return { ...prev, [brand]: [createEmptyLine()] };
      }
      return { ...prev, [brand]: lines.filter((_, i) => i !== index) };
    });
  };

  const validateAll = () => {
    const validLines = [];
    for (const brand of selectedBrands) {
      const lines = brandLines[brand] || [createEmptyLine()];
      for (const line of lines) {
        const code = line.productCode.trim();
        const qtyRaw = String(line.qty).trim();
        const qty = Number(qtyRaw);

        if (!code && !qtyRaw) continue;

        if (!code) {
          setError(`${brand} brendində bütün sətirlərdə məhsul kodu/adı olmalıdır.`);
          return null;
        }
        if (!qtyRaw || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
          setError(`${brand} brendində bütün sətirlərdə düzgün say daxil edin.`);
          return null;
        }
        if (code.length > MAX_PRODUCT_CODE) {
          setError(
            `${brand} brendində məhsul kodu/adı çox uzundur. Maksimum ${MAX_PRODUCT_CODE} simvol.`
          );
          return null;
        }
        if ((line.note || '').trim().length > MAX_NOTE) {
          setError(`${brand} brendində qeyd çox uzundur. Maksimum ${MAX_NOTE} simvol.`);
          return null;
        }

        validLines.push({
          branch_id: user.id,
          branch_name: user.display_name,
          brand,
          product_code: code,
          qty,
          note: (line.note || '').trim() || null,
        });
      }
    }

    if (validLines.length === 0) {
      setError('Zəhmət olmasa ən azı bir məhsul sətri doldurun.');
      return null;
    }

    return validLines;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedBrands.length === 0) return;

    setError('');
    const validLines = validateAll();
    if (!validLines) return;

    setSubmitting(true);

    const { error: insertError } = await supabase.from('orders').insert(validLines);

    setSubmitting(false);

    if (insertError) {
      setError(`Sifariş göndərilə bilmədi: ${insertError.message}`);
    } else {
      const reset = {};
      for (const brand of selectedBrands) {
        reset[brand] = [createEmptyLine()];
      }
      setBrandLines(reset);
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
                className={`brand-tile ${selectedBrands.includes(brand) ? 'selected' : ''}`}
                onClick={() => toggleBrand(brand)}
              >
                <span className="tile-hole" />
                <span className="tile-label">{brand}</span>
              </button>
            ))}
          </div>
        </section>

        <form className="panel order-panel" onSubmit={handleSubmit}>
          {selectedBrands.length === 0 ? (
            <p className="muted">Sifariş vermək üçün yuxarıdan ən azı bir brend seçin.</p>
          ) : (
            <>
              <h3>Sifariş ver</h3>
              <p className="hint">
                Hər brend üçün aşağıdakı cədvəldə məhsul kodu/adı, say və istəyə bağlı qeyd
                yazın. + düyməsi ilə yeni sətir əlavə edin.
              </p>

              {selectedBrands.map((brand) => (
                <div key={brand} className="brand-order-block">
                  <h4>{brand}</h4>
                  <div className="order-lines">
                    <div className="order-line header">
                      <span>Məhsul kodu/adı</span>
                      <span>Say</span>
                      <span>Qeyd</span>
                      <span></span>
                    </div>
                    {(brandLines[brand] || [createEmptyLine()]).map((line, index) => (
                      <div className="order-line" key={index}>
                        <input
                          type="text"
                          placeholder="məs. Vancat balıq 2kq"
                          value={line.productCode}
                          onChange={(e) =>
                            updateLine(brand, index, 'productCode', e.target.value)
                          }
                          maxLength={MAX_PRODUCT_CODE}
                        />
                        <input
                          type="number"
                          min={1}
                          max={MAX_QTY}
                          step="1"
                          placeholder="0"
                          value={line.qty}
                          onChange={(e) => updateLine(brand, index, 'qty', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="təcili lazımdır..."
                          value={line.note}
                          onChange={(e) => updateLine(brand, index, 'note', e.target.value)}
                          maxLength={MAX_NOTE}
                        />
                        <button
                          type="button"
                          className="btn-icon danger"
                          onClick={() => removeLine(brand, index)}
                          aria-label="Sətri sil"
                          title="Sətri sil"
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-secondary add-line-btn"
                    onClick={() => addLine(brand)}
                  >
                    + {brand} üçün sətir əlavə et
                  </button>
                </div>
              ))}

              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Göndərilir…' : 'Bütün sifarişləri birdəfəlik göndər'}
              </button>
            </>
          )}
        </form>

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
                    <th>Məhsul</th>
                    <th className="numeric">Say</th>
                    <th>Qeyd</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono nowrap">{formatDate(o.created_at)}</td>
                      <td>{o.brand}</td>
                      <td>{o.product_code}</td>
                      <td className="numeric mono">{o.qty}</td>
                      <td>{o.note || '—'}</td>
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
