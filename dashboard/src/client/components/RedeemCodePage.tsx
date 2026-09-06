import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type RedeemCodeItem,
  type RedeemCodeReward,
  type CreateRedeemCodePayload,
  type BatchGenerateRedeemCodePayload,
} from '../lib/api';
import {
  CopyIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TicketIcon,
  TrashIcon,
} from './Icons';

function randomPin(prefix = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const needed = Math.max(4, 16 - clean.length);
  let res = clean;
  for (let i = 0; i < needed; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res.slice(0, 16);
}

export function RedeemCodePage() {
  const [codes, setCodes] = useState<RedeemCodeItem[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'used' | 'create' | 'disabled'>('all');
  const [copiedPin, setCopiedPin] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchResult, setBatchResult] = useState<string[] | null>(null);

  // Create Form State
  const [singlePin, setSinglePin] = useState('');
  const [singlePassword, setSinglePassword] = useState('');
  const [singleDescription, setSingleDescription] = useState('');
  const [singlePinSet, setSinglePinSet] = useState(-1);
  const [singleState, setSingleState] = useState<'open' | 'create'>('open');
  const [singleRewards, setSingleRewards] = useState<{ item_id: number; item_num: number; rate: number }[]>([
    { item_id: 40358, item_num: 1, rate: 1000 },
  ]);

  // Batch Form State
  const [batchPrefix, setBatchPrefix] = useState('AK');
  const [batchCount, setBatchCount] = useState(10);
  const [batchPassword, setBatchPassword] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [batchPinSet, setBatchPinSet] = useState(1);
  const [batchState, setBatchState] = useState<'open' | 'create'>('open');
  const [batchRewards, setBatchRewards] = useState<{ item_id: number; item_num: number; rate: number }[]>([
    { item_id: 40001, item_num: 5, rate: 1000 },
  ]);

  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.redeemCodes();
      setCodes(res.codes);
      setItemNames(res.itemNames);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data Redeem Code.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const copyToClipboard = useCallback((text: string, pinId?: string) => {
    void navigator.clipboard.writeText(text);
    if (pinId) {
      setCopiedPin(pinId);
      setTimeout(() => setCopiedPin(null), 2000);
    } else {
      setNotice('Teks berhasil disalin ke clipboard!');
      setTimeout(() => setNotice(''), 3000);
    }
  }, []);

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter(c => {
      if (statusFilter !== 'all' && c.state !== statusFilter) return false;
      if (!q) return true;
      if (c.pin.toLowerCase().includes(q)) return true;
      if (c.description.toLowerCase().includes(q)) return true;
      if (c.account_name && c.account_name.toLowerCase().includes(q)) return true;
      return c.rewards.some(r => {
        const name = (r.item_name || itemNames[String(r.item_id)] || '').toLowerCase();
        return String(r.item_id).includes(q) || name.includes(q);
      });
    });
  }, [codes, search, statusFilter, itemNames]);

  const stats = useMemo(() => {
    const total = codes.length;
    const open = codes.filter(c => c.state === 'open').length;
    const used = codes.filter(c => c.state === 'used').length;
    const draft = codes.filter(c => c.state === 'create' || c.state === 'disabled').length;
    return { total, open, used, draft };
  }, [codes]);

  // Lookup missing item names in forms
  const fetchItemName = useCallback(async (itemId: number) => {
    if (!itemId || itemNames[String(itemId)]) return;
    try {
      const res = await api.itemNames([itemId]);
      if (res.itemNames[String(itemId)]) {
        setItemNames(prev => ({ ...prev, ...res.itemNames }));
      }
    } catch {
      // ignore lookup error
    }
  }, [itemNames]);

  async function handleCreateSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!singlePin.trim()) {
      alert('Kode PIN wajib diisi.');
      return;
    }
    if (!singleDescription.trim()) {
      alert('Deskripsi wajib diisi.');
      return;
    }
    if (singleRewards.some(r => !r.item_id || r.item_id <= 0 || r.item_num < 1)) {
      alert('Hadiah item tidak valid. Pastikan Item ID > 0 dan Jumlah >= 1.');
      return;
    }

    setSaving(true);
    try {
      const payload: CreateRedeemCodePayload = {
        pin: singlePin.trim().toUpperCase(),
        password: singlePassword.trim(),
        description: singleDescription.trim(),
        pin_set: Number(singlePinSet),
        state: singleState,
        rewards: singleRewards.map((r, i) => ({
          item_id: Number(r.item_id),
          item_num: Number(r.item_num),
          rate: Number(r.rate) || 1000,
          set: i + 1,
        })),
      };
      await api.createRedeemCode(payload);
      setNotice(`Kode PIN "${payload.pin}" berhasil dibuat!`);
      setShowCreateModal(false);
      setSinglePin('');
      setSingleDescription('');
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuat kode.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!batchDescription.trim()) {
      alert('Deskripsi event wajib diisi.');
      return;
    }
    if (batchCount < 1 || batchCount > 500) {
      alert('Jumlah kode harus antara 1 sampai 500.');
      return;
    }
    if (batchRewards.some(r => !r.item_id || r.item_id <= 0 || r.item_num < 1)) {
      alert('Hadiah item tidak valid. Pastikan Item ID > 0 dan Jumlah >= 1.');
      return;
    }

    setSaving(true);
    try {
      const payload: BatchGenerateRedeemCodePayload = {
        prefix: batchPrefix.trim().toUpperCase(),
        count: Number(batchCount),
        password: batchPassword.trim(),
        description: batchDescription.trim(),
        pin_set: Number(batchPinSet),
        state: batchState,
        rewards: batchRewards.map((r, i) => ({
          item_id: Number(r.item_id),
          item_num: Number(r.item_num),
          rate: Number(r.rate) || 1000,
          set: i + 1,
        })),
      };
      const res = await api.batchGenerateRedeemCodes(payload);
      setBatchResult(res.pins);
      setNotice(`Berhasil membuat ${res.count} kode PIN unik!`);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuat batch kode.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(pin: string, currentState: RedeemCodeItem['state']) {
    const nextState: 'open' | 'disabled' = currentState === 'open' ? 'disabled' : 'open';
    try {
      await api.updateRedeemCodeState(pin, nextState);
      setCodes(prev => prev.map(c => (c.pin === pin ? { ...c, state: nextState } : c)));
      setNotice(`Status PIN "${pin}" diubah menjadi ${nextState === 'open' ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah status.');
    }
  }

  async function handleDelete(pin: string) {
    if (!window.confirm(`Hapus kode PIN "${pin}"? Aksi ini tidak dapat dibatalkan.`)) return;
    try {
      await api.deleteRedeemCode(pin);
      setCodes(prev => prev.filter(c => c.pin !== pin));
      setNotice(`Kode PIN "${pin}" berhasil dihapus.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus kode.');
    }
  }

  return (
    <div className="loyalty-page">
      {/* Metric strip */}
      <section className="metric-strip">
        <article>
          <span>Total Kode</span>
          <strong>{stats.total.toLocaleString('id-ID')}</strong>
          <small>Semua redeem code terdaftar</small>
        </article>
        <article>
          <span>Siap Diklaim</span>
          <strong style={{ color: '#10b981' }}>{stats.open.toLocaleString('id-ID')}</strong>
          <small>Status open / aktif</small>
        </article>
        <article>
          <span>Sudah Diklaim</span>
          <strong style={{ color: '#38bdf8' }}>{stats.used.toLocaleString('id-ID')}</strong>
          <small>Berhasil digunakan pemain</small>
        </article>
        <article>
          <span>Draft / Nonaktif</span>
          <strong>{stats.draft.toLocaleString('id-ID')}</strong>
          <small>Status create atau disabled</small>
        </article>
      </section>

      {/* Main Panel */}
      <section className="panel table-panel">
        <header className="service-header">
          <div>
            <p className="kicker">Exchange PIN System</p>
            <h3>Manajemen Redeem Code</h3>
            <p>Kelola voucher hadiah dan kode serial in-game terintegrasi langsung dengan engine server FFAccount.</p>
          </div>
          <div className="actions redeem-actions">
            <button
              onClick={() => {
                setSinglePin(randomPin('AK'));
                setShowCreateModal(true);
              }}
            >
              <PlusIcon /> Buat Kode
            </button>
            <button
              onClick={() => {
                setBatchResult(null);
                setShowBatchModal(true);
              }}
            >
              <TicketIcon /> Batch Generator
            </button>
            <button onClick={loadData} disabled={loading}>
              <RefreshIcon className={loading ? 'spin' : ''} /> Muat Ulang
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="notice error">{error}</div>}

        <div className="redeem-filters">
          <label className="search-box" style={{ flex: '1 1 260px', height: '36px' }}>
            <SearchIcon />
            <input
              placeholder="Cari kode PIN, deskripsi, item, atau akun…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: '36px' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{
                height: '36px',
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '0 10px',
                fontSize: '0.85rem',
              }}
            >
              <option value="all">Semua Status</option>
              <option value="open">Aktif (Open)</option>
              <option value="used">Digunakan (Used)</option>
              <option value="create">Draft (Create)</option>
              <option value="disabled">Nonaktif (Disabled)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap" style={{ marginTop: '16px' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Kode PIN</th>
                <th>Deskripsi / Event</th>
                <th>Item Hadiah</th>
                <th style={{ width: '110px' }}>Grup Set</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '160px' }}>Klaim Oleh</th>
                <th style={{ width: '140px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map(c => {
                const isCopied = copiedPin === c.pin;
                return (
                  <tr key={c.pin}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <code
                          style={{
                            background: '#1e293b',
                            color: '#38bdf8',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {c.pin}
                        </code>
                        <button
                          title="Salin PIN"
                          onClick={() => copyToClipboard(c.pin, c.pin)}
                          style={{
                            padding: '3px 6px',
                            height: '26px',
                            background: isCopied ? '#059669' : '#334155',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          {isCopied ? 'Tersalin' : <CopyIcon style={{ width: 14, height: 14 }} />}
                        </button>
                      </div>
                      {c.password && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          PW: <code>{c.password}</code>
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{c.description || '—'}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rule #{c.rule_id}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {c.rewards.map((r, idx) => {
                          const name = r.item_name || itemNames[String(r.item_id)] || `Item #${r.item_id}`;
                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.8rem',
                              }}
                            >
                              <span style={{ color: '#fbbf24', fontWeight: 600 }}>#{r.item_id}</span>
                              <span style={{ color: '#e2e8f0' }}>{name}</span>
                              <span style={{ color: '#38bdf8', fontWeight: 600 }}>×{r.item_num}</span>
                              {r.rate < 1000 && (
                                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>({(r.rate / 10).toFixed(1)}%)</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      {c.pin_set > 0 ? (
                        <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Set #{c.pin_set} (1x)</span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Bebas</span>
                      )}
                    </td>
                    <td>
                      {c.state === 'open' && (
                        <span className="status-pill online">
                          <i /> Aktif
                        </span>
                      )}
                      {c.state === 'used' && (
                        <span
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          Digunakan
                        </span>
                      )}
                      {c.state === 'create' && (
                        <span
                          style={{
                            background: 'rgba(234, 179, 8, 0.15)',
                            color: '#eab308',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          Draft
                        </span>
                      )}
                      {c.state === 'disabled' && (
                        <span className="status-pill offline">
                          <i /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td>
                      {c.account_name || c.account_id > 0 ? (
                        <div style={{ fontSize: '0.8rem' }}>
                          <strong>{c.account_name ?? `#${c.account_id}`}</strong>
                          {c.log_time && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {new Date(c.log_time).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#475569' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {c.state !== 'used' && (
                          <button
                            title={c.state === 'open' ? 'Nonaktifkan PIN' : 'Aktifkan PIN'}
                            onClick={() => handleToggleStatus(c.pin, c.state)}
                            style={{
                              padding: '3px 8px',
                              height: '28px',
                              background: '#334155',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#cbd5e1',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {c.state === 'open' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                        {c.state !== 'used' && (
                          <button
                            className="danger"
                            title="Hapus PIN"
                            onClick={() => handleDelete(c.pin)}
                            style={{ padding: '3px 6px', height: '28px' }}
                          >
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !filteredCodes.length && (
            <div className="empty">Tidak ada kode redeem yang cocok dengan filter.</div>
          )}
          {loading && <div className="empty">Memuat data redeem code…</div>}
        </div>
      </section>

      {/* MODAL: Buat Kode Baru */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              color: '#e2e8f0',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#38bdf8' }}>Buat Redeem Code Baru</h3>
            <form onSubmit={handleCreateSingle}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Kode PIN (Maks 16 Karakter) *
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      required
                      maxLength={16}
                      value={singlePin}
                      onChange={e => setSinglePin(e.target.value.toUpperCase())}
                      placeholder="CONTOH: AKLAUNCH2026"
                      style={{
                        flex: 1,
                        height: '36px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '0 10px',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSinglePin(randomPin('AK'))}
                      style={{
                        padding: '0 10px',
                        height: '36px',
                        background: '#334155',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Acak
                    </button>
                  </div>
                </div>
                <div style={{ width: '130px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Password (Opsional)
                  </label>
                  <input
                    maxLength={16}
                    value={singlePassword}
                    onChange={e => setSinglePassword(e.target.value)}
                    placeholder="Kosongkan jika bebas"
                    style={{
                      width: '100%',
                      height: '36px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '0 10px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Deskripsi / Nama Event *
                </label>
                <input
                  required
                  maxLength={50}
                  value={singleDescription}
                  onChange={e => setSingleDescription(e.target.value)}
                  placeholder="Contoh: Paket Selamat Datang Azuria"
                  style={{
                    width: '100%',
                    height: '36px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '0 10px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Grup Set (Pin Set)
                  </label>
                  <input
                    type="number"
                    value={singlePinSet}
                    onChange={e => setSinglePinSet(Number(e.target.value))}
                    placeholder="-1 = Bebas, >0 = 1x per akun"
                    style={{
                      width: '100%',
                      height: '36px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '0 10px',
                    }}
                  />
                  <small style={{ fontSize: '0.7rem', color: '#64748b' }}>-1 jika dapat diklaim tanpa batas akun</small>
                </div>
                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Status Awal
                  </label>
                  <select
                    value={singleState}
                    onChange={e => setSingleState(e.target.value as 'open' | 'create')}
                    style={{
                      width: '100%',
                      height: '36px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '0 10px',
                    }}
                  >
                    <option value="open">Aktif (Open)</option>
                    <option value="create">Draft (Create)</option>
                  </select>
                </div>
              </div>

              {/* Hadiah items */}
              <div style={{ marginBottom: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>Hadiah Item</span>
                  <button
                    type="button"
                    onClick={() => setSingleRewards(prev => [...prev, { item_id: 40001, item_num: 1, rate: 1000 }])}
                    style={{
                      background: '#334155',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#38bdf8',
                      padding: '3px 8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    + Tambah Item
                  </button>
                </div>

                {singleRewards.map((reward, index) => {
                  const resolvedName = itemNames[String(reward.item_id)] || '';
                  return (
                    <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <input
                          type="number"
                          min={1}
                          required
                          value={reward.item_id}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setSingleRewards(prev => prev.map((r, i) => (i === index ? { ...r, item_id: val } : r)));
                            void fetchItemName(val);
                          }}
                          placeholder="Item ID"
                          style={{
                            width: '100%',
                            height: '32px',
                            background: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '0 8px',
                          }}
                        />
                      </div>
                      <div style={{ width: '80px' }}>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          required
                          value={reward.item_num}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setSingleRewards(prev => prev.map((r, i) => (i === index ? { ...r, item_num: val } : r)));
                          }}
                          placeholder="Jumlah"
                          style={{
                            width: '100%',
                            height: '32px',
                            background: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '0 8px',
                          }}
                        />
                      </div>
                      <div style={{ flex: '2 1 180px', fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resolvedName ? (
                          <span style={{ color: '#a7f3d0' }}>{resolvedName}</span>
                        ) : (
                          <span style={{ color: '#64748b' }}>Item #{reward.item_id}</span>
                        )}
                      </div>
                      {singleRewards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSingleRewards(prev => prev.filter((_, i) => i !== index))}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          <TrashIcon style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#334155',
                    color: '#e2e8f0',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {saving ? 'Menyimpan…' : 'Simpan Kode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Batch Generator */}
      {showBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              maxWidth: '580px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              color: '#e2e8f0',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#38bdf8' }}>
              Batch Generator Redeem Codes
            </h3>

            {batchResult ? (
              <div>
                <div style={{ background: '#064e3b', color: '#a7f3d0', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
                  ✓ Berhasil membuat <strong>{batchResult.length}</strong> kode PIN unik!
                </div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Daftar PIN yang Dibuat:
                </label>
                <textarea
                  readOnly
                  rows={8}
                  value={batchResult.join('\n')}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#38bdf8',
                    padding: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(batchResult.join('\n'))}
                    style={{
                      padding: '8px 16px',
                      background: '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Salin Semua Kode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBatchModal(false);
                      setBatchResult(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#334155',
                      color: '#e2e8f0',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBatch}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Prefix Kode (Maks 8 Karakter)
                    </label>
                    <input
                      maxLength={8}
                      value={batchPrefix}
                      onChange={e => setBatchPrefix(e.target.value.toUpperCase())}
                      placeholder="CONTOH: DISC"
                      style={{
                        width: '100%',
                        height: '36px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '0 10px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>
                  <div style={{ width: '130px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Jumlah Kode (1-500) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={batchCount}
                      onChange={e => setBatchCount(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '36px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '0 10px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Deskripsi / Nama Event *
                  </label>
                  <input
                    required
                    maxLength={50}
                    value={batchDescription}
                    onChange={e => setBatchDescription(e.target.value)}
                    placeholder="Contoh: Discord Giveaway Batch 1"
                    style={{
                      width: '100%',
                      height: '36px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '0 10px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Grup Set (Pin Set)
                    </label>
                    <input
                      type="number"
                      value={batchPinSet}
                      onChange={e => setBatchPinSet(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '36px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '0 10px',
                      }}
                    />
                    <small style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Set angka &gt; 0 agar tiap pemain hanya bisa klaim 1 kode dari batch ini
                    </small>
                  </div>
                  <div style={{ width: '150px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      Status Awal
                    </label>
                    <select
                      value={batchState}
                      onChange={e => setBatchState(e.target.value as 'open' | 'create')}
                      style={{
                        width: '100%',
                        height: '36px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '0 10px',
                      }}
                    >
                      <option value="open">Aktif (Open)</option>
                      <option value="create">Draft (Create)</option>
                    </select>
                  </div>
                </div>

                {/* Hadiah Items */}
                <div style={{ marginBottom: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>Hadiah Item untuk Semua Kode</span>
                    <button
                      type="button"
                      onClick={() => setBatchRewards(prev => [...prev, { item_id: 40001, item_num: 1, rate: 1000 }])}
                      style={{
                        background: '#334155',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#38bdf8',
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Tambah Item
                    </button>
                  </div>

                  {batchRewards.map((reward, index) => {
                    const resolvedName = itemNames[String(reward.item_id)] || '';
                    return (
                      <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ flex: '1 1 120px' }}>
                          <input
                            type="number"
                            min={1}
                            required
                            value={reward.item_id}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setBatchRewards(prev => prev.map((r, i) => (i === index ? { ...r, item_id: val } : r)));
                              void fetchItemName(val);
                            }}
                            placeholder="Item ID"
                            style={{
                              width: '100%',
                              height: '32px',
                              background: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '4px',
                              color: '#fff',
                              padding: '0 8px',
                            }}
                          />
                        </div>
                        <div style={{ width: '80px' }}>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            required
                            value={reward.item_num}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setBatchRewards(prev => prev.map((r, i) => (i === index ? { ...r, item_num: val } : r)));
                            }}
                            placeholder="Jumlah"
                            style={{
                              width: '100%',
                              height: '32px',
                              background: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '4px',
                              color: '#fff',
                              padding: '0 8px',
                            }}
                          />
                        </div>
                        <div style={{ flex: '2 1 180px', fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {resolvedName ? (
                            <span style={{ color: '#a7f3d0' }}>{resolvedName}</span>
                          ) : (
                            <span style={{ color: '#64748b' }}>Item #{reward.item_id}</span>
                          )}
                        </div>
                        {batchRewards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBatchRewards(prev => prev.filter((_, i) => i !== index))}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: '#334155',
                      color: '#e2e8f0',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {saving ? 'Menghasilkan Kode…' : `Generate ${batchCount} Kode`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
