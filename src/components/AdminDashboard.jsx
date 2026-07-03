import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { BRANCHES, BRANDS } from '../lib/constants';
import Toast from './Toast';
import OrderDeleteModal from './OrderDeleteModal';

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
  }, [supabase]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (branchFilter && o.branch_name !== branchFilter) return false;
      if (brandFilter && o.brand !== brandFilter) return false;
      const d = isoDate(o.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [orders, branchFilter, brandFilter, dateFrom, dateTo]);

  const handleExport = () => {
    if (filteredOrders.length === 0) return;
    const rows = filteredOrders.map((o) => ({
      Tarix: formatDate(o.created_at),
      Filial: o.branch_name,
      Brend: o.brand,
      'Sifariş mətni': o.order_text,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sifarişlər');
    XLSX.writeFile(wb, `pethub-sifarisler-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    <div className="tab-content">
      <div className="toolbar">
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
        </div>

        <button className="btn-primary" onClick={handleExport} disabled={filteredOrders.length === 0}>
          Excel-ə çıxar
        </button>
      </div>

      {loading ? (
        <p className="muted">Sifarişlər yüklənir…</p>
      ) : filteredOrders.length === 0 ? (
        <p className="muted">Cari filtrlərə uyğun sifariş yoxdur.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarix</th>
                <th>Filial</th>
                <th>Brend</th>
                <th>Sifariş mətni</th>
                <th className="actions">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td className="mono nowrap">{formatDate(o.created_at)}</td>
                  <td>
                    <span className="branch-tag">{o.branch_name}</span>
                  </td>
                  <td>{o.brand}</td>
                  <td>{o.order_text}</td>
                  <td className="actions">
                    <button
                      className="btn-icon danger"
                      onClick={() => setDeleteOrder(o)}
                      aria-label="Sifarişi sil"
                      title="Sifarişi sil"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrderDeleteModal
        order={deleteOrder}
        onCancel={() => setDeleteOrder(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------
// Inventory tab
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

    if (brandIdx === -1 || productIdx === -1 || qtyIdx === -1) {
      throw new Error(
        'Tələb olunan sütunlar tapılmadı. Brend, Məhsul və Say/Qalıq sütunlarını əlavə edin.'
      );
    }

    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const brand = String(row[brandIdx] || '').trim();
      const product = String(row[productIdx] || '').trim();
      const qtyRaw = row[qtyIdx];
      const qty = Number(qtyRaw);

      if (!brand || !product) continue;
      items.push({
        brand,
        product_name: product,
        qty: Number.isFinite(qty) ? qty : 0,
      });
    }

    if (items.length === 0) throw new Error('Etibarlı ehtiyat sətri tapılmadı.');
    return items;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          Excel və ya CSV fayl yükləyin. Sütunlar: <strong>Brend</strong>,{' '}
          <strong>Məhsul</strong> və <strong>Say/Qalıq</strong>. Bu əməliyyat cari ehtiyat
          məlumatlarının tamamilə əvəz olunması deməkdir.
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
    <div className="tab-content">
      <div className="panel passwords-panel">
        <h3>Filial şifrələri</h3>
        {branches.length === 0 ? (
          <p className="muted">Filial hesabı tapılmadı.</p>
        ) : (
          <div className="password-list">{branches.map(renderRow)}</div>
        )}
      </div>

      {adminProfile && (
        <div className="panel passwords-panel">
          <h3>Admin şifrəsi</h3>
          <div className="password-list">{renderRow(adminProfile)}</div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------
// Admin dashboard shell
// ------------------------------------------------------------------
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const supabase = useSupabase();
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div className="dashboard admin-dashboard">
      <header className="dash-header">
        <div className="dash-brand">
          <img src="/logo.jpeg" alt="BOUTIQUE" className="dash-logo" />
          <div>
            <h1>BOUTIQUE</h1>
            <p>Admin paneli</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={logout}>
          Çıxış
        </button>
      </header>

      <nav className="dash-tabs">
        <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
          Sifarişlər
        </button>
        <button
          className={activeTab === 'inventory' ? 'active' : ''}
          onClick={() => setActiveTab('inventory')}
        >
          Ehtiyat
        </button>
        <button
          className={activeTab === 'branches' ? 'active' : ''}
          onClick={() => setActiveTab('branches')}
        >
          Filiallar
        </button>
      </nav>

      <main className="dash-body">
        {activeTab === 'orders' && <OrdersTab supabase={supabase} />}
        {activeTab === 'inventory' && <InventoryTab supabase={supabase} />}
        {activeTab === 'branches' && <BranchesTab supabase={supabase} />}
      </main>
    </div>
  );
}
