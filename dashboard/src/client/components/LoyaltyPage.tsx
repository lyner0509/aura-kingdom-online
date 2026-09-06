import { useEffect, useMemo, useState } from 'react';
import { api, type LoyaltyData, type LoyaltyItem } from '../lib/api';
import { PlusIcon, SearchIcon, TrashIcon } from './Icons';

type Editable = 'item_id' | 'category' | 'cost_lp' | 'quantity' | 'buy_limit' | 'discount_percent' | 'is_active' | 'sort_order';

export function LoyaltyPage({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [rows, setRows] = useState<LoyaltyItem[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New item form state
  const [newItemId, setNewItemId] = useState<number | ''>('');
  const [newCategory, setNewCategory] = useState('Populer');
  const [newCostLp, setNewCostLp] = useState<number | ''>(100);
  const [newQuantity, setNewQuantity] = useState<number | ''>(1);
  const [newBuyLimit, setNewBuyLimit] = useState<number | ''>(0);
  const [newDiscount, setNewDiscount] = useState<number | ''>(0);
  const [newIsActive, setNewIsActive] = useState<0 | 1>(1);
  const [newSortOrder, setNewSortOrder] = useState<number | ''>(1);

  const dirty = !!data && JSON.stringify(rows) !== JSON.stringify(data.rows);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const result = await api.loyalty();
      setData(result);
      setRows(result.rows);
      setItemNames(result.itemNames);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data Loyalty Shop gagal dimuat.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // Fetch names for all item IDs in rows or new item form
  useEffect(() => {
    const ids = rows.map(r => r.item_id);
    if (typeof newItemId === 'number' && newItemId > 0) ids.push(newItemId);
    if (!ids.length) return;

    const missing = [...new Set(ids.filter(id => !itemNames[String(id)]))];
    if (!missing.length) return;

    const timer = setTimeout(() => {
      void api.itemNames(missing).then(result => {
        setItemNames(current => ({ ...current, ...result.itemNames }));
      }).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [rows, newItemId, itemNames]);

  // Guard beforeunload
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const categories = useMemo(() => {
    const cats = [...new Set(rows.map(r => r.category).filter(Boolean))];
    if (!cats.includes('Populer')) cats.unshift('Populer');
    return cats;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (selectedCategory !== 'all' && row.category !== selectedCategory) return false;
      if (statusFilter === 'active' && row.is_active !== 1) return false;
      if (statusFilter === 'inactive' && row.is_active !== 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const idStr = String(row.item_id);
        const nameStr = (itemNames[idStr] || '').toLowerCase();
        if (!idStr.includes(q) && !nameStr.includes(q) && !row.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, selectedCategory, statusFilter, search, itemNames]);

  const invalid = rows.some(r =>
    !Number.isInteger(r.item_id) || r.item_id < 1 || r.item_id > 2147483647 ||
    !Number.isInteger(r.cost_lp) || r.cost_lp < 0 || r.cost_lp > 2147483647 ||
    !Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 32767 ||
    !Number.isInteger(r.buy_limit) || r.buy_limit < 0 ||
    !Number.isInteger(r.discount_percent) || r.discount_percent < 0 || r.discount_percent > 100 ||
    !r.category.trim()
  );

  function edit(row: LoyaltyItem, field: Editable, value: string | number) {
    setNotice('');
    setRows(current => current.map(item => item === row ? { ...item, [field]: value } : item));
  }

  function remove(row: LoyaltyItem) {
    if (!window.confirm(`Hapus item #${row.item_id} (${itemNames[String(row.item_id)] || 'Item'}) dari Loyalty Shop?`)) return;
    setNotice('');
    setRows(current => current.filter(item => item !== row));
  }

  function addItem() {
    if (typeof newItemId !== 'number' || newItemId <= 0) {
      alert('Masukkan Item ID yang valid (lebih besar dari 0).');
      return;
    }
    const cost = typeof newCostLp === 'number' ? newCostLp : 0;
    const qty = typeof newQuantity === 'number' && newQuantity > 0 ? newQuantity : 1;
    const limit = typeof newBuyLimit === 'number' && newBuyLimit >= 0 ? newBuyLimit : 0;
    const discount = typeof newDiscount === 'number' && newDiscount >= 0 && newDiscount <= 100 ? newDiscount : 0;
    const sort = typeof newSortOrder === 'number' && newSortOrder >= 0 ? newSortOrder : 0;

    const newItem: LoyaltyItem = {
      id: 0,
      item_id: newItemId,
      category: newCategory.trim() || 'Populer',
      cost_lp: cost,
      quantity: qty,
      buy_limit: limit,
      discount_percent: discount,
      is_active: newIsActive,
      sort_order: sort,
    };

    setRows(current => [...current, newItem]);
    setShowAddForm(false);
    setNewItemId('');
    setNewCostLp(100);
    setNewQuantity(1);
    setNewBuyLimit(0);
    setNewDiscount(0);
    setNewSortOrder(1);
    setNotice('Item berhasil ditambahkan ke daftar. Klik "Simpan perubahan" untuk menerapkan.');
  }

  async function save() {
    if (!data || invalid || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.saveLoyalty(data.revision, rows);
      setData({ ...data, rows: structuredClone(rows), revision: result.revision });
      setNotice(result.changed ? 'Perubahan Loyalty Shop berhasil disimpan.' : 'Tidak ada perubahan untuk disimpan.');
      try {
        const latest = await api.loyalty();
        setData(latest);
        setRows(latest.rows);
        setItemNames(latest.itemNames);
      } catch {
        // save already succeeded
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perubahan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  const changedCount = data ? rows.filter((row, index) => JSON.stringify(row) !== JSON.stringify(data.rows[index])).length + Math.abs(rows.length - data.rows.length) : 0;

  return (
    <div className="loyalty-editor">
      <section className="panel">
        <header className="loyalty-header">
          <div>
            <p className="kicker">Pengaturan admin</p>
            <h3>Loyalty Shop</h3>
            <p>Kelola daftar barang, kategori, harga Loyalty Points (LP), diskon, dan limit pembelian di Toko Loyalitas.</p>
          </div>
          <div className="actions">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => setShowAddForm(prev => !prev)}
            >
              <PlusIcon /> {showAddForm ? 'Tutup Form' : 'Tambah Item'}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (!dirty || window.confirm('Buang perubahan yang belum disimpan dan muat ulang?')) {
                  setNotice('');
                  void load();
                }
              }}
            >
              Muat ulang
            </button>
          </div>
        </header>

        {error && <div role="alert" className="notice error">{error}</div>}
        {notice && <div role="status" className="notice">{notice}</div>}
        {data?.readOnly && <div className="notice">Preview lokal. Penyimpanan tersedia di server dengan database aktif.</div>}

        {showAddForm && (
          <div className="loyalty-add-box">
            <h4>Tambah Item Baru ke Toko</h4>
            <div className="loyalty-form-grid">
              <label>
                Item ID *
                <input
                  type="number"
                  min={1}
                  placeholder="Contoh: 40001"
                  value={newItemId}
                  onChange={e => setNewItemId(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="item-name-preview">
                  {typeof newItemId === 'number' && newItemId > 0
                    ? (itemNames[String(newItemId)] || 'Mencari nama item…')
                    : 'Ketik Item ID untuk melihat nama'}
                </span>
              </label>
              <label>
                Kategori *
                <input
                  list="category-suggestions"
                  placeholder="Populer, Kostum, dll."
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                />
                <datalist id="category-suggestions">
                  {categories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </label>
              <label>
                Harga LP *
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={newCostLp}
                  onChange={e => setNewCostLp(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Jumlah (Stack)
                <input
                  type="number"
                  min={1}
                  max={32767}
                  value={newQuantity}
                  onChange={e => setNewQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Limit Beli (0 = bebas)
                <input
                  type="number"
                  min={0}
                  value={newBuyLimit}
                  onChange={e => setNewBuyLimit(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Diskon (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newDiscount}
                  onChange={e => setNewDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Urutan (Sort)
                <input
                  type="number"
                  min={0}
                  value={newSortOrder}
                  onChange={e => setNewSortOrder(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                <span>Status Aktif</span>
                <input
                  type="checkbox"
                  checked={newIsActive === 1}
                  onChange={e => setNewIsActive(e.target.checked ? 1 : 0)}
                />
              </label>
            </div>
            <div className="loyalty-form-actions">
              <button className="primary-button" onClick={addItem}>Tambahkan ke Daftar</button>
              <button onClick={() => setShowAddForm(false)}>Batal</button>
            </div>
          </div>
        )}

        <div className="loyalty-toolbar">
          <div className="search-box">
            <SearchIcon />
            <input
              placeholder="Cari item ID atau nama…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="loyalty-filters">
            <label>
              <span>Kategori:</span>
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="all">Semua Kategori ({rows.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c} ({rows.filter(r => r.category === c).length})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status:</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                <option value="all">Semua Status</option>
                <option value="active">Hanya Aktif ({rows.filter(r => r.is_active === 1).length})</option>
                <option value="inactive">Hanya Non-Aktif ({rows.filter(r => r.is_active === 0).length})</option>
              </select>
            </label>
          </div>
        </div>

        {!data ? (
          <div className="empty">{busy ? 'Memuat Loyalty Shop…' : 'Data belum tersedia.'}</div>
        ) : !rows.length ? (
          <div className="empty">Belum ada item di Loyalty Shop. Klik "Tambah Item" di atas untuk menambahkan.</div>
        ) : !filteredRows.length ? (
          <div className="empty">Tidak ada item yang cocok dengan filter atau pencarian.</div>
        ) : (
          <div className="table-wrap">
            <table className="loyalty-table">
              <thead>
                <tr>
                  <th>Urutan</th>
                  <th>Item ID</th>
                  <th>Nama Item</th>
                  <th>Kategori</th>
                  <th>Harga LP</th>
                  <th>Jumlah</th>
                  <th>Limit Beli</th>
                  <th>Diskon</th>
                  <th>Aktif</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const finalCost = row.discount_percent > 0
                    ? Math.round(row.cost_lp * (100 - row.discount_percent) / 100)
                    : row.cost_lp;
                  return (
                    <tr key={row.id > 0 ? `id-${row.id}` : `tmp-${row.item_id}-${row.category}-${row.sort_order}`}>
                      <td>
                        <input
                          type="number"
                          className="num-small"
                          min={0}
                          value={Number.isNaN(row.sort_order) ? '' : row.sort_order}
                          disabled={busy || data.readOnly}
                          onChange={e => edit(row, 'sort_order', e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="num-id"
                          min={1}
                          max={2147483647}
                          value={Number.isNaN(row.item_id) ? '' : row.item_id}
                          disabled={busy || data.readOnly}
                          onChange={e => edit(row, 'item_id', e.target.value === '' ? NaN : Number(e.target.value))}
                        />
                      </td>
                      <td className="item-name-cell">
                        <strong>{itemNames[String(row.item_id)] || (Number.isInteger(row.item_id) && row.item_id > 0 ? 'Nama tidak ditemukan' : '—')}</strong>
                        <small>#{row.item_id}</small>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="cat-input"
                          value={row.category}
                          disabled={busy || data.readOnly}
                          onChange={e => edit(row, 'category', e.target.value)}
                        />
                      </td>
                      <td>
                        <div className="price-cell">
                          <input
                            type="number"
                            className="num-price"
                            min={0}
                            value={Number.isNaN(row.cost_lp) ? '' : row.cost_lp}
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'cost_lp', e.target.value === '' ? NaN : Number(e.target.value))}
                          />
                          {row.discount_percent > 0 && (
                            <span className="discounted-price" title={`Diskon ${row.discount_percent}%`}>
                              {finalCost} LP
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="num-small"
                          min={1}
                          max={32767}
                          value={Number.isNaN(row.quantity) ? '' : row.quantity}
                          disabled={busy || data.readOnly}
                          onChange={e => edit(row, 'quantity', e.target.value === '' ? NaN : Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="num-small"
                          min={0}
                          value={Number.isNaN(row.buy_limit) ? '' : row.buy_limit}
                          disabled={busy || data.readOnly}
                          title={row.buy_limit === 0 ? '0 = Tanpa batas' : `Maksimal ${row.buy_limit}x`}
                          onChange={e => edit(row, 'buy_limit', e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="num-small"
                          min={0}
                          max={100}
                          value={Number.isNaN(row.discount_percent) ? '' : row.discount_percent}
                          disabled={busy || data.readOnly}
                          onChange={e => edit(row, 'discount_percent', e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                      </td>
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={row.is_active === 1}
                          disabled={busy || data.readOnly}
                          onChange={e => edit(row, 'is_active', e.target.checked ? 1 : 0)}
                        />
                      </td>
                      <td className="center">
                        <button
                          className="icon-button danger"
                          title="Hapus item"
                          disabled={busy || data.readOnly}
                          onClick={() => remove(row)}
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="loyalty-save">
          <div>
            <strong>
              {dirty ? `${changedCount} perubahan belum disimpan` : `${rows.length} item tersimpan`}
            </strong>
            <p>
              {invalid
                ? 'Ada nilai kolom yang tidak valid. Periksa Item ID (>0), Harga (>=0), Jumlah (>=1), dan Diskon (0-100).'
                : 'Perubahan akan disimpan ke database FFAccount secara transaksional.'}
            </p>
          </div>
          <button
            className="primary-button"
            disabled={!dirty || invalid || busy || data?.readOnly}
            onClick={save}
          >
            {busy ? 'Memproses…' : 'Simpan perubahan'}
          </button>
        </div>
      </section>

      {data && (
        <section className="panel loyalty-history">
          <header>
            <h3>Riwayat perubahan Loyalty Shop</h3>
          </header>
          {data.history.length ? (
            <ul>
              {data.history.map(entry => (
                <li key={entry.id}>
                  <strong>{entry.actor}</strong>
                  <time>{new Date(entry.createdAt).toLocaleString('id-ID')}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p>Belum ada riwayat perubahan tercatat melalui dashboard.</p>
          )}
        </section>
      )}
    </div>
  );
}
