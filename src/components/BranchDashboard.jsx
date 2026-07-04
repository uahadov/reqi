import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { BRANDS } from '../lib/constants';
import Toast from './Toast';

const MAX_PRODUCT_CODE = 200;
const MAX_NOTE = 200;
const MAX_QTY = 1_000_000;
const ease = [0.22, 1, 0.36, 1];

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

function isoDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
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
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [historyBrandFilter, setHistoryBrandFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ dateFrom: '', dateTo: '', brand: '' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    const { data, error: ordError } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', user.id)
      .order('created_at', { ascending: false });

    if (!ordError) {
      setOrders(data || []);
      setFilteredOrders(data || []);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, supabase]);

  const toggleBrand = (brandName) => {
    setSelectedBrands((prev) => {
      const exists = prev.includes(brandName);
      if (exists) {
        return prev.filter((b) => b !== brandName);
      }
      setBrandLines((lines) => ({
        ...lines,
        [brandName]: [createEmptyLine()],
      }));
      return [...prev, brandName];
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
    <motion.div
      className="dashboard branch-dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease }}
    >
      <motion.header
        className="dash-header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
      >
        <div className="dash-brand">
          <img src="/logo.jpeg" alt="BOUTIQUE" className="dash-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Filial: {user.display_name}</p>
          </div>
        </div>
        <motion.button
          className="btn-secondary"
          onClick={logout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Çıxış
        </motion.button>
      </motion.header>

      <main className="dash-body">
        <motion.section
          className="panel brand-picker"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease }}
        >
          <h2>Brend seçin</h2>
          <div className="brand-grid">
            {BRANDS.map((brand, i) => (
              <motion.button
                key={brand.name}
                className={`brand-tile ${selectedBrands.includes(brand.name) ? 'selected' : ''}`}
                onClick={() => toggleBrand(brand.name)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.03, duration: 0.35, ease }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="tile-hole" />
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="brand-logo"
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <span className="tile-label">{brand.name}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        <motion.form
          className="panel order-panel"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease }}
        >
          {selectedBrands.length === 0 ? (
            <p className="muted">Sifariş vermək üçün yuxarıdan ən azı bir brend seçin.</p>
          ) : (
            <>
              <h3>Sifariş ver</h3>
              <p className="hint">
                Hər brend üçün aşağıdakı cədvəldə məhsul kodu/adı, say və istəyə bağlı qeyd
                yazın. + düyməsi ilə yeni sətir əlavə edin.
              </p>

              <AnimatePresence mode="popLayout">
                {selectedBrands.map((brandName) => {
                  const brand = BRANDS.find((b) => b.name === brandName) || { name: brandName };
                  return (
                  <motion.div
                    key={brandName}
                    className="brand-order-block"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease }}
                    layout
                  >
                    <h4>{brand.name}</h4>
                    <div className="order-lines">
                      <div className="order-line header">
                        <span>Məhsul kodu/adı</span>
                        <span>Say</span>
                        <span>Qeyd</span>
                        <span></span>
                      </div>
                      <AnimatePresence initial={false}>
                        {(brandLines[brandName] || [createEmptyLine()]).map((line, index) => (
                          <motion.div
                            className="order-line"
                            key={index}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease }}
                            layout
                          >
                            <input
                              type="text"
                              placeholder="məs. Vancat balıq 2kq"
                              value={line.productCode}
                              onChange={(e) =>
                                updateLine(brandName, index, 'productCode', e.target.value)
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
                              onChange={(e) => updateLine(brandName, index, 'qty', e.target.value)}
                            />
                            <input
                              type="text"
                              placeholder="təcili lazımdır..."
                              value={line.note}
                              onChange={(e) => updateLine(brandName, index, 'note', e.target.value)}
                              maxLength={MAX_NOTE}
                            />
                            <motion.button
                              type="button"
                              className="btn-icon danger"
                              onClick={() => removeLine(brandName, index)}
                              aria-label="Sətri sil"
                              title="Sətri sil"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              🗑
                            </motion.button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <motion.button
                      type="button"
                      className="btn-secondary add-line-btn"
                      onClick={() => addLine(brandName)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      + {brand.name} üçün sətir əlavə et
                    </motion.button>
                  </motion.div>
                );
              })}
              </AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.div
                    className="form-error"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2, ease }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                className="btn-primary"
                disabled={submitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {submitting ? 'Göndərilir…' : 'Bütün sifarişləri birdəfəlik göndər'}
              </motion.button>
            </>
          )}
        </motion.form>

        <motion.section
          className="panel history-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease }}
        >
          <div className="panel-header">
            <h3>Sifariş tarixçəm</h3>
            <div className="history-filters">
              <label className="date-filter">
                <span>Başlanğıc</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="date-filter">
                <span>Son</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              <label className="text-filter">
                <span>Brend</span>
                <select
                  value={historyBrandFilter}
                  onChange={(e) => setHistoryBrandFilter(e.target.value)}
                >
                  <option value="">Bütün brendlər</option>
                  {BRANDS.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <motion.button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const filters = { dateFrom, dateTo, brand: historyBrandFilter };
                  setAppliedFilters(filters);
                  const next = orders.filter((o) => {
                    const d = isoDate(o.created_at);
                    if (filters.dateFrom && d < filters.dateFrom) return false;
                    if (filters.dateTo && d > filters.dateTo) return false;
                    if (filters.brand && o.brand !== filters.brand) return false;
                    return true;
                  });
                  setFilteredOrders(next);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Axtar
              </motion.button>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <p className="muted">
              {orders.length === 0
                ? 'Hələ sifariş göndərilməyib.'
                : 'Cari filtrlərə uyğun sifariş yoxdur.'}
            </p>
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
                  {filteredOrders.map((o, i) => (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03, duration: 0.25, ease }}
                    >
                      <td className="mono nowrap">{formatDate(o.created_at)}</td>
                      <td>{o.brand}</td>
                      <td>{o.product_code}</td>
                      <td className="numeric mono">{o.qty}</td>
                      <td>{o.note || '—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease }}
          >
            <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
