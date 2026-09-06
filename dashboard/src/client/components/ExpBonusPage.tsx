import { useEffect, useState } from 'react';
import { api, type EffectiveRates, type ExpBonusData, type ExpBonusSettings } from '../lib/api';
import { RefreshIcon, SparklesIcon, ZapIcon } from './Icons';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Berakhir';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  return `${m}m ${s}d`;
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExpBonusPage({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<ExpBonusData | null>(null);
  const [form, setForm] = useState<ExpBonusSettings | null>(null);
  const [effective, setEffective] = useState<EffectiveRates | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Dirty detection
  const dirty = !!data && !!form && JSON.stringify(form) !== JSON.stringify(data.settings);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const result = await api.expBonus();
      setData(result);
      setForm(result.settings);
      setEffective(result.effectiveRates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pengaturan EXP bonus.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Countdown timer for active event
  useEffect(() => {
    if (!effective?.timeRemainingSeconds || effective.timeRemainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setEffective((prev) => {
        if (!prev || prev.timeRemainingSeconds === null) return prev;
        const next = prev.timeRemainingSeconds - 1;
        return { ...prev, timeRemainingSeconds: next > 0 ? next : 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [effective?.isEventEffective, effective?.timeRemainingSeconds]);

  function updateField<K extends keyof ExpBonusSettings>(key: K, value: ExpBonusSettings[K]) {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  }

  function applyBasePreset(rate: number) {
    if (!form) return;
    setForm({
      ...form,
      exp_rate: rate,
      drop_rate: rate > 200 ? Math.min(rate, 250) : rate,
      gold_rate: rate > 200 ? Math.min(rate, 200) : rate,
      quest_exp_rate: rate,
      np_rate: rate > 150 ? 150 : rate,
    });
  }

  function applyEventPreset(rate: number) {
    if (!form) return;
    setForm({
      ...form,
      event_exp_rate: rate,
      event_drop_rate: Math.min(rate, 200),
      event_gold_rate: Math.min(rate, 200),
      event_quest_exp_rate: Math.min(rate, 200),
      event_np_rate: Math.min(rate, 150),
    });
  }

  async function handleSave(applyImmediately = false) {
    if (!data || !form) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.saveExpBonus({
        revision: data.revision,
        exp_rate: form.exp_rate,
        quest_exp_rate: form.quest_exp_rate,
        drop_rate: form.drop_rate,
        gold_rate: form.gold_rate,
        np_rate: form.np_rate,
        is_event_active: form.is_event_active,
        event_name: form.event_name,
        event_start: form.event_start,
        event_end: form.event_end,
        event_exp_rate: form.event_exp_rate,
        event_quest_exp_rate: form.event_quest_exp_rate,
        event_drop_rate: form.event_drop_rate,
        event_gold_rate: form.event_gold_rate,
        event_np_rate: form.event_np_rate,
        broadcast_event: form.broadcast_event,
        apply_immediately: applyImmediately,
      });

      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyNow() {
    if (!window.confirm('Terapkan rate aktif saat ini langsung ke ZoneServer? Pemain in-game akan langsung merasakan perubahannya.')) return;
    setApplying(true);
    setError('');
    setNotice('');
    try {
      const res = await api.applyExpBonusNow();
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menerapkan ke ZoneServer.');
    } finally {
      setApplying(false);
    }
  }

  function handleReset() {
    if (!window.confirm('Kembalikan seluruh rate ke standar normal 100% (1x)?')) return;
    applyBasePreset(100);
    if (form) {
      setForm({
        ...form,
        exp_rate: 100,
        quest_exp_rate: 100,
        drop_rate: 100,
        gold_rate: 100,
        np_rate: 100,
        is_event_active: false,
      });
    }
  }

  if (!form || !data) {
    return (
      <section className="panel">
        <div className="loading-state">
          <SparklesIcon />
          <p>Memuat pengaturan EXP Bonus…</p>
        </div>
      </section>
    );
  }

  const currentRates = effective ?? {
    exp_rate: form.exp_rate,
    quest_exp_rate: form.quest_exp_rate,
    drop_rate: form.drop_rate,
    gold_rate: form.gold_rate,
    np_rate: form.np_rate,
    isEventEffective: false,
    eventName: null,
    timeRemainingSeconds: null,
  };

  return (
    <div className="expbonus-editor">
      <section className="panel">
        <header className="expbonus-header">
          <div>
            <p className="kicker">Server Rate Operations</p>
            <h3>Pengaturan EXP & Rate Server</h3>
            <p>
              Atur pengganda Monster EXP, Item Drop, Gold, dan Loyalty Points. Perubahan dapat langsung diterapkan ke ZoneServer (CGI port 20060) secara real-time tanpa perlu restart server.
            </p>
          </div>
          <div className="expbonus-actions">
            <button className="expbonus-btn-secondary" onClick={load} disabled={busy || applying}>
              <RefreshIcon className={busy ? 'spin' : ''} />
              Muat Ulang
            </button>
            <button className="expbonus-btn-apply" onClick={handleApplyNow} disabled={busy || applying}>
              <ZapIcon />
              {applying ? 'Menerapkan…' : 'Terapkan ke Live Server'}
            </button>
            <button className="expbonus-btn-primary" onClick={() => handleSave(false)} disabled={busy || applying || !dirty}>
              {busy ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="notice error">{error}</div>}

        {/* Live Rates Status Cards */}
        <div className="expbonus-live-strip">
          <article className={`expbonus-live-card ${currentRates.exp_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Monster EXP</span>
            <div className="card-value">
              {(currentRates.exp_rate / 100).toFixed(currentRates.exp_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.exp_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.exp_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`expbonus-live-card ${currentRates.drop_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Item Drop Rate</span>
            <div className="card-value">
              {(currentRates.drop_rate / 100).toFixed(currentRates.drop_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.drop_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.drop_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`expbonus-live-card ${currentRates.gold_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Gold Gain</span>
            <div className="card-value">
              {(currentRates.gold_rate / 100).toFixed(currentRates.gold_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.gold_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.gold_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`expbonus-live-card ${currentRates.np_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Loyalty (NP)</span>
            <div className="card-value">
              {(currentRates.np_rate / 100).toFixed(currentRates.np_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.np_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.np_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`expbonus-live-card ${currentRates.quest_exp_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Quest EXP</span>
            <div className="card-value">
              {(currentRates.quest_exp_rate / 100).toFixed(currentRates.quest_exp_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.quest_exp_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.quest_exp_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>
        </div>

        {/* Server Status Banner */}
        <div className={`expbonus-status-banner ${currentRates.isEventEffective ? 'event-active' : ''}`}>
          <div className="status-left">
            <div className="status-icon">
              {currentRates.isEventEffective ? <SparklesIcon /> : <ZapIcon />}
            </div>
            <div className="status-info">
              <strong>
                {currentRates.isEventEffective
                  ? `EVENT AKTIF: ${currentRates.eventName || 'Event Boost Server'}`
                  : 'Mode Server: Rate Dasar (Standar)'}
              </strong>
              <small>
                {currentRates.isEventEffective && currentRates.timeRemainingSeconds !== null
                  ? `Sisa durasi event: ${formatDuration(currentRates.timeRemainingSeconds)}`
                  : form.last_applied_at
                  ? `Sinkronisasi terakhir: ${new Date(form.last_applied_at).toLocaleString('id-ID')} (${form.last_applied_status || 'Berhasil'})`
                  : 'Belum pernah diterapkan ke server melalui panel ini.'}
              </small>
            </div>
          </div>
          {currentRates.isEventEffective && (
            <span className="status-pill online">
              <i />
              Event Live
            </span>
          )}
        </div>

        {/* Configuration Forms */}
        <div className="expbonus-form-grid">
          {/* 1. Base Rates Card */}
          <div className="expbonus-section-box">
            <h4>
              Rate Dasar Server (Base Rates)
              <span className="quiet">Permanen</span>
            </h4>
            <div className="expbonus-presets">
              <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Preset:</span>
              <button type="button" className={form.exp_rate === 100 ? 'active' : ''} onClick={() => applyBasePreset(100)}>1x (100%)</button>
              <button type="button" className={form.exp_rate === 150 ? 'active' : ''} onClick={() => applyBasePreset(150)}>1.5x (150%)</button>
              <button type="button" className={form.exp_rate === 200 ? 'active' : ''} onClick={() => applyBasePreset(200)}>2x (200%)</button>
              <button type="button" className={form.exp_rate === 250 ? 'active' : ''} onClick={() => applyBasePreset(250)}>2.5x (250%)</button>
              <button type="button" className={form.exp_rate === 300 ? 'active' : ''} onClick={() => applyBasePreset(300)}>3x (300%)</button>
              <button type="button" className={form.exp_rate === 500 ? 'active' : ''} onClick={() => applyBasePreset(500)}>5x (500%)</button>
            </div>

            {/* Monster EXP */}
            <div className="expbonus-field">
              <label>
                <span>Monster EXP Multiplier</span>
                <span>{(form.exp_rate / 100).toFixed(form.exp_rate % 100 === 0 ? 0 : 1)}x ({form.exp_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.exp_rate}
                  onChange={(e) => updateField('exp_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.exp_rate}
                  onChange={(e) => updateField('exp_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Item Drop Rate */}
            <div className="expbonus-field">
              <label>
                <span>Item Drop Rate Multiplier</span>
                <span>{(form.drop_rate / 100).toFixed(form.drop_rate % 100 === 0 ? 0 : 1)}x ({form.drop_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.drop_rate}
                  onChange={(e) => updateField('drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.drop_rate}
                  onChange={(e) => updateField('drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Gold Gain Rate */}
            <div className="expbonus-field">
              <label>
                <span>Gold Gain Multiplier</span>
                <span>{(form.gold_rate / 100).toFixed(form.gold_rate % 100 === 0 ? 0 : 1)}x ({form.gold_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.gold_rate}
                  onChange={(e) => updateField('gold_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.gold_rate}
                  onChange={(e) => updateField('gold_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Quest EXP */}
            <div className="expbonus-field">
              <label>
                <span>Quest EXP Multiplier</span>
                <span>{(form.quest_exp_rate / 100).toFixed(form.quest_exp_rate % 100 === 0 ? 0 : 1)}x ({form.quest_exp_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.quest_exp_rate}
                  onChange={(e) => updateField('quest_exp_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.quest_exp_rate}
                  onChange={(e) => updateField('quest_exp_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Loyalty / NP Rate */}
            <div className="expbonus-field">
              <label>
                <span>Loyalty / NP Rate Multiplier</span>
                <span>{(form.np_rate / 100).toFixed(form.np_rate % 100 === 0 ? 0 : 1)}x ({form.np_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.np_rate}
                  onChange={(e) => updateField('np_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.np_rate}
                  onChange={(e) => updateField('np_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>
          </div>

          {/* 2. Scheduled Event Card */}
          <div className="expbonus-section-box">
            <h4>
              Jadwal Event Bonus (Timed Boost)
              <span className="quiet">Event Schedule</span>
            </h4>

            <label className="expbonus-event-toggle">
              <span>Aktifkan Jadwal Event Boost</span>
              <input
                type="checkbox"
                checked={form.is_event_active}
                onChange={(e) => updateField('is_event_active', e.target.checked)}
              />
            </label>

            <div className="expbonus-field">
              <label>
                <span>Nama / Judul Event</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Weekend EXP & Drop 200% Fever"
                value={form.event_name ?? ''}
                onChange={(e) => updateField('event_name', e.target.value)}
                style={{
                  padding: '9px 12px',
                  background: 'var(--ink)',
                  border: '1px solid var(--line)',
                  color: 'var(--parchment)',
                  borderRadius: 3,
                  fontSize: 13,
                }}
              />
            </div>

            <div className="expbonus-event-dates">
              <label>
                <span>Waktu Mulai</span>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInput(form.event_start)}
                  onChange={(e) => updateField('event_start', e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </label>
              <label>
                <span>Waktu Selesai</span>
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInput(form.event_end)}
                  onChange={(e) => updateField('event_end', e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </label>
            </div>

            <div className="expbonus-presets">
              <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Event Preset:</span>
              <button type="button" className={form.event_exp_rate === 150 ? 'active' : ''} onClick={() => applyEventPreset(150)}>1.5x (150%)</button>
              <button type="button" className={form.event_exp_rate === 200 ? 'active' : ''} onClick={() => applyEventPreset(200)}>2x (200%)</button>
              <button type="button" className={form.event_exp_rate === 250 ? 'active' : ''} onClick={() => applyEventPreset(250)}>2.5x (250%)</button>
              <button type="button" className={form.event_exp_rate === 300 ? 'active' : ''} onClick={() => applyEventPreset(300)}>3x (300%)</button>
              <button type="button" className={form.event_exp_rate === 400 ? 'active' : ''} onClick={() => applyEventPreset(400)}>4x (400%)</button>
            </div>

            {/* Event Monster EXP */}
            <div className="expbonus-field">
              <label>
                <span>Event Monster EXP</span>
                <span>{(form.event_exp_rate / 100).toFixed(form.event_exp_rate % 100 === 0 ? 0 : 1)}x ({form.event_exp_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={form.event_exp_rate}
                  onChange={(e) => updateField('event_exp_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.event_exp_rate}
                  onChange={(e) => updateField('event_exp_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 200)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Event Drop Rate */}
            <div className="expbonus-field">
              <label>
                <span>Event Item Drop Rate</span>
                <span>{(form.event_drop_rate / 100).toFixed(form.event_drop_rate % 100 === 0 ? 0 : 1)}x ({form.event_drop_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={form.event_drop_rate}
                  onChange={(e) => updateField('event_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.event_drop_rate}
                  onChange={(e) => updateField('event_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 150)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Event Gold Rate */}
            <div className="expbonus-field">
              <label>
                <span>Event Gold Rate</span>
                <span>{(form.event_gold_rate / 100).toFixed(form.event_gold_rate % 100 === 0 ? 0 : 1)}x ({form.event_gold_rate}%)</span>
              </label>
              <div className="expbonus-slider-row">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={form.event_gold_rate}
                  onChange={(e) => updateField('event_gold_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.event_gold_rate}
                  onChange={(e) => updateField('event_gold_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 150)))}
                />
                <span>%</span>
              </div>
            </div>

            <label className="expbonus-event-toggle" style={{ marginTop: 6 }}>
              <span>Siarkan Pengumuman di Server saat Diterapkan</span>
              <input
                type="checkbox"
                checked={form.broadcast_event}
                onChange={(e) => updateField('broadcast_event', e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="expbonus-footer-actions">
          <div className="left-actions">
            <button className="expbonus-btn-secondary" onClick={handleReset} disabled={busy || applying}>
              Reset ke Standar (100%)
            </button>
          </div>
          <div className="right-actions">
            <button
              className="expbonus-btn-secondary"
              onClick={() => handleSave(true)}
              disabled={busy || applying}
              title="Simpan perubahan ke database dan langsung kirim perintah ke ZoneServer"
            >
              <ZapIcon />
              Simpan & Terapkan Langsung
            </button>
            <button
              className="expbonus-btn-primary"
              onClick={() => handleSave(false)}
              disabled={busy || applying || !dirty}
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </section>

      {/* Audit History Panel */}
      <section className="panel table-panel">
        <header>
          <div>
            <p className="kicker">Audit Trail</p>
            <h3>Riwayat Perubahan Rate Server</h3>
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Operator</th>
                <th>Aksi</th>
                <th>EXP</th>
                <th>Drop</th>
                <th>Gold</th>
                <th>NP</th>
                <th>Event</th>
                <th>Status Server</th>
              </tr>
            </thead>
            <tbody>
              {data.history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Belum ada riwayat perubahan rate server.
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
                    <td>{h.exp_rate}%</td>
                    <td>{h.drop_rate}%</td>
                    <td>{h.gold_rate}%</td>
                    <td>{h.np_rate}%</td>
                    <td>{h.event_name ? `${h.event_name} (${h.is_event_active ? 'Aktif' : 'Nonaktif'})` : '—'}</td>
                    <td>
                      <span className={`status-pill ${h.applied_to_server ? 'online' : 'offline'}`}>
                        <i />
                        {h.applied_to_server ? 'Tersinkron' : 'Disimpan Saja'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
