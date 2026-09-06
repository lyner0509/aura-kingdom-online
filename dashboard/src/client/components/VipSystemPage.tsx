import { useEffect, useState } from 'react';
import {
  api,
  type AccountVip,
  type VipData,
  type VipSettings,
  type VipTier,
} from '../lib/api';
import { CrownIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon, ZapIcon } from './Icons';

type Tab = 'tiers' | 'members' | 'settings' | 'history';

export function VipSystemPage({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<VipData | null>(null);
  const [settingsForm, setSettingsForm] = useState<VipSettings | null>(null);
  const [tiersForm, setTiersForm] = useState<VipTier[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('tiers');
  const [busy, setBusy] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Member management state
  const [memberSearch, setMemberSearch] = useState('');
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [grantUsername, setGrantUsername] = useState('');
  const [grantTier, setGrantTier] = useState<number>(1);
  const [grantPoints, setGrantPoints] = useState<number>(100);
  const [grantDuration, setGrantDuration] = useState<number | null>(30); // 30 days default

  // Dirty detection for settings and tiers
  const dirty =
    !!data &&
    !!settingsForm &&
    (JSON.stringify(settingsForm) !== JSON.stringify(data.settings) ||
      JSON.stringify(tiersForm) !== JSON.stringify(data.tiers));

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await api.vip();
      setData(res);
      setSettingsForm(res.settings);
      setTiersForm(res.tiers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data VIP system.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateSettingsField<K extends keyof VipSettings>(key: K, value: VipSettings[K]) {
    setSettingsForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateTierField<K extends keyof VipTier>(level: number, key: K, value: VipTier[K]) {
    setTiersForm((prev) =>
      prev.map((t) => (t.level === level ? { ...t, [key]: value } : t))
    );
  }

  function applyTierPreset(mode: 'standard' | 'highrate' | 'casual') {
    if (mode === 'standard') {
      setTiersForm((prev) =>
        prev.map((t) => ({
          ...t,
          exp_bonus_percent: t.level * 5 + 5,
          drop_bonus_percent: t.level * 4 + 2,
          gold_bonus_percent: t.level * 4 + 2,
          move_speed_percent: Math.min(20, t.level * 2),
          daily_loyalty_points: t.level * 75,
        }))
      );
    } else if (mode === 'highrate') {
      setTiersForm((prev) =>
        prev.map((t) => ({
          ...t,
          exp_bonus_percent: t.level * 10 + 10,
          drop_bonus_percent: t.level * 8 + 5,
          gold_bonus_percent: t.level * 8 + 5,
          move_speed_percent: Math.min(30, t.level * 3),
          daily_loyalty_points: t.level * 150,
        }))
      );
    } else if (mode === 'casual') {
      setTiersForm((prev) =>
        prev.map((t) => ({
          ...t,
          exp_bonus_percent: t.level * 3 + 3,
          drop_bonus_percent: t.level * 2 + 2,
          gold_bonus_percent: t.level * 2 + 2,
          move_speed_percent: Math.min(15, t.level * 1.5),
          daily_loyalty_points: t.level * 40,
        }))
      );
    }
  }

  async function handleSaveSettings() {
    if (!data || !settingsForm) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.saveVipSettings({
        revision: data.revision,
        is_enabled: settingsForm.is_enabled,
        points_per_ap: settingsForm.points_per_ap,
        auto_vip_on_spending: settingsForm.auto_vip_on_spending,
        daily_mail_reward_enabled: settingsForm.daily_mail_reward_enabled,
        daily_mail_title: settingsForm.daily_mail_title,
        daily_mail_content: settingsForm.daily_mail_content,
        tiers: tiersForm,
      });
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan VIP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGrantVip(e: React.FormEvent) {
    e.preventDefault();
    if (!grantUsername.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.grantVip({
        username: grantUsername.trim(),
        vip_level: grantTier,
        vip_points: grantPoints,
        duration_days: grantDuration,
      });
      setNotice(res.message);
      setGrantUsername('');
      setShowGrantForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memberikan status VIP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExtend(username: string) {
    if (!window.confirm(`Perpanjang masa aktif VIP akun "${username}" selama +30 hari?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.extendVip(username, 30);
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memperpanjang VIP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(username: string) {
    if (!window.confirm(`Cabut status VIP akun "${username}"?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.revokeVip(username);
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mencabut VIP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDispatchMail() {
    if (!window.confirm('Kirim hadiah harian VIP sekarang ke semua karakter aktif member VIP melalui In-Game Mail (sys_mail_queue)?')) return;
    setSendingMail(true);
    setError('');
    setNotice('');
    try {
      const res = await api.dispatchVipMail();
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim hadiah VIP.');
    } finally {
      setSendingMail(false);
    }
  }

  if (!data || !settingsForm) {
    return (
      <section className="panel">
        <div className="loading-state">
          <CrownIcon />
          <p>Memuat sistem VIP…</p>
        </div>
      </section>
    );
  }

  const filteredMembers = data.members.filter(
    (m) =>
      m.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
      String(m.vip_level).includes(memberSearch)
  );

  return (
    <div className="vipsys-editor">
      <section className="panel">
        <header className="vipsys-header">
          <div>
            <p className="kicker">Privilege & Loyalty Operations</p>
            <h3>Pengaturan VIP System</h3>
            <p>
              Atur hak istimewa tingkatan VIP (EXP, Drop, Gold, Speed), hadiah harian in-game mail, serta berikan atau perpanjang masa aktif keanggotaan VIP untuk pemain.
            </p>
          </div>
          <div className="vipsys-actions">
            <button className="vipsys-btn-secondary" onClick={load} disabled={busy || sendingMail}>
              <RefreshIcon className={busy ? 'spin' : ''} />
              Muat Ulang
            </button>
            <button
              className="vipsys-btn-mail"
              onClick={handleDispatchMail}
              disabled={busy || sendingMail || !settingsForm.is_enabled}
              title="Kirim hadiah harian ke karakter member VIP melalui In-Game Mail"
            >
              <ZapIcon />
              {sendingMail ? 'Mengirim Mail…' : 'Kirim Hadiah Harian VIP'}
            </button>
            <button
              className="vipsys-btn-primary"
              onClick={handleSaveSettings}
              disabled={busy || sendingMail || !dirty}
            >
              Simpan Pengaturan
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="notice error">{error}</div>}

        {/* Top Metric Cards */}
        <div className="vipsys-stats-strip">
          <article className="vipsys-stat-card">
            <span className="card-kicker">Status Sistem</span>
            <div className="card-value">
              <span className={`status-badge ${settingsForm.is_enabled ? 'active' : 'inactive'}`}>
                {settingsForm.is_enabled ? 'Sistem Aktif' : 'Nonaktif'}
              </span>
            </div>
            <span className="card-tag">Global VIP Status</span>
          </article>

          <article className="vipsys-stat-card">
            <span className="card-kicker">Member VIP Aktif</span>
            <div className="card-value">
              {data.stats.activeVipAccounts}
              <span>Akun</span>
            </div>
            <span className="card-tag">Total Terdaftar: {data.stats.totalVipAccounts}</span>
          </article>

          <article className="vipsys-stat-card">
            <span className="card-kicker">Tier Tertinggi</span>
            <div className="card-value">
              VIP {data.stats.maxVipLevel || 0}
            </div>
            <span className="card-tag">Dari 10 Tingkatan</span>
          </article>

          <article className="vipsys-stat-card">
            <span className="card-kicker">Total Poin VIP Beredar</span>
            <div className="card-value">
              {data.stats.totalVipPoints.toLocaleString('id-ID')}
              <span>Poin</span>
            </div>
            <span className="card-tag">Rasio: 1 AP = {settingsForm.points_per_ap} Poin</span>
          </article>
        </div>

        {/* Tabs Bar */}
        <div className="vipsys-tab-bar">
          <button
            type="button"
            className={`vipsys-tab-btn ${activeTab === 'tiers' ? 'active' : ''}`}
            onClick={() => setActiveTab('tiers')}
          >
            Tier & Perks VIP ({tiersForm.length})
          </button>
          <button
            type="button"
            className={`vipsys-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Manajemen Member VIP ({data.members.length})
          </button>
          <button
            type="button"
            className={`vipsys-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Konfigurasi & Mail Harian
          </button>
          <button
            type="button"
            className={`vipsys-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Audit Trail ({data.history.length})
          </button>
        </div>

        {/* Tab 1: Tiers & Perks */}
        {activeTab === 'tiers' && (
          <div className="vipsys-tab-content">
            <div className="vipsys-subhead">
              <div>
                <h4>Daftar Tingkatan Tier VIP (Level 1–10)</h4>
                <p>Atur bonus atribut dan hadiah harian yang diperoleh pemain untuk masing-masing tier VIP.</p>
              </div>
              <div className="vipsys-presets">
                <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Preset:</span>
                <button type="button" onClick={() => applyTierPreset('standard')}>Standar RPG</button>
                <button type="button" onClick={() => applyTierPreset('highrate')}>High Booster</button>
                <button type="button" onClick={() => applyTierPreset('casual')}>Casual</button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="vipsys-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Nama Tier</th>
                    <th>Syarat Poin</th>
                    <th>Bonus EXP</th>
                    <th>Bonus Drop</th>
                    <th>Bonus Gold</th>
                    <th>Speed</th>
                    <th>Loyalty Harian</th>
                    <th>Item ID Hadiah</th>
                    <th>Jml Item</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {tiersForm.map((tier) => (
                    <tr key={tier.level}>
                      <td>
                        <span className={`vip-badge level-${tier.level}`}>
                          VIP {tier.level}
                        </span>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="vipsys-input-cell text"
                          value={tier.name}
                          onChange={(e) => updateTierField(tier.level, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="vipsys-input-cell number"
                          value={tier.required_points}
                          min={0}
                          onChange={(e) => updateTierField(tier.level, 'required_points', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            className="vipsys-input-cell number-sm"
                            value={tier.exp_bonus_percent}
                            min={0}
                            max={200}
                            onChange={(e) => updateTierField(tier.level, 'exp_bonus_percent', Number(e.target.value) || 0)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            className="vipsys-input-cell number-sm"
                            value={tier.drop_bonus_percent}
                            min={0}
                            max={200}
                            onChange={(e) => updateTierField(tier.level, 'drop_bonus_percent', Number(e.target.value) || 0)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            className="vipsys-input-cell number-sm"
                            value={tier.gold_bonus_percent}
                            min={0}
                            max={200}
                            onChange={(e) => updateTierField(tier.level, 'gold_bonus_percent', Number(e.target.value) || 0)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            className="vipsys-input-cell number-sm"
                            value={tier.move_speed_percent}
                            min={0}
                            max={50}
                            onChange={(e) => updateTierField(tier.level, 'move_speed_percent', Number(e.target.value) || 0)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="vipsys-input-cell number"
                          value={tier.daily_loyalty_points}
                          min={0}
                          onChange={(e) => updateTierField(tier.level, 'daily_loyalty_points', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="vipsys-input-cell number"
                          value={tier.daily_item_id}
                          min={0}
                          placeholder="0 = Tanpa item"
                          onChange={(e) => updateTierField(tier.level, 'daily_item_id', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="vipsys-input-cell number-sm"
                          value={tier.daily_item_count}
                          min={1}
                          max={999}
                          onChange={(e) => updateTierField(tier.level, 'daily_item_count', Number(e.target.value) || 1)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="vipsys-input-cell text"
                          value={tier.buff_desc}
                          placeholder="Keterangan buff"
                          onChange={(e) => updateTierField(tier.level, 'buff_desc', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Members */}
        {activeTab === 'members' && (
          <div className="vipsys-tab-content">
            <div className="vipsys-member-toolbar">
              <div className="search-box">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Cari akun atau level VIP…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="vipsys-btn-primary"
                onClick={() => setShowGrantForm(!showGrantForm)}
              >
                <PlusIcon />
                {showGrantForm ? 'Tutup Form' : 'Beri Status VIP Akun'}
              </button>
            </div>

            {/* Grant VIP Form Modal/Card */}
            {showGrantForm && (
              <form className="vipsys-grant-card" onSubmit={handleGrantVip}>
                <h4>Beri / Perbarui Status VIP Akun</h4>
                <div className="grant-form-grid">
                  <div className="grant-field">
                    <label>Username Akun</label>
                    <input
                      type="text"
                      placeholder="Masukkan username pemain"
                      value={grantUsername}
                      onChange={(e) => setGrantUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grant-field">
                    <label>Tingkat VIP</label>
                    <select
                      value={grantTier}
                      onChange={(e) => setGrantTier(Number(e.target.value))}
                    >
                      {tiersForm.map((t) => (
                        <option key={t.level} value={t.level}>
                          {t.name} (Tier {t.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grant-field">
                    <label>Poin VIP Tambahan</label>
                    <input
                      type="number"
                      min={0}
                      value={grantPoints}
                      onChange={(e) => setGrantPoints(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="grant-field">
                    <label>Durasi Masa Aktif</label>
                    <select
                      value={grantDuration === null ? 'perm' : grantDuration}
                      onChange={(e) =>
                        setGrantDuration(e.target.value === 'perm' ? null : Number(e.target.value))
                      }
                    >
                      <option value="7">7 Hari</option>
                      <option value="30">30 Hari (1 Bulan)</option>
                      <option value="90">90 Hari (3 Bulan)</option>
                      <option value="180">180 Hari (6 Bulan)</option>
                      <option value="365">365 Hari (1 Tahun)</option>
                      <option value="perm">Permanen</option>
                    </select>
                  </div>
                </div>
                <div className="grant-actions">
                  <button type="submit" className="vipsys-btn-primary" disabled={busy}>
                    Terapkan VIP ke Akun
                  </button>
                  <button
                    type="button"
                    className="vipsys-btn-secondary"
                    onClick={() => setShowGrantForm(false)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Akun</th>
                    <th>Tingkat VIP</th>
                    <th>Poin Terkumpul</th>
                    <th>Status</th>
                    <th>Masa Berlaku</th>
                    <th>Klaim Terakhir</th>
                    <th>Diperbarui Oleh</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty">
                        {memberSearch ? 'Tidak ada akun VIP yang cocok dengan pencarian.' : 'Belum ada akun yang terdaftar sebagai VIP.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const isExpired = m.expires_at && new Date(m.expires_at).getTime() < Date.now();
                      return (
                        <tr key={m.account_id}>
                          <td>
                            <strong>{m.username}</strong>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11 }}>
                              ID #{m.account_id}
                            </small>
                          </td>
                          <td>
                            <span className={`vip-badge level-${m.vip_level}`}>
                              VIP {m.vip_level}
                            </span>
                          </td>
                          <td>{m.vip_points.toLocaleString('id-ID')} Poin</td>
                          <td>
                            <span
                              className={`status-pill ${
                                m.is_active && !isExpired ? 'online' : 'offline'
                              }`}
                            >
                              <i />
                              {m.is_active && !isExpired ? 'Aktif' : 'Nonaktif / Expired'}
                            </span>
                          </td>
                          <td>
                            {m.expires_at ? (
                              <span style={{ color: isExpired ? 'var(--danger)' : 'var(--parchment)' }}>
                                {new Date(m.expires_at).toLocaleDateString('id-ID')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--jade-bright)' }}>Permanen</span>
                            )}
                          </td>
                          <td>
                            {m.last_daily_claim_at
                              ? new Date(m.last_daily_claim_at).toLocaleDateString('id-ID')
                              : '—'}
                          </td>
                          <td>
                            <small>{m.updated_by}</small>
                          </td>
                          <td>
                            <div className="member-row-actions">
                              <button
                                type="button"
                                className="vipsys-btn-sm"
                                onClick={() => handleExtend(m.username)}
                                disabled={busy}
                                title="Perpanjang masa aktif +30 hari"
                              >
                                +30 Hari
                              </button>
                              <button
                                type="button"
                                className="vipsys-btn-sm danger"
                                onClick={() => handleRevoke(m.username)}
                                disabled={busy}
                                title="Cabut status VIP"
                              >
                                <TrashIcon />
                              </button>
                            </div>
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

        {/* Tab 3: Settings & Mail */}
        {activeTab === 'settings' && (
          <div className="vipsys-tab-content">
            <div className="vipsys-settings-grid">
              <div className="vipsys-box">
                <h4>Aturan & Konfigurasi Global</h4>
                <div className="vipsys-field-list">
                  <label className="vipsys-toggle">
                    <div>
                      <strong>Sistem VIP Diaktifkan</strong>
                      <small>Pemain dapat menerima hak istimewa dan hadiah VIP di server.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.is_enabled}
                      onChange={(e) => updateSettingsField('is_enabled', e.target.checked)}
                    />
                  </label>

                  <label className="vipsys-toggle">
                    <div>
                      <strong>Otomatis Tambah Poin VIP saat Belanja Item Mall</strong>
                      <small>Pemain otomatis memperoleh poin VIP saat membelanjakan AP in-game.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.auto_vip_on_spending}
                      onChange={(e) => updateSettingsField('auto_vip_on_spending', e.target.checked)}
                    />
                  </label>

                  <div className="vipsys-input-field">
                    <label>Rasio Poin VIP per AP Dibelanjakan</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={settingsForm.points_per_ap}
                        onChange={(e) => updateSettingsField('points_per_ap', Math.max(1, Number(e.target.value) || 1))}
                      />
                      <span>Poin / 1 AP</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vipsys-box">
                <h4>Pengaturan Hadiah Mail Harian (In-Game Mail)</h4>
                <div className="vipsys-field-list">
                  <label className="vipsys-toggle">
                    <div>
                      <strong>Fitur Hadiah Harian Aktif</strong>
                      <small>Izinkan sistem mendistribusikan item hadiah harian ke karakter member VIP.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.daily_mail_reward_enabled}
                      onChange={(e) => updateSettingsField('daily_mail_reward_enabled', e.target.checked)}
                    />
                  </label>

                  <div className="vipsys-input-field">
                    <label>Judul Pesan In-Game Mail</label>
                    <input
                      type="text"
                      maxLength={60}
                      value={settingsForm.daily_mail_title}
                      onChange={(e) => updateSettingsField('daily_mail_title', e.target.value)}
                    />
                  </div>

                  <div className="vipsys-input-field">
                    <label>Isi Pesan In-Game Mail</label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={settingsForm.daily_mail_content}
                      onChange={(e) => updateSettingsField('daily_mail_content', e.target.value)}
                    />
                  </div>

                  <div className="mail-dispatch-info">
                    <strong>Status Pengiriman Terakhir:</strong>
                    <p>
                      {settingsForm.last_mail_dispatch_at
                        ? `${new Date(settingsForm.last_mail_dispatch_at).toLocaleString('id-ID')} — ${settingsForm.last_mail_dispatch_status || 'Berhasil'}`
                        : 'Belum pernah dikirim dari dashboard.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: History */}
        {activeTab === 'history' && (
          <div className="vipsys-tab-content">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Operator</th>
                    <th>Aksi</th>
                    <th>Target Akun</th>
                    <th>VIP Level</th>
                    <th>Detail Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        Belum ada riwayat aktivitas sistem VIP.
                      </td>
                    </tr>
                  ) : (
                    data.history.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.created_at).toLocaleString('id-ID')}</td>
                        <td><strong>{h.operator}</strong></td>
                        <td>
                          <span className="status-pill online">
                            {h.action}
                          </span>
                        </td>
                        <td><strong>{h.target_account || '—'}</strong></td>
                        <td>{h.vip_level !== null ? `VIP ${h.vip_level}` : '—'}</td>
                        <td>{h.details || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="vipsys-footer-actions">
          <div className="left-actions">
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Revision: <code>{data.revision}</code> · Terakhir diperbarui oleh <strong>{settingsForm.updated_by}</strong>
            </span>
          </div>
          <div className="right-actions">
            <button
              className="vipsys-btn-primary"
              onClick={handleSaveSettings}
              disabled={busy || sendingMail || !dirty}
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
