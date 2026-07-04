import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const blockVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -12, transition: { duration: 0.25 } },
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <motion.div
      className="dashboard branch-dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className="dash-header" variants={itemVariants}>
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
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Çıxış
        </motion.button>
      </motion.header>

      <motion.main className="dash-body">
        <motion.section className="panel brand-picker" variants={itemVariants}>
          <h2>Brend seçin</h2>
          <motion.div className="brand-grid" variants={containerVariants}>
            {BRANDS.map((brand) => (
              <motion.button
                key={brand}
                className={`brand-tile ${selectedBrands.includes(brand) ? 'selected' : ''}`}
                onClick={() => toggleBrand(brand)}
                variants={itemVariants}
                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(139, 92, 246, 0.28)' }}
                whileTap={{ scale: 0.97 }}
                layout
              >
                <span className="tile-hole" />
                <span className="tile-label">{brand}</span>
              </motion.button>
            ))}
          </motion.div>
        </motion.section>

        <motion.form
          className="panel order-panel"
          onSubmit={handleSubmit}
          variants={itemVariants}
        >
          {selectedBrands.length === 0 ? (
            <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Sifariş vermək üçün yuxarıdan ən azı bir brend seçin.
            </motion.p>
          ) : (
            <>
              <h3>Sifariş ver</h3>
              <p className="hint">
                Hər brend üçün aşağıdakı cədvəldə məhsul kodu/adı, say və istəyə bağlı qeyd
                yazın. + düyməsi ilə yeni sətir əlavə edin.
              </p>

              <AnimatePresence mode="popLayout">
                {selectedBrands.map((brand) => (
                  <motion.div
                    key={brand}
                    className="brand-order-block"
                    variants={blockVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                  >
                    <h4>{brand}</h4>
                    <div className="order-lines">
                      <div className="order-line header">
                        <span>Məhsul kodu/adı</span>
                        <span>Say</span>
                        <span>Qeyd</span>
                        <span></span>
                      </div>
                      <AnimatePresence initial={false}>
                        {(brandLines[brand] || [createEmptyLine()]).map((line, index) => (
                          <motion.div
                            className="order-line"
                            key={index}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            layout
                          >
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
                            <motion.button
                              type="button"
                              className="btn-icon danger"
                              onClick={() => removeLine(brand, index)}
                              aria-label="Sətri sil"
                              title="Sətri sil"
                              whileHover={{ scale: 1.1, rotate: 8 }}
                              whileTap={{ scale: 0.9 }}
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
                      onClick={() => addLine(brand)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      + {brand} üçün sətir əlavə et
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {error && (
                <motion.div
                  className="form-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {error}
                </motion.div>
              )}
              <motion.button
                type="submit"
                className="btn-primary"
                disabled={submitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {submitting ? 'Göndərilir…' : 'Bütün sifarişləri birdəfəlik göndər'}
              </motion.button>
            </>
          )}
        </motion.form>

        <motion.section className="panel history-panel" variants={itemVariants}>
          <h3>Sifariş tarixçəm</h3>
          {orders.length === 0 ? (
            <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Hələ sifariş göndərilməyib.
            </motion.p>
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
                  {orders.map((o, i) => (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
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
      </motion.main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
          >
            <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
