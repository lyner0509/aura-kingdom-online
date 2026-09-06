import { useEffect, useState } from 'react';
import { api, type DropLootData, type DropLootSettings, type EffectiveDropRates } from '../lib/api';
import { RefreshIcon, TreasureIcon, ZapIcon } from './Icons';

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

export function DropLootPage({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<DropLootData | null>(null);
  const [form, setForm] = useState<DropLootSettings | null>(null);
  const [effective, setEffective] = useState<EffectiveDropRates | null>(null);
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
      const result = await api.dropLoot();
      setData(result);
      setForm(result.settings);
      setEffective(result.effectiveRates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pengaturan Drop Loot bonus.');
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

  function updateField<K extends keyof DropLootSettings>(key: K, value: DropLootSettings[K]) {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  }

  function applyBasePreset(rate: number) {
    if (!form) return;
    setForm({
      ...form,
      drop_rate: rate,
      boss_drop_rate: rate > 200 ? Math.min(rate, 250) : rate,
      dungeon_drop_rate: rate,
      quest_drop_rate: rate,
      gold_drop_rate: rate > 200 ? Math.min(rate, 200) : rate,
      rare_drop_rate: Math.min(500, Math.round(100 + (rate - 100) * 0.5)),
    });
  }

  function applyEventPreset(rate: number) {
    if (!form) return;
    setForm({
      ...form,
      event_drop_rate: rate,
      event_boss_drop_rate: Math.min(rate, 250),
      event_dungeon_drop_rate: rate,
      event_quest_drop_rate: Math.min(rate, 200),
      event_gold_drop_rate: Math.min(rate, 200),
      event_extra_loot_chance: Math.min(50, Math.round((rate - 100) * 0.15)),
      event_rare_drop_rate: Math.min(300, Math.round(100 + (rate - 100) * 0.5)),
    });
  }

  async function handleSave(applyImmediately = false) {
    if (!data || !form) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.saveDropLoot({
        revision: data.revision,
        drop_rate: form.drop_rate,
        boss_drop_rate: form.boss_drop_rate,
        dungeon_drop_rate: form.dungeon_drop_rate,
        quest_drop_rate: form.quest_drop_rate,
        gold_drop_rate: form.gold_drop_rate,
        extra_loot_chance: form.extra_loot_chance,
        rare_drop_rate: form.rare_drop_rate,
        is_event_active: form.is_event_active,
        event_name: form.event_name,
        event_start: form.event_start,
        event_end: form.event_end,
        event_drop_rate: form.event_drop_rate,
        event_boss_drop_rate: form.event_boss_drop_rate,
        event_dungeon_drop_rate: form.event_dungeon_drop_rate,
        event_quest_drop_rate: form.event_quest_drop_rate,
        event_gold_drop_rate: form.event_gold_drop_rate,
        event_extra_loot_chance: form.event_extra_loot_chance,
        event_rare_drop_rate: form.event_rare_drop_rate,
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
    if (!window.confirm('Terapkan rate drop loot aktif saat ini langsung ke ZoneServer? Pemain in-game akan langsung merasakan perubahannya.')) return;
    setApplying(true);
    setError('');
    setNotice('');
    try {
      const res = await api.applyDropLootNow();
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menerapkan ke ZoneServer.');
    } finally {
      setApplying(false);
    }
  }

  function handleReset() {
    if (!window.confirm('Kembalikan seluruh rate Drop Loot ke standar normal 100% (1x)?')) return;
    applyBasePreset(100);
    if (form) {
      setForm({
        ...form,
        drop_rate: 100,
        boss_drop_rate: 100,
        dungeon_drop_rate: 100,
        quest_drop_rate: 100,
        gold_drop_rate: 100,
        extra_loot_chance: 0,
        rare_drop_rate: 100,
        is_event_active: false,
      });
    }
  }

  if (!form || !data) {
    return (
      <section className="panel">
        <div className="loading-state">
          <TreasureIcon />
          <p>Memuat pengaturan Drop Loot Bonus…</p>
        </div>
      </section>
    );
  }

  const currentRates = effective ?? {
    drop_rate: form.drop_rate,
    boss_drop_rate: form.boss_drop_rate,
    dungeon_drop_rate: form.dungeon_drop_rate,
    quest_drop_rate: form.quest_drop_rate,
    gold_drop_rate: form.gold_drop_rate,
    extra_loot_chance: form.extra_loot_chance,
    rare_drop_rate: form.rare_drop_rate,
    isEventEffective: false,
    eventName: null,
    timeRemainingSeconds: null,
  };

  return (
    <div className="droploot-editor">
      <section className="panel">
        <header className="droploot-header">
          <div>
            <p className="kicker">Loot & Drop Operations</p>
            <h3>Pengaturan Drop Loot & Server Rates</h3>
            <p>
              Atur pengganda Monster Item Drop, Boss / Elite Loot, Dungeon Instance Drop, Gold Loot, dan Peluang Ekstra Roll Loot. Perubahan dapat langsung diterapkan ke ZoneServer (CGI port 20060) secara real-time tanpa perlu restart server.
            </p>
          </div>
          <div className="droploot-actions">
            <button className="droploot-btn-secondary" onClick={load} disabled={busy || applying}>
              <RefreshIcon className={busy ? 'spin' : ''} />
              Muat Ulang
            </button>
            <button className="droploot-btn-apply" onClick={handleApplyNow} disabled={busy || applying}>
              <ZapIcon />
              {applying ? 'Menerapkan…' : 'Terapkan ke Live Server'}
            </button>
            <button className="droploot-btn-primary" onClick={() => handleSave(false)} disabled={busy || applying || !dirty}>
              {busy ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="notice error">{error}</div>}

        {/* Live Rates Status Cards */}
        <div className="droploot-live-strip">
          <article className={`droploot-live-card ${currentRates.drop_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Monster Item Drop</span>
            <div className="card-value">
              {(currentRates.drop_rate / 100).toFixed(currentRates.drop_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.drop_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.drop_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`droploot-live-card ${currentRates.boss_drop_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Boss / Elite Drop</span>
            <div className="card-value">
              {(currentRates.boss_drop_rate / 100).toFixed(currentRates.boss_drop_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.boss_drop_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.boss_drop_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`droploot-live-card ${currentRates.dungeon_drop_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Dungeon Instance Drop</span>
            <div className="card-value">
              {(currentRates.dungeon_drop_rate / 100).toFixed(currentRates.dungeon_drop_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.dungeon_drop_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.dungeon_drop_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`droploot-live-card ${currentRates.gold_drop_rate > 100 ? 'boosted' : ''}`}>
            <span className="card-kicker">Gold Loot Gain</span>
            <div className="card-value">
              {(currentRates.gold_drop_rate / 100).toFixed(currentRates.gold_drop_rate % 100 === 0 ? 0 : 1)}x
              <span>({currentRates.gold_drop_rate}%)</span>
            </div>
            <span className="card-tag">{currentRates.gold_drop_rate > 100 ? 'Boost Aktif' : 'Standar Normal'}</span>
          </article>

          <article className={`droploot-live-card ${currentRates.extra_loot_chance > 0 ? 'boosted' : ''}`}>
            <span className="card-kicker">Extra Loot Roll Chance</span>
            <div className="card-value">
              +{currentRates.extra_loot_chance}%
              <span>Roll</span>
            </div>
            <span className="card-tag">{currentRates.extra_loot_chance > 0 ? 'Bonus Aktif' : 'Standar 0%'}</span>
          </article>
        </div>

        {/* Live Event Banner */}
        {currentRates.isEventEffective ? (
          <div className="droploot-status-banner event-active">
            <div className="status-left">
              <div className="status-icon">
                <TreasureIcon />
              </div>
              <div className="status-info">
                <strong>Event Drop Fever Sedang Aktif: {currentRates.eventName || 'Event Boost'}</strong>
                <small>
                  Tingkat drop live: Item {currentRates.drop_rate}%, Boss {currentRates.boss_drop_rate}%, Dungeon {currentRates.dungeon_drop_rate}%, Gold {currentRates.gold_drop_rate}%, Extra Roll +{currentRates.extra_loot_chance}%
                </small>
              </div>
            </div>
            {currentRates.timeRemainingSeconds !== null && (
              <div className="status-countdown">
                <span>Sisa Waktu Event:</span>
                <strong>{formatDuration(currentRates.timeRemainingSeconds)}</strong>
              </div>
            )}
          </div>
        ) : (
          <div className="droploot-status-banner">
            <div className="status-left">
              <div className="status-icon">
                <TreasureIcon />
              </div>
              <div className="status-info">
                <strong>Rate Drop Loot Standar Normal Aktif</strong>
                <small>Tidak ada event drop booster terjadwal yang sedang berlangsung saat ini.</small>
              </div>
            </div>
          </div>
        )}

        {/* Main Settings Form Grid */}
        <div className="droploot-form-grid">
          {/* Base Rates Panel */}
          <div className="droploot-section-box">
            <h4>
              Konfigurasi Base Drop & Loot
              <span className="quiet">Default Rates</span>
            </h4>

            <div className="droploot-presets">
              <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Preset:</span>
              <button type="button" className={form.drop_rate === 100 ? 'active' : ''} onClick={() => applyBasePreset(100)}>Standar 1x (100%)</button>
              <button type="button" className={form.drop_rate === 150 ? 'active' : ''} onClick={() => applyBasePreset(150)}>1.5x (150%)</button>
              <button type="button" className={form.drop_rate === 200 ? 'active' : ''} onClick={() => applyBasePreset(200)}>2x (200%)</button>
              <button type="button" className={form.drop_rate === 300 ? 'active' : ''} onClick={() => applyBasePreset(300)}>3x (300%)</button>
              <button type="button" className={form.drop_rate === 500 ? 'active' : ''} onClick={() => applyBasePreset(500)}>5x (500%)</button>
            </div>

            {/* Monster Drop Rate */}
            <div className="droploot-field">
              <label>
                <span>Monster Item Drop Rate</span>
                <span>{(form.drop_rate / 100).toFixed(form.drop_rate % 100 === 0 ? 0 : 1)}x ({form.drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
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

            {/* Boss Drop Rate */}
            <div className="droploot-field">
              <label>
                <span>Boss / Elite Drop Multiplier</span>
                <span>{(form.boss_drop_rate / 100).toFixed(form.boss_drop_rate % 100 === 0 ? 0 : 1)}x ({form.boss_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.boss_drop_rate}
                  onChange={(e) => updateField('boss_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.boss_drop_rate}
                  onChange={(e) => updateField('boss_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Dungeon Drop Rate */}
            <div className="droploot-field">
              <label>
                <span>Dungeon / Instance Drop Multiplier</span>
                <span>{(form.dungeon_drop_rate / 100).toFixed(form.dungeon_drop_rate % 100 === 0 ? 0 : 1)}x ({form.dungeon_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.dungeon_drop_rate}
                  onChange={(e) => updateField('dungeon_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.dungeon_drop_rate}
                  onChange={(e) => updateField('dungeon_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Quest Loot Multiplier */}
            <div className="droploot-field">
              <label>
                <span>Quest Item Drop Multiplier</span>
                <span>{(form.quest_drop_rate / 100).toFixed(form.quest_drop_rate % 100 === 0 ? 0 : 1)}x ({form.quest_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.quest_drop_rate}
                  onChange={(e) => updateField('quest_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.quest_drop_rate}
                  onChange={(e) => updateField('quest_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Gold Loot Rate */}
            <div className="droploot-field">
              <label>
                <span>Gold Loot Gain Multiplier</span>
                <span>{(form.gold_drop_rate / 100).toFixed(form.gold_drop_rate % 100 === 0 ? 0 : 1)}x ({form.gold_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={form.gold_drop_rate}
                  onChange={(e) => updateField('gold_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.gold_drop_rate}
                  onChange={(e) => updateField('gold_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Extra Loot Roll Chance */}
            <div className="droploot-field">
              <label>
                <span>Peluang Ekstra Roll Loot (Double Roll Chance)</span>
                <span>+{form.extra_loot_chance}% Chance</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={form.extra_loot_chance}
                  onChange={(e) => updateField('extra_loot_chance', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.extra_loot_chance}
                  onChange={(e) => updateField('extra_loot_chance', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Rare Item Drop Bias */}
            <div className="droploot-field">
              <label>
                <span>Rare Item Drop Quality Rate</span>
                <span>{(form.rare_drop_rate / 100).toFixed(form.rare_drop_rate % 100 === 0 ? 0 : 1)}x ({form.rare_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={form.rare_drop_rate}
                  onChange={(e) => updateField('rare_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="500"
                  value={form.rare_drop_rate}
                  onChange={(e) => updateField('rare_drop_rate', Math.max(50, Math.min(500, Number(e.target.value) || 100)))}
                />
                <span>%</span>
              </div>
            </div>
          </div>

          {/* Event Schedule Panel */}
          <div className="droploot-section-box">
            <h4>
              Jadwal Event Drop Boost (Timed Loot Event)
              <span className="quiet">Event Schedule</span>
            </h4>

            <label className="droploot-event-toggle">
              <span>Aktifkan Jadwal Event Drop Boost</span>
              <input
                type="checkbox"
                checked={form.is_event_active}
                onChange={(e) => updateField('is_event_active', e.target.checked)}
              />
            </label>

            <div className="droploot-field">
              <label>
                <span>Nama / Judul Event</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Weekend Drop Fever 200% & Rare Boost"
                value={form.event_name ?? ''}
                onChange={(e) => updateField('event_name', e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--ink)',
                  border: '1px solid var(--line)',
                  color: 'var(--parchment)',
                  borderRadius: 3,
                  fontSize: 13,
                }}
              />
            </div>

            <div className="droploot-event-dates">
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

            <div className="droploot-presets">
              <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginRight: 4 }}>Event Preset:</span>
              <button type="button" className={form.event_drop_rate === 150 ? 'active' : ''} onClick={() => applyEventPreset(150)}>1.5x (150%)</button>
              <button type="button" className={form.event_drop_rate === 200 ? 'active' : ''} onClick={() => applyEventPreset(200)}>2x (200%)</button>
              <button type="button" className={form.event_drop_rate === 250 ? 'active' : ''} onClick={() => applyEventPreset(250)}>2.5x (250%)</button>
              <button type="button" className={form.event_drop_rate === 300 ? 'active' : ''} onClick={() => applyEventPreset(300)}>3x (300%)</button>
              <button type="button" className={form.event_drop_rate === 400 ? 'active' : ''} onClick={() => applyEventPreset(400)}>4x (400%)</button>
            </div>

            {/* Event Monster Drop */}
            <div className="droploot-field">
              <label>
                <span>Event Monster Item Drop Rate</span>
                <span>{(form.event_drop_rate / 100).toFixed(form.event_drop_rate % 100 === 0 ? 0 : 1)}x ({form.event_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
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
                  onChange={(e) => updateField('event_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 200)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Event Boss Drop */}
            <div className="droploot-field">
              <label>
                <span>Event Boss / Elite Drop Multiplier</span>
                <span>{(form.event_boss_drop_rate / 100).toFixed(form.event_boss_drop_rate % 100 === 0 ? 0 : 1)}x ({form.event_boss_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={form.event_boss_drop_rate}
                  onChange={(e) => updateField('event_boss_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.event_boss_drop_rate}
                  onChange={(e) => updateField('event_boss_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 150)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Event Dungeon Drop */}
            <div className="droploot-field">
              <label>
                <span>Event Dungeon Instance Drop</span>
                <span>{(form.event_dungeon_drop_rate / 100).toFixed(form.event_dungeon_drop_rate % 100 === 0 ? 0 : 1)}x ({form.event_dungeon_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={form.event_dungeon_drop_rate}
                  onChange={(e) => updateField('event_dungeon_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.event_dungeon_drop_rate}
                  onChange={(e) => updateField('event_dungeon_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 200)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Event Extra Loot Roll Chance */}
            <div className="droploot-field">
              <label>
                <span>Event Peluang Ekstra Roll Loot</span>
                <span>+{form.event_extra_loot_chance}% Chance</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={form.event_extra_loot_chance}
                  onChange={(e) => updateField('event_extra_loot_chance', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.event_extra_loot_chance}
                  onChange={(e) => updateField('event_extra_loot_chance', Math.max(0, Math.min(100, Number(e.target.value) || 25)))}
                />
                <span>%</span>
              </div>
            </div>

            {/* Event Gold Loot Rate */}
            <div className="droploot-field">
              <label>
                <span>Event Gold Loot Gain</span>
                <span>{(form.event_gold_drop_rate / 100).toFixed(form.event_gold_drop_rate % 100 === 0 ? 0 : 1)}x ({form.event_gold_drop_rate}%)</span>
              </label>
              <div className="droploot-slider-row">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="10"
                  value={form.event_gold_drop_rate}
                  onChange={(e) => updateField('event_gold_drop_rate', Number(e.target.value))}
                />
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={form.event_gold_drop_rate}
                  onChange={(e) => updateField('event_gold_drop_rate', Math.max(50, Math.min(1000, Number(e.target.value) || 150)))}
                />
                <span>%</span>
              </div>
            </div>

            <label className="droploot-event-toggle" style={{ marginTop: 6 }}>
              <span>Siarkan Pengumuman di Server saat Diterapkan</span>
              <input
                type="checkbox"
                checked={form.broadcast_event}
                onChange={(e) => updateField('broadcast_event', e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Footer Actions - Compact styling */}
        <div className="droploot-footer-actions">
          <div className="left-actions">
            <button className="droploot-btn-secondary" onClick={handleReset} disabled={busy || applying}>
              Reset ke Standar (100%)
            </button>
          </div>
          <div className="right-actions">
            <button
              className="droploot-btn-secondary"
              onClick={() => handleSave(true)}
              disabled={busy || applying}
              title="Simpan perubahan ke database dan langsung kirim perintah ke ZoneServer"
            >
              <ZapIcon />
              Simpan & Terapkan Langsung
            </button>
            <button
              className="droploot-btn-primary"
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
            <h3>Riwayat Perubahan Drop Loot</h3>
          </div>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Operator</th>
                <th>Aksi</th>
                <th>Item Drop</th>
                <th>Boss Drop</th>
                <th>Dungeon</th>
                <th>Gold Loot</th>
                <th>Extra Roll</th>
                <th>Event</th>
                <th>Status Server</th>
              </tr>
            </thead>
            <tbody>
              {data.history.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">
                    Belum ada riwayat perubahan rate Drop Loot.
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
                    <td>{h.drop_rate}%</td>
                    <td>{h.boss_drop_rate}%</td>
                    <td>{h.dungeon_drop_rate}%</td>
                    <td>{h.gold_drop_rate}%</td>
                    <td>+{h.extra_loot_chance}%</td>
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
