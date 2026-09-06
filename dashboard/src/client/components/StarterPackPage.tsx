import { useEffect, useState } from 'react';
import {
  api,
  type StarterPackData,
  type StarterPackItem,
  type StarterPackSettings,
} from '../lib/api';
import { PackageIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon, ZapIcon } from './Icons';

type Tab = 'items' | 'grant' | 'settings' | 'history';

export function StarterPackPage({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<StarterPackData | null>(null);
  const [settingsForm, setSettingsForm] = useState<StarterPackSettings | null>(null);
  const [itemsForm, setItemsForm] = useState<StarterPackItem[]>([]);
  const [itemNamesMap, setItemNamesMap] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [busy, setBusy] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Manual Grant State
  const [grantTargetType, setGrantTargetType] = useState<'character' | 'account'>('character');
  const [grantTargetName, setGrantTargetName] = useState('');
  const [grantOverrideLimit, setGrantOverrideLimit] = useState(false);

  // Batch Dispatch State
  const [batchMinLevel, setBatchMinLevel] = useState<number>(1);

  // Claims Filter State
  const [claimsSearch, setClaimsSearch] = useState('');

  // Dirty state calculation
  const dirty =
    !!data &&
    !!settingsForm &&
    (JSON.stringify(settingsForm) !== JSON.stringify(data.settings) ||
      JSON.stringify(itemsForm) !== JSON.stringify(data.items));

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await api.starterPack();
      setData(res);
      setSettingsForm(res.settings);
      setItemsForm(res.items);

      // Resolve item names from catalog
      const ids = Array.from(new Set(res.items.map((it) => it.item_id))).filter(Boolean);
      if (ids.length) {
        try {
          const namesRes = await api.itemNames(ids);
          const map: Record<number, string> = {};
          for (const [k, v] of Object.entries(namesRes.itemNames)) {
            map[Number(k)] = v;
          }
          setItemNamesMap((prev) => ({ ...prev, ...map }));
        } catch {
          // ignore catalog resolution failures
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data Starter Pack.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Real-time item name resolution when user modifies item_id
  async function resolveItemName(itemId: number) {
    if (!itemId || itemNamesMap[itemId]) return;
    try {
      const res = await api.itemNames([itemId]);
      if (res.itemNames[String(itemId)]) {
        setItemNamesMap((prev) => ({ ...prev, [itemId]: res.itemNames[String(itemId)] }));
      }
    } catch {
      // ignore
    }
  }

  function updateSettingsField<K extends keyof StarterPackSettings>(key: K, value: StarterPackSettings[K]) {
    setSettingsForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateItemField<K extends keyof StarterPackItem>(index: number, key: K, value: StarterPackItem[K]) {
    setItemsForm((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });

    if (key === 'item_id' && typeof value === 'number' && value > 0) {
      void resolveItemName(value);
    }
  }

  function addItemRow() {
    setItemsForm((prev) => [
      ...prev,
      {
        item_id: 40001,
        item_name: 'Healing Potion',
        item_count: 10,
        is_bound: true,
        category: 'potion',
        sort_order: prev.length + 1,
        note: '',
      },
    ]);
    void resolveItemName(40001);
  }

  function removeItemRow(index: number) {
    setItemsForm((prev) => prev.filter((_, i) => i !== index));
  }

  function applyPreset(mode: 'standard' | 'booster' | 'minimal') {
    if (mode === 'standard') {
      setItemsForm([
        { item_id: 40358, item_name: '20-Slot Backpack (Non-tradable)', item_count: 2, is_bound: true, category: 'bag', sort_order: 1, note: 'Tas penyimpanan 20 slot' },
        { item_id: 40079, item_name: '24 Hour XP Crystal (Non-tradable)', item_count: 5, is_bound: true, category: 'buff', sort_order: 2, note: 'Booster XP 24 jam' },
        { item_id: 40239, item_name: 'Instant Teleportation Stone', item_count: 20, is_bound: true, category: 'consumable', sort_order: 3, note: 'Batu teleport instan' },
        { item_id: 40035, item_name: 'Feather of Revival (Non-tradable)', item_count: 10, is_bound: true, category: 'consumable', sort_order: 4, note: 'Bulu kebangkitan' },
        { item_id: 40176, item_name: 'Exclusive Healing Potion (Non-tradable)', item_count: 50, is_bound: true, category: 'potion', sort_order: 5, note: 'Ramuan HP eksklusif' },
        { item_id: 40348, item_name: 'Dragon Point Crystal: 500', item_count: 2, is_bound: true, category: 'currency', sort_order: 6, note: 'Poin naga' },
        { item_id: 40214, item_name: '100 Loyalty Points', item_count: 5, is_bound: true, category: 'currency', sort_order: 7, note: 'Loyalty Points' },
      ]);
      setSettingsForm((prev) => (prev ? { ...prev, bonus_gold: 50000, bonus_loyalty_points: 500 } : prev));
    } else if (mode === 'booster') {
      setItemsForm([
        { item_id: 40358, item_name: '20-Slot Backpack (Non-tradable)', item_count: 4, is_bound: true, category: 'bag', sort_order: 1, note: '4x Tas 20 slot' },
        { item_id: 40997, item_name: 'Super XP Card (Non-tradable)', item_count: 5, is_bound: true, category: 'buff', sort_order: 2, note: 'Super XP Card' },
        { item_id: 40079, item_name: '24 Hour XP Crystal (Non-tradable)', item_count: 10, is_bound: true, category: 'buff', sort_order: 3, note: 'XP Crystal 24 jam' },
        { item_id: 40239, item_name: 'Instant Teleportation Stone', item_count: 50, is_bound: true, category: 'consumable', sort_order: 4, note: 'Batu teleport' },
        { item_id: 40035, item_name: 'Feather of Revival (Non-tradable)', item_count: 25, is_bound: true, category: 'consumable', sort_order: 5, note: 'Bulu kebangkitan' },
        { item_id: 40634, item_name: 'Superior Weapon Fortification Scroll (Non-tradable)', item_count: 10, is_bound: true, category: 'equipment', sort_order: 6, note: 'Scroll tempa senjata' },
        { item_id: 40636, item_name: 'Superior Armor Fortification Scroll (Non-tradable)', item_count: 10, is_bound: true, category: 'equipment', sort_order: 7, note: 'Scroll tempa armor' },
        { item_id: 40445, item_name: '5000 Dragon Points', item_count: 2, is_bound: true, category: 'currency', sort_order: 8, note: '10.000 Dragon Points' },
        { item_id: 40175, item_name: '500 Loyalty Points', item_count: 5, is_bound: true, category: 'currency', sort_order: 9, note: '2.500 Loyalty Points' },
      ]);
      setSettingsForm((prev) => (prev ? { ...prev, bonus_gold: 200000, bonus_loyalty_points: 2500 } : prev));
    } else if (mode === 'minimal') {
      setItemsForm([
        { item_id: 40450, item_name: '10-slot Backpack (Non-tradable)', item_count: 1, is_bound: true, category: 'bag', sort_order: 1, note: 'Tas 10 slot pemula' },
        { item_id: 40001, item_name: 'Healing Potion', item_count: 20, is_bound: true, category: 'potion', sort_order: 2, note: 'Ramuan HP' },
        { item_id: 40035, item_name: 'Feather of Revival (Non-tradable)', item_count: 5, is_bound: true, category: 'consumable', sort_order: 3, note: 'Bulu kebangkitan' },
        { item_id: 40239, item_name: 'Instant Teleportation Stone', item_count: 10, is_bound: true, category: 'consumable', sort_order: 4, note: 'Batu teleport' },
      ]);
      setSettingsForm((prev) => (prev ? { ...prev, bonus_gold: 10000, bonus_loyalty_points: 100 } : prev));
    }
  }

  async function handleSaveSettings() {
    if (!data || !settingsForm) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.saveStarterPackSettings({
        revision: data.revision,
        is_enabled: settingsForm.is_enabled,
        auto_deliver_new_chars: settingsForm.auto_deliver_new_chars,
        mail_sender_name: settingsForm.mail_sender_name,
        mail_title: settingsForm.mail_title,
        mail_content: settingsForm.mail_content,
        bonus_gold: settingsForm.bonus_gold,
        bonus_loyalty_points: settingsForm.bonus_loyalty_points,
        min_character_level: settingsForm.min_character_level,
        max_claims_per_account: settingsForm.max_claims_per_account,
        items: itemsForm,
      });
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan Starter Pack.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGrantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grantTargetName.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.grantStarterPack({
        target_type: grantTargetType,
        target_name: grantTargetName.trim(),
        override_claim_limit: grantOverrideLimit,
      });
      setNotice(res.message);
      setGrantTargetName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirimkan Starter Pack.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchDispatch() {
    if (
      !window.confirm(
        `Kirim Starter Pack ke seluruh karakter aktif (Lv >= ${batchMinLevel}) yang belum pernah menerima? Seluruh item akan masuk ke In-Game Mail masing-masing pemain.`
      )
    ) {
      return;
    }

    setDispatching(true);
    setError('');
    setNotice('');
    try {
      const res = await api.batchDispatchStarterPack(batchMinLevel);
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menjalankan batch dispatch.');
    } finally {
      setDispatching(false);
    }
  }

  async function handleRevokeClaim(claimId: number, charName: string) {
    if (!window.confirm(`Reset riwayat klaim untuk karakter ${charName}? Pemain akan diizinkan menerima Starter Pack kembali.`)) {
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.revokeStarterPackClaim(claimId);
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mereset klaim.');
    } finally {
      setBusy(false);
    }
  }

  if (!data || !settingsForm) {
    return (
      <section className="panel">
        <div className="loading-state">
          <PackageIcon />
          <p>Memuat konfigurasi Starter Pack…</p>
        </div>
      </section>
    );
  }

  const filteredClaims = data.recentClaims.filter(
    (c) =>
      c.character_name.toLowerCase().includes(claimsSearch.toLowerCase()) ||
      c.username.toLowerCase().includes(claimsSearch.toLowerCase())
  );

  return (
    <div className="starterpack-editor">
      <section className="panel">
        <header className="starterpack-header">
          <div>
            <p className="kicker">New Player Welcome Logistics</p>
            <h3>Pengaturan Starter Pack Items</h3>
            <p>
              Kelola paket perlengkapan petualang baru (tas inventory, ramuan, scroll, booster EXP, gold, dan loyalty points) yang didistribusikan langsung ke kotak surat in-game pemain.
            </p>
          </div>
          <div className="starterpack-actions">
            <button className="starterpack-btn-secondary" onClick={load} disabled={busy || dispatching}>
              <RefreshIcon className={busy ? 'spin' : ''} />
              Muat Ulang
            </button>
            <button
              className="starterpack-btn-primary"
              onClick={handleSaveSettings}
              disabled={busy || dispatching || !dirty}
            >
              Simpan Pengaturan
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="notice error">{error}</div>}

        {/* Metric Cards */}
        <div className="starterpack-stats-strip">
          <article className="starterpack-stat-card">
            <span className="card-kicker">Status Sistem</span>
            <div className="card-value">
              <span className={`status-badge ${settingsForm.is_enabled ? 'active' : 'inactive'}`}>
                {settingsForm.is_enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <span className="card-tag">Starter Pack System Status</span>
          </article>

          <article className="starterpack-stat-card">
            <span className="card-kicker">Item dalam Paket</span>
            <div className="card-value">
              {itemsForm.length}
              <span>Item</span>
            </div>
            <span className="card-tag">Dikirim via In-Game Mail</span>
          </article>

          <article className="starterpack-stat-card">
            <span className="card-kicker">Bonus Currency</span>
            <div className="card-value">
              {settingsForm.bonus_gold.toLocaleString('id-ID')}
              <span>Gold</span>
            </div>
            <span className="card-tag">+{settingsForm.bonus_loyalty_points.toLocaleString('id-ID')} Loyalty Points</span>
          </article>

          <article className="starterpack-stat-card">
            <span className="card-kicker">Total Klaim Berhasil</span>
            <div className="card-value">
              {data.stats.totalClaims}
              <span>Karakter</span>
            </div>
            <span className="card-tag">Dari {data.stats.uniqueAccounts} Akun Berbeda</span>
          </article>
        </div>

        {/* Tab Bar */}
        <div className="starterpack-tab-bar">
          <button
            type="button"
            className={`starterpack-tab-btn ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            Item Paket Pemula ({itemsForm.length})
          </button>
          <button
            type="button"
            className={`starterpack-tab-btn ${activeTab === 'grant' ? 'active' : ''}`}
            onClick={() => setActiveTab('grant')}
          >
            Distribusi & Kirim Mail
          </button>
          <button
            type="button"
            className={`starterpack-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Konfigurasi & Surat
          </button>
          <button
            type="button"
            className={`starterpack-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Riwayat Klaim ({data.recentClaims.length})
          </button>
        </div>

        {/* Tab 1: Items List */}
        {activeTab === 'items' && (
          <div className="starterpack-tab-content">
            <div className="starterpack-subhead">
              <div>
                <h4>Daftar Isi Item Starter Pack</h4>
                <p>Setiap item di bawah ini akan dilampirkan otomatis ke surat in-game pemain baru saat klaim diproses.</p>
              </div>
              <div className="starterpack-presets">
                <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Preset:</span>
                <button type="button" onClick={() => applyPreset('standard')}>Standar Petualang</button>
                <button type="button" onClick={() => applyPreset('booster')}>High-Rate Booster</button>
                <button type="button" onClick={() => applyPreset('minimal')}>Minimalis</button>
                <button type="button" className="starterpack-btn-primary" onClick={addItemRow} style={{ marginLeft: 8 }}>
                  <PlusIcon /> Tambah Item
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="starterpack-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th style={{ width: 100 }}>Item ID</th>
                    <th>Nama Item</th>
                    <th style={{ width: 90 }}>Jumlah</th>
                    <th style={{ width: 110 }}>Status Bound</th>
                    <th style={{ width: 120 }}>Kategori</th>
                    <th>Catatan</th>
                    <th style={{ width: 50 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsForm.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty">
                        Belum ada item dalam Starter Pack. Klik "Tambah Item" atau pilih salah satu Preset di atas.
                      </td>
                    </tr>
                  ) : (
                    itemsForm.map((item, index) => {
                      const resolvedName = itemNamesMap[item.item_id] || item.item_name || 'Item #' + item.item_id;
                      return (
                        <tr key={index}>
                          <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                            {index + 1}
                          </td>
                          <td>
                            <input
                              type="number"
                              className="starterpack-input-cell number"
                              value={item.item_id}
                              min={1}
                              onChange={(e) =>
                                updateItemField(index, 'item_id', Math.max(1, Number(e.target.value) || 1))
                              }
                            />
                          </td>
                          <td>
                            <div className="starterpack-item-desc">
                              <strong>{resolvedName}</strong>
                              {itemNamesMap[item.item_id] && (
                                <small style={{ color: 'var(--jade-bright)', fontSize: 10 }}>[Catalog Match]</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="starterpack-input-cell number"
                              value={item.item_count}
                              min={1}
                              max={999}
                              onChange={(e) =>
                                updateItemField(index, 'item_count', Math.max(1, Number(e.target.value) || 1))
                              }
                            />
                          </td>
                          <td>
                            <label className="starterpack-bound-toggle">
                              <input
                                type="checkbox"
                                checked={item.is_bound}
                                onChange={(e) => updateItemField(index, 'is_bound', e.target.checked)}
                              />
                              <span>{item.is_bound ? 'Non-tradable' : 'Tradable'}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              className="starterpack-input-cell"
                              value={item.category}
                              onChange={(e) => updateItemField(index, 'category', e.target.value)}
                            >
                              <option value="bag">Tas / Bag</option>
                              <option value="buff">Buff & EXP</option>
                              <option value="potion">Potion / HP</option>
                              <option value="equipment">Equipment</option>
                              <option value="currency">Currency / LP</option>
                              <option value="consumable">Consumable</option>
                              <option value="general">Lainnya</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="starterpack-input-cell text"
                              value={item.note || ''}
                              placeholder="Keterangan opsional"
                              onChange={(e) => updateItemField(index, 'note', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="starterpack-btn-sm danger"
                              onClick={() => removeItemRow(index)}
                              title="Hapus item dari Starter Pack"
                            >
                              <TrashIcon />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Distribution & Grant */}
        {activeTab === 'grant' && (
          <div className="starterpack-tab-content">
            <div className="starterpack-distribution-grid">
              {/* Manual Grant Box */}
              <div className="starterpack-box">
                <h4>Kirim Starter Pack ke Pemain Tertentu</h4>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--muted)' }}>
                  Kirim paket starter pack secara langsung ke karakter pemain atau akun yang ditentukan.
                </p>

                <form onSubmit={handleGrantSubmit} className="starterpack-grant-form">
                  <div className="grant-field">
                    <label>Tujuan Pengiriman</label>
                    <select
                      value={grantTargetType}
                      onChange={(e) => setGrantTargetType(e.target.value as 'character' | 'account')}
                    >
                      <option value="character">Nama Karakter In-Game</option>
                      <option value="account">Username Akun</option>
                    </select>
                  </div>

                  <div className="grant-field">
                    <label>{grantTargetType === 'character' ? 'Nama Karakter' : 'Username Akun'}</label>
                    <input
                      type="text"
                      placeholder={grantTargetType === 'character' ? 'Contoh: Balee' : 'Contoh: iqbal'}
                      value={grantTargetName}
                      onChange={(e) => setGrantTargetName(e.target.value)}
                      required
                    />
                  </div>

                  <label className="starterpack-checkbox-row">
                    <input
                      type="checkbox"
                      checked={grantOverrideLimit}
                      onChange={(e) => setGrantOverrideLimit(e.target.checked)}
                    />
                    <span>Paksa kirim meskipun pemain telah mencapai batas klaim</span>
                  </label>

                  <div className="grant-preview-box">
                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Isi Paket yang Akan Dikirim:</span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--parchment)', lineHeight: 1.6 }}>
                      <li><strong>{itemsForm.length} jenis item</strong> terlampir di in-game mail</li>
                      <li><strong>{settingsForm.bonus_gold.toLocaleString('id-ID')} Gold</strong> (terlampir di mail pertama)</li>
                      {settingsForm.bonus_loyalty_points > 0 && (
                        <li><strong>{settingsForm.bonus_loyalty_points.toLocaleString('id-ID')} Loyalty Points</strong> (langsung ke akun)</li>
                      )}
                    </ul>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button type="submit" className="starterpack-btn-primary" disabled={busy || !settingsForm.is_enabled}>
                      <ZapIcon /> Kirim Starter Pack Sekarang
                    </button>
                  </div>
                </form>
              </div>

              {/* Batch Dispatch Box */}
              <div className="starterpack-box">
                <h4>Distribusi Massal (Batch Dispatch)</h4>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--muted)' }}>
                  Kirimkan paket Starter Pack secara serentak ke seluruh karakter pemain di server yang belum pernah menerima paket ini.
                </p>

                <div className="batch-options">
                  <div className="grant-field">
                    <label>Filter Level Karakter Minimum</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={batchMinLevel}
                      onChange={(e) => setBatchMinLevel(Math.max(1, Number(e.target.value) || 1))}
                    />
                    <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                      Hanya karakter dengan level sama atau lebih tinggi dari angka ini yang akan menerima mail.
                    </small>
                  </div>

                  <div className="batch-status-box">
                    <strong>Status Eksekusi Terakhir:</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                      {settingsForm.last_dispatch_at
                        ? `${new Date(settingsForm.last_dispatch_at).toLocaleString('id-ID')} — ${settingsForm.last_dispatch_status}`
                        : 'Belum pernah dijalankan dari dashboard.'}
                    </p>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      className="starterpack-btn-mail"
                      onClick={handleBatchDispatch}
                      disabled={busy || dispatching || !settingsForm.is_enabled}
                    >
                      <ZapIcon />
                      {dispatching ? 'Mendistribusikan Mail…' : 'Kirim ke Seluruh Karakter Baru'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Settings & Mail */}
        {activeTab === 'settings' && (
          <div className="starterpack-tab-content">
            <div className="starterpack-settings-grid">
              <div className="starterpack-box">
                <h4>Konfigurasi Aturan Global</h4>
                <div className="starterpack-field-list">
                  <label className="starterpack-toggle">
                    <div>
                      <strong>Sistem Starter Pack Diaktifkan</strong>
                      <small>Pemain dapat menerima paket perlengkapan pemula di server.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.is_enabled}
                      onChange={(e) => updateSettingsField('is_enabled', e.target.checked)}
                    />
                  </label>

                  <label className="starterpack-toggle">
                    <div>
                      <strong>Kirim Otomatis ke Karakter Baru</strong>
                      <small>Sistem secara otomatis mengirimkan Starter Pack saat pemain membuat karakter baru.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.auto_deliver_new_chars}
                      onChange={(e) => updateSettingsField('auto_deliver_new_chars', e.target.checked)}
                    />
                  </label>

                  <div className="starterpack-input-field">
                    <label>Bonus Uang Gold</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min={0}
                        max={100000000}
                        value={settingsForm.bonus_gold}
                        onChange={(e) => updateSettingsField('bonus_gold', Math.max(0, Number(e.target.value) || 0))}
                      />
                      <span>Gold</span>
                    </div>
                  </div>

                  <div className="starterpack-input-field">
                    <label>Bonus Loyalty Points (LP)</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        value={settingsForm.bonus_loyalty_points}
                        onChange={(e) => updateSettingsField('bonus_loyalty_points', Math.max(0, Number(e.target.value) || 0))}
                      />
                      <span>Poin</span>
                    </div>
                  </div>

                  <div className="starterpack-input-field">
                    <label>Syarat Level Minimum Karakter</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={settingsForm.min_character_level}
                      onChange={(e) => updateSettingsField('min_character_level', Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>

                  <div className="starterpack-input-field">
                    <label>Maksimal Klaim per Akun (0 = Tanpa Batas)</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={settingsForm.max_claims_per_account}
                      onChange={(e) => updateSettingsField('max_claims_per_account', Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>

              <div className="starterpack-box">
                <h4>Template Pesan In-Game Mail</h4>
                <div className="starterpack-field-list">
                  <div className="starterpack-input-field">
                    <label>Nama Pengirim Surat</label>
                    <input
                      type="text"
                      maxLength={32}
                      value={settingsForm.mail_sender_name}
                      onChange={(e) => updateSettingsField('mail_sender_name', e.target.value)}
                    />
                  </div>

                  <div className="starterpack-input-field">
                    <label>Judul Surat</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={settingsForm.mail_title}
                      onChange={(e) => updateSettingsField('mail_title', e.target.value)}
                    />
                  </div>

                  <div className="starterpack-input-field">
                    <label>Isi Pesan Surat</label>
                    <textarea
                      rows={4}
                      maxLength={500}
                      value={settingsForm.mail_content}
                      onChange={(e) => updateSettingsField('mail_content', e.target.value)}
                    />
                  </div>

                  <div className="mail-preview-container">
                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Pratinjau Surat Pemain:</span>
                    <div className="mail-preview-box">
                      <strong>Dari: {settingsForm.mail_sender_name || 'Azuria Operations'}</strong>
                      <p className="mail-title-sample">{settingsForm.mail_title || '[Starter Pack] Paket Petualang'}</p>
                      <p className="mail-body-sample">{settingsForm.mail_content}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: History & Claims */}
        {activeTab === 'history' && (
          <div className="starterpack-tab-content">
            <div className="starterpack-member-toolbar">
              <div className="search-box">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Cari nama karakter atau akun penerima…"
                  value={claimsSearch}
                  onChange={(e) => setClaimsSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu Klaim</th>
                    <th>Karakter Penerima</th>
                    <th>Akun</th>
                    <th>Metode</th>
                    <th>Item Dikirim</th>
                    <th>Bonus Gold</th>
                    <th>Operator</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty">
                        {claimsSearch ? 'Tidak ada riwayat klaim yang cocok.' : 'Belum ada karakter yang mengklaim Starter Pack.'}
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim) => (
                      <tr key={claim.id}>
                        <td>{new Date(claim.claimed_at).toLocaleString('id-ID')}</td>
                        <td>
                          <strong>{claim.character_name}</strong>
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                            ID #{claim.character_id}
                          </small>
                        </td>
                        <td>
                          <strong>{claim.username}</strong>
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                            Acc ID #{claim.account_id}
                          </small>
                        </td>
                        <td>
                          <span className="status-pill online">
                            {claim.delivery_method === 'auto_new_char'
                              ? 'Otomatis'
                              : claim.delivery_method === 'batch_dispatch'
                              ? 'Massal'
                              : 'Manual'}
                          </span>
                        </td>
                        <td>{claim.items_delivered_count} Surat Mail</td>
                        <td>{claim.gold_delivered.toLocaleString('id-ID')} Gold</td>
                        <td><small>{claim.operator}</small></td>
                        <td>
                          <button
                            type="button"
                            className="starterpack-btn-sm danger"
                            onClick={() => handleRevokeClaim(claim.id, claim.character_name)}
                            disabled={busy}
                            title="Reset klaim karakter ini"
                          >
                            Reset
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 28 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--parchment)' }}>Audit Trail Aktivitas</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Operator</th>
                      <th>Aksi</th>
                      <th>Target</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty">Belum ada catatan aktivitas operator.</td>
                      </tr>
                    ) : (
                      data.history.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.created_at).toLocaleString('id-ID')}</td>
                          <td><strong>{h.operator}</strong></td>
                          <td><span className="status-pill online">{h.action}</span></td>
                          <td><strong>{h.target || '—'}</strong></td>
                          <td>{h.details || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="starterpack-footer-actions">
          <div className="left-actions">
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Revision: <code>{data.revision}</code> · Terakhir diubah oleh <strong>{settingsForm.updated_by}</strong>
            </span>
          </div>
          <div className="right-actions">
            <button
              className="starterpack-btn-primary"
              onClick={handleSaveSettings}
              disabled={busy || dispatching || !dirty}
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
