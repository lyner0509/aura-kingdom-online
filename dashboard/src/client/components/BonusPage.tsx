import { useEffect, useMemo, useState } from 'react';
import { api, type BonusData, type BonusItem } from '../lib/api';
import { PlusIcon, RefreshIcon, SearchIcon, TrashIcon } from './Icons';

type Editable = 'item_id' | 'item_num' | 'point' | 'special_price' | 'num_limit' | 'sell';

export const BONUS_CATEGORY_LABELS: Record<number, string> = {
  2: 'Kostum & Fashion',
  3: 'Konsumsi & Tempa',
  4: 'Batu Permata & Gem',
  5: 'Tas & Penyimpanan',
  8: 'Aksesori & Senjata',
  47: 'Event Khusus',
  49: 'Mount & Tunggangan',
  99: 'Paket Promo',
};

export function BonusPage({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [data, setData] = useState<BonusData | null>(null);
  const [rows, setRows] = useState<BonusItem[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('2');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 50;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New item form state
  const [newGroupId, setNewGroupId] = useState<number>(2);
  const [newItemId, setNewItemId] = useState<number | ''>('');
  const [newPoint, setNewPoint] = useState<number | ''>(100);
  const [newSpecialPrice, setNewSpecialPrice] = useState<number | ''>(0);
  const [newItemNum, setNewItemNum] = useState<number | ''>(1);
  const [newNumLimit, setNewNumLimit] = useState<number | ''>(0);
  const [newSell, setNewSell] = useState<0 | 1>(1);

  const dirty = !!data && JSON.stringify(rows) !== JSON.stringify(data.rows);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const result = await api.bonus();
      setData(result);
      setRows(result.rows);
      setItemNames(result.itemNames);
      const availableGroups = [...new Set(result.rows.map(r => String(r.item_group)))];
      if (availableGroups.length && !availableGroups.includes(selectedGroup) && selectedGroup !== 'all') {
        setSelectedGroup(availableGroups.includes('2') ? '2' : availableGroups[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data Bonus Mall gagal dimuat.');
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
      void api.itemNames(missing.slice(0, 100)).then(result => {
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

  const groups = useMemo(() => {
    const gSet = new Set(rows.map(r => r.item_group));
    if (!gSet.has(2)) gSet.add(2);
    return [...gSet].sort((a, b) => a - b);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (selectedGroup !== 'all' && String(row.item_group) !== selectedGroup) return false;
      if (statusFilter === 'active' && row.sell !== 1) return false;
      if (statusFilter === 'inactive' && row.sell !== 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const idStr = String(row.item_id);
        const nameStr = (itemNames[idStr] || '').toLowerCase();
        if (!idStr.includes(q) && !nameStr.includes(q)) return false;
      }
      return true;
    });
  }, [rows, selectedGroup, statusFilter, search, itemNames]);

  // Reset page when filter changes
  useEffect(() => {
    setPageNumber(1);
  }, [selectedGroup, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const displayedRows = useMemo(() => {
    const start = (pageNumber - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageNumber, pageSize]);

  const invalid = rows.some(r =>
    !Number.isInteger(r.item_id) || r.item_id < 1 || r.item_id > 2147483647 ||
    !Number.isInteger(r.point) || r.point < 0 || r.point > 2147483647 ||
    !Number.isInteger(r.item_num) || r.item_num < 1 || r.item_num > 32767 ||
    !Number.isInteger(r.special_price) || r.special_price < 0 ||
    !Number.isInteger(r.num_limit) || r.num_limit < 0
  );

  function edit(row: BonusItem, field: Editable, value: number) {
    setNotice('');
    setRows(current => current.map(item => item === row ? { ...item, [field]: value } : item));
  }

  function remove(row: BonusItem) {
    const name = itemNames[String(row.item_id)] || `Item #${row.item_id}`;
    if (!window.confirm(`Hapus ${name} dari slot ${row.item_group}/${row.detail_type}/${row.item_index}?`)) return;
    setNotice('');
    setRows(current => current.filter(item => item !== row));
  }

  function addItem() {
    if (typeof newItemId !== 'number' || newItemId <= 0) {
      alert('Masukkan Item ID yang valid (angka lebih besar dari 0).');
      return;
    }
    const pointVal = typeof newPoint === 'number' && newPoint >= 0 ? newPoint : 0;
    const specialVal = typeof newSpecialPrice === 'number' && newSpecialPrice >= 0 ? newSpecialPrice : 0;
    const numVal = typeof newItemNum === 'number' && newItemNum > 0 ? newItemNum : 1;
    const limitVal = typeof newNumLimit === 'number' && newNumLimit >= 0 ? newNumLimit : 0;

    // Find next available item_index for this item_group and detail_type=1
    const existingIndices = rows
      .filter(r => r.item_group === newGroupId && r.detail_type === 1)
      .map(r => r.item_index);
    const nextIndex = existingIndices.length ? Math.max(...existingIndices) + 1 : 1;

    const newItem: BonusItem = {
      item_group: newGroupId,
      detail_type: 1,
      item_index: nextIndex,
      item_id: newItemId,
      item_num: numVal,
      point: pointVal,
      special_price: specialVal,
      num_limit: limitVal,
      sell: newSell,
    };

    setRows(current => [...current, newItem]);
    setSelectedGroup(String(newGroupId));
    setShowAddForm(false);
    setNewItemId('');
    setNewPoint(100);
    setNewSpecialPrice(0);
    setNewItemNum(1);
    setNewNumLimit(0);
    setNewSell(1);
    setNotice(`Item #${newItemId} berhasil ditambahkan ke daftar grup ${newGroupId}. Klik "Simpan Perubahan" untuk menyimpan ke game.`);
  }

  async function save() {
    if (!data || invalid || busy || data.readOnly) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.saveBonus(data.revision, rows);
      setData({ ...data, rows: structuredClone(rows), revision: result.revision });
      setNotice(result.changed
        ? 'Perubahan Bonus Mall berhasil disimpan ke database game.'
        : 'Tidak ada perubahan untuk disimpan.');
      try {
        const latest = await api.bonus();
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
    <div className="loyalty-editor bonus-editor">
      <section className="panel">
        <header className="loyalty-header bonus-header">
          <div>
            <p className="kicker">Pengaturan admin</p>
            <h3>Bonus Mall</h3>
            <p>Kelola katalog barang, kategori tab, harga Bonus Points (BP), diskon promo, dan batas pembelian.</p>
          </div>
          <div className="loyalty-actions bonus-actions">
            <button
              type="button"
              className="loyalty-btn-primary"
              disabled={busy}
              onClick={() => setShowAddForm(prev => !prev)}
            >
              <PlusIcon /> {showAddForm ? 'Tutup Form' : 'Tambah Item'}
            </button>
            <button
              type="button"
              className="loyalty-btn-secondary"
              disabled={busy}
              onClick={() => {
                if (!dirty || window.confirm('Buang perubahan yang belum disimpan dan muat ulang?')) {
                  setNotice('');
                  void load();
                }
              }}
            >
              <RefreshIcon className={busy ? 'spin' : ''} /> Muat ulang
            </button>
          </div>
        </header>

        {error && <div role="alert" className="notice error">{error}</div>}
        {notice && <div role="status" className="notice">{notice}</div>}
        {data?.readOnly && <div className="notice">Preview lokal. Perubahan akan disimpan ke database FFAccount saat berada di server live.</div>}

        {showAddForm && (
          <div className="loyalty-add-box">
            <h4>Tambah Item Baru ke Bonus Mall</h4>
            <div className="loyalty-form-grid">
              <label>
                Kategori Tab *
                <select
                  value={newGroupId}
                  onChange={e => setNewGroupId(Number(e.target.value))}
                >
                  {groups.map(g => (
                    <option key={g} value={g}>
                      {BONUS_CATEGORY_LABELS[g] || `Grup ${g}`} (Grup {g})
                    </option>
                  ))}
                </select>
              </label>
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
                Harga BP *
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={newPoint}
                  onChange={e => setNewPoint(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Harga Diskon BP (0 = normal)
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={newSpecialPrice}
                  onChange={e => setNewSpecialPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Jumlah (Stack)
                <input
                  type="number"
                  min={1}
                  max={32767}
                  value={newItemNum}
                  onChange={e => setNewItemNum(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label>
                Batas Beli (0 = bebas)
                <input
                  type="number"
                  min={0}
                  value={newNumLimit}
                  onChange={e => setNewNumLimit(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                <span>Aktif Dijual</span>
                <input
                  type="checkbox"
                  checked={newSell === 1}
                  onChange={e => setNewSell(e.target.checked ? 1 : 0)}
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
            {search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearch('')}
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
              >
                ×
              </button>
            )}
          </div>

          <div className="loyalty-filters">
            <label>
              <span>Kategori:</span>
              <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                <option value="all">Semua Kategori ({rows.length})</option>
                {groups.map(g => (
                  <option key={g} value={String(g)}>
                    {BONUS_CATEGORY_LABELS[g] || `Grup ${g}`} ({rows.filter(r => r.item_group === g).length})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status:</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                <option value="all">Semua Status</option>
                <option value="active">Hanya Aktif ({rows.filter(r => r.sell === 1).length})</option>
                <option value="inactive">Hanya Non-Aktif ({rows.filter(r => r.sell === 0).length})</option>
              </select>
            </label>
          </div>
        </div>

        {!data ? (
          <div className="empty">{busy ? 'Memuat Bonus Mall…' : 'Data belum tersedia. Klik muat ulang.'}</div>
        ) : !rows.length ? (
          <div className="empty">Belum ada item di Bonus Mall. Klik "Tambah Item" untuk menambahkan.</div>
        ) : !filteredRows.length ? (
          <div className="empty">Tidak ada item yang cocok dengan filter atau pencarian saat ini.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="loyalty-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Slot</th>
                    <th style={{ width: '130px' }}>Kategori</th>
                    <th style={{ width: '100px' }}>Item ID</th>
                    <th>Nama Item</th>
                    <th style={{ width: '80px' }} className="center">Stack</th>
                    <th style={{ width: '110px' }}>Harga BP</th>
                    <th style={{ width: '110px' }}>Diskon BP</th>
                    <th style={{ width: '90px' }} className="center">Batas</th>
                    <th style={{ width: '70px' }} className="center">Dijual</th>
                    <th style={{ width: '60px' }} className="center">Hapus</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => {
                    const idStr = String(row.item_id);
                    const itemName = itemNames[idStr];
                    const slotKey = `${row.item_group}-${row.detail_type}-${row.item_index}`;

                    return (
                      <tr key={slotKey} className={row.sell === 0 ? 'row-inactive' : ''}>
                        <td>
                          <span className="slot-badge">#{row.item_index}</span>
                        </td>
                        <td>
                          <span className="category-badge">
                            {BONUS_CATEGORY_LABELS[row.item_group] || `Grup ${row.item_group}`}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className="num-id"
                            value={row.item_id}
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'item_id', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="item-name-cell">
                          <strong>{itemName || 'Nama item tidak ditemukan'}</strong>
                          <small>Grup {row.item_group} · ID #{row.item_id}</small>
                        </td>
                        <td className="center">
                          <input
                            type="number"
                            min={1}
                            max={32767}
                            className="num-small"
                            value={row.item_num}
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'item_num', Number(e.target.value) || 1)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="num-price"
                            value={row.point}
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'point', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className={`num-price ${row.special_price > 0 ? 'discount' : ''}`}
                            value={row.special_price}
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'special_price', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="center">
                          <input
                            type="number"
                            min={0}
                            className="num-small"
                            value={row.num_limit}
                            title="0 = tanpa batas beli"
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'num_limit', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="center">
                          <input
                            type="checkbox"
                            checked={row.sell === 1}
                            disabled={busy || data.readOnly}
                            onChange={e => edit(row, 'sell', e.target.checked ? 1 : 0)}
                          />
                        </td>
                        <td className="center">
                          <button
                            type="button"
                            className="icon-button danger"
                            disabled={busy || data.readOnly}
                            onClick={() => remove(row)}
                            title="Hapus item ini"
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

            {totalPages > 1 && (
              <div className="loyalty-pagination">
                <span>
                  Menampilkan {(pageNumber - 1) * pageSize + 1}–
                  {Math.min(pageNumber * pageSize, filteredRows.length)} dari {filteredRows.length} item
                  {filteredRows.length !== rows.length ? ` (total ${rows.length})` : ''}
                </span>
                <div className="pagination-buttons">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                  >
                    Sebelumnya
                  </button>
                  <span>Halaman {pageNumber} dari {totalPages}</span>
                  <button
                    disabled={pageNumber >= totalPages}
                    onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}

            <div className="loyalty-save">
              <div>
                <strong>
                  {dirty ? `${changedCount} perubahan belum disimpan` : 'Semua item tersimpan'}
                </strong>
                <p>
                  {invalid
                    ? 'Periksa kolom input. Harga tidak boleh negatif dan Item ID harus lebih besar dari 0.'
                    : 'Perubahan akan disimpan langsung ke tabel public.itemmall (money_unit = 3) dan dicatat di riwayat audit.'}
                </p>
              </div>
              <button
                className="primary-button"
                disabled={!dirty || invalid || busy || data.readOnly}
                onClick={save}
              >
                {busy ? 'Menyimpan…' : 'Simpan Perubahan Bonus Mall'}
              </button>
            </div>
          </>
        )}
      </section>

      {data && (
        <section className="panel loyalty-history">
          <header>
            <h3>Riwayat Perubahan Bonus Mall</h3>
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
            <p>Belum ada riwayat perubahan yang disimpan melalui dashboard.</p>
          )}
        </section>
      )}
    </div>
  );
}
