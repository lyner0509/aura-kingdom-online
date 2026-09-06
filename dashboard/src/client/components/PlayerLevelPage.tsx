import { useCallback, useEffect, useState } from 'react';
import { api, type Player, type PlayerLevelData } from '../lib/api';
import { SearchIcon } from './Icons';

const statusLabel: Record<string, string> = {
  pending: 'Menunggu',
  applied: 'Diterapkan',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
};

const actionLabel: Record<string, string> = {
  queued: 'Diantrekan',
  applied: 'Diterapkan',
  cancelled: 'Dibatalkan',
};

function formatTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('id-ID');
}

export function PlayerLevelPage() {
  const [data, setData] = useState<PlayerLevelData | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player | null>(null);
  const [targetLevel, setTargetLevel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.playerLevel());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data level pemain gagal dimuat.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The queue moves on its own once a character logs out, so keep the
  // table honest without making the operator press refresh.
  useEffect(() => {
    const timer = setInterval(() => void load(), 20_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      api.players(term, controller.signal)
        .then(result => setResults(result.players.slice(0, 12)))
        .catch(() => undefined)
        .finally(() => setSearching(false));
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); setSearching(false); };
  }, [search]);

  const levelCap = data?.levelCap ?? 99;
  const parsedLevel = Number(targetLevel);
  const levelValid = Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= levelCap;
  const sameLevel = !!selected && levelValid && selected.level === parsedLevel;

  async function assign() {
    if (!selected || !levelValid || sameLevel || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.assignPlayerLevel({
        player_id: Number(selected.id),
        target_level: parsedLevel,
        note: note.trim() || undefined,
      });
      setData(result.data);
      setNotice(result.message);
      setSelected(null);
      setTargetLevel('');
      setNote('');
      setSearch('');
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Penugasan level gagal.');
    } finally {
      setBusy(false);
    }
  }

  async function act(kind: 'retry' | 'cancel', playerId: string, playerName: string) {
    if (busy) return;
    if (kind === 'cancel' && !window.confirm(`Batalkan penugasan level untuk ${playerName}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = kind === 'retry'
        ? await api.retryPlayerLevel(playerId)
        : await api.cancelPlayerLevel(playerId);
      setData(result.data);
      setNotice(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tindakan gagal.');
    } finally {
      setBusy(false);
    }
  }

  const pending = data?.assignments.filter(row => row.status === 'pending') ?? [];

  return <div className="player-level">
    <section className="panel">
      <header className="paragon-header">
        <div>
          <p className="kicker">Pengaturan admin</p>
          <h3>Level Player</h3>
          <p>Set level karakter tertentu. Karakter yang sedang online diantrekan dan diterapkan otomatis setelah logout.</p>
        </div>
        <button disabled={busy} onClick={() => { setNotice(''); void load(); }}>Muat ulang</button>
      </header>

      {error && <div role="alert" className="notice error">{error}</div>}
      {notice && <div role="status" className="notice">{notice}</div>}

      <div className="level-form">
        <label className="level-search">
          Cari karakter
          <span className="search-field">
            <SearchIcon />
            <input
              type="search"
              value={search}
              placeholder="Nama karakter, minimal 2 huruf"
              disabled={busy}
              onChange={event => { setSearch(event.target.value); setSelected(null); }}
            />
          </span>
        </label>

        {!selected && search.trim().length >= 2 && <div className="level-results">
          {searching && !results.length ? <p className="empty">Mencari…</p>
            : results.length ? <ul>{results.map(player => <li key={player.id}>
              <button disabled={busy} onClick={() => { setSelected(player); setResults([]); }}>
                <strong>{player.name}</strong>
                <span>Lv {player.level}{player.className ? ` · ${player.className}` : ''}</span>
                <em className={player.online ? 'online' : 'offline'}>{player.online ? 'Online' : 'Offline'}</em>
              </button>
            </li>)}</ul>
            : <p className="empty">Tidak ada karakter yang cocok.</p>}
        </div>}

        {selected && <div className="level-selected">
          <div>
            <strong>{selected.name}</strong>
            <span>
              Level sekarang {selected.level}
              {selected.className ? ` · ${selected.className}` : ''}
              {selected.accountName ? ` · akun ${selected.accountName}` : ''}
            </span>
            <em className={selected.online ? 'online' : 'offline'}>
              {selected.online
                ? 'Online — akan diterapkan otomatis setelah logout'
                : 'Offline — akan diterapkan sekarang'}
            </em>
          </div>
          <button disabled={busy} onClick={() => { setSelected(null); setTargetLevel(''); }}>Ganti karakter</button>
        </div>}

        <div className="level-inputs">
          <label>
            Level tujuan
            <input
              type="number"
              min={1}
              max={levelCap}
              step={1}
              value={targetLevel}
              disabled={busy || !selected}
              placeholder={`1 – ${levelCap}`}
              onChange={event => setTargetLevel(event.target.value)}
            />
          </label>
          <label className="level-note">
            Catatan <small>opsional</small>
            <input
              type="text"
              maxLength={200}
              value={note}
              disabled={busy || !selected}
              placeholder="Alasan perubahan, untuk riwayat"
              onChange={event => setNote(event.target.value)}
            />
          </label>
          <button className="primary-button" disabled={!selected || !levelValid || sameLevel || busy} onClick={assign}>
            {busy ? 'Memproses…' : 'Set level'}
          </button>
        </div>

        <p className="level-help">
          Batas level server saat ini {levelCap}. Level karakter, bar EXP, dan level class aktif
          diubah bersamaan; class lain tidak disentuh. Setelah ditulis, level dibaca
          ulang lebih dulu — status baru menjadi Diterapkan kalau nilainya bertahan.
          {selected && targetLevel && !levelValid && ' Masukkan level antara 1 dan ' + levelCap + '.'}
          {sameLevel && ' Karakter sudah berada di level itu.'}
        </p>
      </div>
    </section>

    <section className="panel">
      <header><h3>Penugasan</h3><span>{pending.length} menunggu</span></header>
      {!data ? <div className="empty">Memuat…</div>
        : !data.assignments.length ? <div className="empty">Belum ada penugasan level.</div>
        : <div className="table-wrap"><table>
          <thead><tr>
            <th>Karakter</th><th>Sekarang</th><th>Tujuan</th><th>Status</th>
            <th>Diminta oleh</th><th>Waktu</th><th>Tindakan</th>
          </tr></thead>
          <tbody>{data.assignments.map(row => <tr key={row.player_id}>
            <td>
              <strong>{row.player_name}</strong>
              {row.online && <em className="online"> · online</em>}
              {row.last_error && <small className="level-error">{row.last_error}</small>}
            </td>
            <td>{row.current_level ?? '—'}</td>
            <td>{row.target_level}</td>
            <td>
              <span className={`level-status ${row.status}`}>
                {row.status === 'pending' && row.written_at ? 'Memverifikasi' : statusLabel[row.status] ?? row.status}
              </span>
            </td>
            <td>{row.requested_by}</td>
            <td>{formatTime(row.applied_at ?? row.requested_at)}</td>
            <td className="level-actions">
              {row.status === 'failed' && <button disabled={busy} onClick={() => act('retry', row.player_id, row.player_name)}>Coba lagi</button>}
              {(row.status === 'pending' || row.status === 'failed') &&
                <button disabled={busy} onClick={() => act('cancel', row.player_id, row.player_name)}>Batalkan</button>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section className="panel paragon-history">
      <header><h3>Riwayat</h3></header>
      {data?.history.length
        ? <ul>{data.history.map(entry => <li key={entry.id}>
            <strong>{entry.player_name}</strong>
            <span>
              {actionLabel[entry.action] ?? entry.action}
              {' · '}
              {entry.from_level === null ? `level ${entry.to_level}` : `${entry.from_level} → ${entry.to_level}`}
              {' · '}{entry.operator}
              {entry.details ? ` · ${entry.details}` : ''}
            </span>
            <time>{formatTime(entry.created_at)}</time>
          </li>)}</ul>
        : <p>Belum ada perubahan level melalui dashboard.</p>}
    </section>
  </div>;
}
