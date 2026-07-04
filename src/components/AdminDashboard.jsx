import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { BRANCHES, BRANDS } from '../lib/constants';
import Toast from './Toast';
import OrderDeleteModal from './OrderDeleteModal';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.03, duration: 0.28 } }),
};

// SEC-007: Sanitise a value before writing it to an Excel cell.
// Any string starting with a formula-initiating character is prefixed with
// a single quote so Excel / LibreOffice treats it as literal text, not a formula.
// This prevents CSV/Excel formula injection (DDE, HYPERLINK, CMD payloads).
function sanitizeExcelCell(value) {
  if (typeof value !== 'string') return value;
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  if (formulaChars.includes(value[0])) {
    return "'" + value;
  }
  return value;
}

// SEC-016: Accepted file MIME types for inventory upload.
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',                                                           // .csv
  'application/csv',
  'text/plain',                                                         // some OS report .csv as text/plain
]);
const ALLOWED_UPLOAD_EXT = /\.(xlsx|xls|csv)$/i;

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

// ------------------------------------------------------------------
// Orders tab
// ------------------------------------------------------------------
function OrdersTab({ supabase }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [branchFilter, setBranchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    branch: '',
    brand: '',
    dateFrom: '',
    dateTo: '',
  });

  const [deleteOrder, setDeleteOrder] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (appliedFilters.branch && o.branch_name !== appliedFilters.branch) return false;
      if (appliedFilters.brand && o.brand !== appliedFilters.brand) return false;
      const d = isoDate(o.created_at);
      if (appliedFilters.dateFrom && d < appliedFilters.dateFrom) return false;
      if (appliedFilters.dateTo && d > appliedFilters.dateTo) return false;
      return true;
    });
  }, [orders, appliedFilters]);

  const handleExport = () => {
    if (filteredOrders.length === 0) return;
    // SEC-007: sanitize every user-supplied field before writing to Excel.
    // This neutralises formula injection (=HYPERLINK, =CMD, DDE payloads, etc.).
    const rows = filteredOrders.map((o) => ({
      Tarix:            formatDate(o.created_at),         // server-generated timestamp — safe
      Filial:           sanitizeExcelCell(o.branch_name),
      Brend:            sanitizeExcelCell(o.brand),
      Məhsul:           sanitizeExcelCell(o.product_code),
      Say:              o.qty,
      Qeyd:             sanitizeExcelCell(o.note || ''),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sifarişlər');
    XLSX.writeFile(wb, `boutique-sifarisler-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const confirmDelete = async () => {
    if (!deleteOrder) return;
    setDeleting(true);
    const { error } = await supabase.rpc('soft_delete_order', { order_id: deleteOrder.id });
    setDeleting(false);

    if (error) {
      setToast({ message: 'Sifariş silinə bilmədi.', type: 'error' });
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== deleteOrder.id));
      setToast({ message: 'Sifariş silindi', type: 'success' });
      setDeleteOrder(null);
    }
  };

  return (
    <motion.div className="tab-content" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div className="toolbar" variants={itemVariants}>
        <div className="filters">
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="">Bütün filiallar</option>
            {BRANCHES.map((b) => (
              <option key={b.username} value={b.displayName}>
                {b.displayName}
              </option>
            ))}
          </select>

          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">Bütün brendlər</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <label className="date-filter">
            <span>Başlanğıc</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label className="date-filter">
            <span>Son</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>

          <motion.button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setAppliedFilters({
                branch: branchFilter,
                brand: brandFilter,
                dateFrom,
                dateTo,
              })
            }
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Axtar
          </motion.button>
        </div>

        <motion.button
          className="btn-primary"
          onClick={handleExport}
          disabled={filteredOrders.length === 0}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Excel-ə çıxar
        </motion.button>
      </motion.div>

      {loading ? (
        <motion.p className="muted" variants={itemVariants}>
          Sifarişlər yüklənir…
        </motion.p>
      ) : filteredOrders.length === 0 ? (
        <motion.p className="muted" variants={itemVariants}>
          Cari filtrlərə uyğun sifariş yoxdur.
        </motion.p>
      ) : (
        <motion.div className="table-wrap" variants={itemVariants}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarix</th>
                <th>Filial</th>
                <th>Brend</th>
                <th>Məhsul</th>
                <th className="numeric">Say</th>
                <th>Qeyd</th>
                <th className="actions">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o, i) => (
                <motion.tr
                  key={o.id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <td className="mono nowrap">{formatDate(o.created_at)}</td>
                  <td>
                    <span className="branch-tag">{o.branch_name}</span>
                  </td>
                  <td>{o.brand}</td>
                  <td>{o.product_code}</td>
                  <td className="numeric mono">{o.qty}</td>
                  <td>{o.note || '—'}</td>
                  <td className="actions">
                    <motion.button
                      className="btn-icon danger"
                      onClick={() => setDeleteOrder(o)}
                      aria-label="Sifarişi sil"
                      title="Sifarişi sil"
                      whileHover={{ scale: 1.1, rotate: 8 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      🗑
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <OrderDeleteModal
        order={deleteOrder}
        onCancel={() => setDeleteOrder(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />

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

// ------------------------------------------------------------------
// Inventory tab (kept for future use)
// ------------------------------------------------------------------
function InventoryTab({ supabase }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .order('brand', { ascending: true })
      .order('product_name', { ascending: true });

    if (!invError) setInventory(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const grouped = useMemo(() => {
    return inventory.reduce((acc, item) => {
      if (!acc[item.brand]) acc[item.brand] = [];
      acc[item.brand].push(item);
      return acc;
    }, {});
  }, [inventory]);

  const normalizeHeader = (h) => {
    if (h == null) return '';
    return String(h)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const parseFile = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 2) throw new Error('Fayl boş görünür.');

    // Try the standard columnar format first: Brand / Product / Qty
    const headers = rows[0].map(normalizeHeader);
    const findCol = (names) => {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const brandIdx = findCol(['brand', 'brend']);
    const productIdx = findCol(['product', 'mehsul', 'məhsul', 'item']);
    const qtyIdx = findCol(['qty', 'quantity', 'say', 'qaliq', 'qalıq', 'stock', 'count']);

    if (brandIdx !== -1 && productIdx !== -1 && qtyIdx !== -1) {
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const brand = String(row[brandIdx] || '').trim();
        const product = String(row[productIdx] || '').trim();
        const qty = parseQty(row[qtyIdx]);

        if (!brand || !product) continue;
        items.push({
          brand,
          product_name: product,
          qty,
        });
      }
      if (items.length > 0) return items;
    }

    // Fallback: parse the customer's daily stock report format where
    // brand names appear as their own row, followed by product rows with
    // columns: No, Product, Qty. The last row is a total line.
    return parseStockReport(rows);
  };

  const parseStockReport = (rows) => {
    const items = [];
    let currentBrand = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map((c) => (c == null ? '' : String(c).trim()));

      // Skip empty rows and header/meta rows
      if (row.every((c) => c === '')) continue;

      const first = row[1] || row[0] || '';
      const normalizedFirst = normalizeHeader(first);

      // Skip title, date, and column header rows
      if (
        normalizedFirst.includes('qaliq') ||
        normalizedFirst.includes('qalıq') ||
        normalizedFirst === 'mal' ||
        normalizedFirst === 'miqdar' ||
        normalizedFirst === 'cemi' ||
        normalizedFirst === 'no' ||
        normalizedFirst === '№'
      ) {
        continue;
      }

      // Total row at the end
      if (normalizedFirst.startsWith('cemi')) continue;

      // Detect brand row: single non-empty cell in the product column
      // and the rest empty (or the same value repeated in merged cells)
      const nonEmptyCells = row.filter((c) => c !== '');
      if (nonEmptyCells.length === 1 && first && !/^\d+$/.test(first)) {
        currentBrand = first;
        continue;
      }

      // Product row: columns roughly [No, Product, Qty, ...]
      if (currentBrand) {
        const product = row[1] || row[2] || '';
        const qtyRaw = row[2] || row[3] || '';
        const qty = parseQty(qtyRaw);

        if (product && !product.toLowerCase().includes('cemi')) {
          items.push({
            brand: currentBrand,
            product_name: product,
            qty,
          });
        }
      }
    }

    if (items.length === 0) {
      throw new Error(
        'Etibarlı ehtiyat sətri tapılmadı. Brend, Məhsul və Say/Qalıq sütunlarını əlavə edin.'
      );
    }

    return items;
  };

  const parseQty = (raw) => {
    if (raw == null || raw === '' || raw === '-') return 0;
    // Handle "1 234.000" and "1.000" style formatting
    const cleaned = String(raw)
      .replace(/\s+/g, '')
      .replace(/,/g, '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };

  // SEC-016: maximum upload file size (5 MB)
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // SEC-016: validate file type by MIME type AND extension
    // (the `accept` attribute is UI-only and trivially bypassed)
    if (!ALLOWED_UPLOAD_TYPES.has(file.type) && !ALLOWED_UPLOAD_EXT.test(file.name)) {
      setError('Yalnız .xlsx, .xls və .csv faylları qəbul edilir.');
      e.target.value = '';
      return;
    }

    // SEC-016: guard against excessively large files before parsing
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Fayl həcmi 5 MB-dan çox ola bilməz.');
      e.target.value = '';
      return;
    }

    setParsing(true);
    setError('');

    try {
      const items = await parseFile(file);
      const { error: rpcError } = await supabase.rpc('replace_inventory', { items });

      if (rpcError) throw rpcError;

      setToast({ message: 'Ehtiyat uğurla yeniləndi', type: 'success' });
      fetchInventory();
    } catch (err) {
      setError(err?.message || 'Ehtiyat faylı emal edilə bilmədi.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  return (
    <div className="tab-content">
      <div className="panel upload-panel">
        <h3>Günün ehtiyatını yüklə</h3>
        <p className="hint">
          Excel və ya CSV fayl yükləyin. İki format dəstəklənir: 1) Sütunlar:{' '}
          <strong>Brend</strong>, <strong>Məhsul</strong>, <strong>Say/Qalıq</strong>; 2)
          Gündəlik anbar qalığı hesabatı — brend adları ayrı sətirdə, altında №, Mal,
          Miqdar sütunları. Bu əməliyyat cari ehtiyat məlumatlarının tamamilə əvəz
          olunması deməkdir.
        </p>
        <label className="file-input-label">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={parsing}
          />
          <span className="btn-primary">{parsing ? 'Yüklənir…' : 'Fayl seç'}</span>
        </label>
        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="panel inventory-group-panel">
        <h3>Cari ehtiyat</h3>
        {loading ? (
          <p className="muted">Yüklənir…</p>
        ) : inventory.length === 0 ? (
          <p className="muted">Hələ ehtiyat yüklənməyib.</p>
        ) : (
          Object.entries(grouped).map(([brand, items]) => (
            <div key={brand} className="inventory-group">
              <h4>{brand}</h4>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Məhsul</th>
                      <th className="numeric">Say</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td className="numeric mono">{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------
// Branches / Passwords tab
// ------------------------------------------------------------------
function BranchesTab({ supabase }) {
  const { user: admin } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [passwords, setPasswords] = useState({});
  const [saving, setSaving] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error) setProfiles(data || []);
    };
    fetchProfiles();
  }, [supabase]);

  const handleSave = async (userId) => {
    const newPassword = passwords[userId];
    if (!newPassword) return;
    setSaving((s) => ({ ...s, [userId]: true }));

    const { error } = await supabase.rpc('change_password', {
      p_user_id: userId,
      p_new_password: newPassword,
    });

    setSaving((s) => ({ ...s, [userId]: false }));

    if (error) {
      setToast({ message: error?.message || 'Şifrə yenilənə bilmədi', type: 'error' });
    } else {
      setToast({ message: 'Şifrə yeniləndi', type: 'success' });
      setPasswords((p) => ({ ...p, [userId]: '' }));
    }
  };

  const renderRow = (p) => (
    <div key={p.id} className="password-row">
      <div className="password-row-info">
        <span className="branch-tag">{p.display_name}</span>
        <span className="role-pill">{p.role}</span>
      </div>
      <div className="password-row-form">
        <input
          type="password"
          placeholder="Yeni şifrə"
          value={passwords[p.id] || ''}
          onChange={(e) => setPasswords((prev) => ({ ...prev, [p.id]: e.target.value }))}
        />
        <button
          className="btn-primary"
          onClick={() => handleSave(p.id)}
          disabled={!passwords[p.id] || saving[p.id]}
        >
          {saving[p.id] ? 'Saxlanılır…' : 'Saxla'}
        </button>
      </div>
    </div>
  );

  const branches = profiles.filter((p) => p.role === 'branch');
  const adminProfile = profiles.find((p) => p.id === admin.id);

  return (
    <motion.div className="tab-content" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div className="panel passwords-panel" variants={itemVariants}>
        <h3>Filial şifrələri</h3>
        {branches.length === 0 ? (
          <p className="muted">Filial hesabı tapılmadı.</p>
        ) : (
          <div className="password-list">{branches.map(renderRow)}</div>
        )}
      </motion.div>

      {adminProfile && (
        <motion.div className="panel passwords-panel" variants={itemVariants}>
          <h3>Admin şifrəsi</h3>
          <div className="password-list">{renderRow(adminProfile)}</div>
        </motion.div>
      )}

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

// ------------------------------------------------------------------
// Admin dashboard shell
// ------------------------------------------------------------------
export default function AdminDashboard() {
  const { logout } = useAuth();
  const supabase = useSupabase();
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <motion.div
      className="dashboard admin-dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className="dash-header" variants={itemVariants}>
        <div className="dash-brand">
          <img src="/logo.jpeg" alt="BOUTIQUE" className="dash-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Admin paneli</p>
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

      <motion.nav className="dash-tabs" variants={itemVariants}>
        <motion.button
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          Sifarişlər
        </motion.button>
        <motion.button
          className={activeTab === 'branches' ? 'active' : ''}
          onClick={() => setActiveTab('branches')}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          Filiallar
        </motion.button>
      </motion.nav>

      <AnimatePresence mode="wait">
        <motion.main
          className="dash-body"
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'orders' && <OrdersTab supabase={supabase} />}
          {activeTab === 'branches' && <BranchesTab supabase={supabase} />}
        </motion.main>
      </AnimatePresence>
    </motion.div>
  );
}
