import { useEffect, useState } from 'react';
import { api, type ParagonData, type ParagonReward } from '../lib/api';

type Editable = 'item_id' | 'max_stack' | 'drop_rate' | 'notify' | 'get_only' | 'shining_hint' | 'jack_pot';
const flags = [
  ['notify', 'Pengumuman'], ['get_only', 'Hanya ambil'],
  ['shining_hint', 'Sorotan'], ['jack_pot', 'Jackpot'],
] as const;
export function ParagonPage({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [data, setData] = useState<ParagonData | null>(null);
  const [rows, setRows] = useState<ParagonReward[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [group, setGroup] = useState('');
  const [tier, setTier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !!data && JSON.stringify(rows) !== JSON.stringify(data.rows);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  async function load() {
    setBusy(true); setError('');
    try {
      const result = await api.paragon(); setData(result); setRows(result.rows); setItemNames(result.itemNames);
      setGroup(current => result.rows.some(r => `${r.category}/${r.weekday}` === current) ? current : result.rows.length ? `${result.rows[0].category}/${result.rows[0].weekday}` : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Tabel gagal dimuat.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!rows.length) return;
    const timer = setTimeout(() => {
      void api.itemNames(rows.map(row => row.item_id)).then(result => setItemNames(current => ({ ...current, ...result.itemNames }))).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [rows]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const groups = [...new Set(rows.map(row => `${row.category}/${row.weekday}`))];
  const selected = rows.filter(row => `${row.category}/${row.weekday}` === group);
  const tiers = [...new Set(selected.map(row => row.drop_level))];
  const activeTier = tiers.includes(tier) ? tier : tiers[0];
  const visible = selected.filter(row => row.drop_level === activeTier);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.category}/${row.weekday}/${row.drop_level}`;
    totals.set(key, (totals.get(key) ?? 0) + row.drop_rate);
  }
  const invalid = rows.some(row => !Number.isInteger(row.item_id) || row.item_id < 1 || row.item_id > 2147483647 || !Number.isInteger(row.max_stack) || row.max_stack < 1 || row.max_stack > 32767 || !Number.isFinite(row.drop_rate) || row.drop_rate < 0 || row.drop_rate > 100)
    || [...totals.values()].some(total => !Number.isFinite(total) || Math.abs(total - 100) > 0.000001);
  const total = visible.reduce((sum, row) => sum + row.drop_rate, 0);
  const changedCount = data ? rows.filter((row, index) => JSON.stringify(row) !== JSON.stringify(data.rows[index])).length : 0;
  function edit(row: ParagonReward, field: Editable, value: number) {
    setNotice('');
    setRows(current => current.map(item => item === row ? { ...item, [field]: value } : item));
  }
  async function save() {
    if (!data || invalid || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.saveParagon(data.revision, rows);
      setData({ ...data, rows: structuredClone(rows), revision: result.revision });
      setNotice(result.changed ? 'Perubahan tersimpan. Game akan membaca konfigurasi saat tabel dimuat ulang; status penerapan di game belum terverifikasi.' : 'Tidak ada perubahan untuk disimpan.');
      // Refresh history without replacing the successfully saved revision on failure.
      try { const latest = await api.paragon(); setData(latest); setRows(latest.rows); setItemNames(latest.itemNames); } catch { /* The save already succeeded. */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Perubahan gagal disimpan.'); }
    finally { setBusy(false); }
  }
  return <div className="paragon-editor">
    <section className="panel">
      <header className="paragon-header"><div><p className="kicker">Pengaturan admin</p><h3>Paragon Table</h3><p>Atur hadiah dan peluang pada setiap tingkat Paragon.</p></div>
        <button disabled={busy} onClick={() => { if (!dirty || window.confirm('Buang perubahan yang belum disimpan dan muat ulang tabel?')) { setNotice(''); void load(); } }}>Muat ulang</button>
      </header>
      {error && <div role="alert" className="notice error">{error}</div>}
      {notice && <div role="status" className="notice">{notice}</div>}
      {data?.readOnly && <div className="notice">Preview lokal. Penyimpanan tersedia di dashboard server.</div>}
      {!data ? <div className="empty">{busy ? 'Memuat Paragon Table…' : 'Tabel belum tersedia. Coba muat ulang.'}</div> : !rows.length ? <div className="empty">Belum ada hadiah Paragon di server.</div> : <>
        <div className="paragon-controls"><label>Kategori<select aria-label="Kategori" value={group} disabled={busy} onChange={e => setGroup(e.target.value)}>{groups.map(value => <option key={value} value={value}>Kategori {value.split('/')[0]} · Jadwal {value.split('/')[1]}</option>)}</select></label><p>{selected.length} hadiah · {tiers.length} tingkat<br/>Total peluang setiap tingkat harus 100%.</p></div>
        <div className="paragon-tiers" aria-label="Pilih tingkat">{tiers.map(value => <button key={value} aria-pressed={activeTier === value} className={activeTier === value ? 'selected' : ''} onClick={() => setTier(value)}>Tingkat {value}</button>)}</div>
        <div className="paragon-tier-heading"><h4>Tingkat {activeTier}</h4><span className={Math.abs(total - 100) > 0.000001 || !Number.isFinite(total) ? 'invalid' : ''}>Total peluang: {Number.isFinite(total) ? Number(total.toFixed(6)) : '—'}%</span></div>
        <div className="table-wrap"><table className="paragon-table"><thead><tr><th>Slot</th><th>Item ID</th><th>Nama item</th><th>Jumlah</th><th>Peluang (%)</th>{flags.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
          <tbody>{visible.map(row => <tr key={`${row.category}/${row.weekday}/${row.drop_level}/${row.level_order}`}><td><strong>{row.level_order}</strong></td>
            <td><input aria-label={`Item ID slot ${row.level_order}`} type="number" min={1} max={2147483647} step={1} disabled={busy || data.readOnly} value={Number.isNaN(row.item_id) ? '' : row.item_id} onChange={e => edit(row, 'item_id', e.target.value === '' ? NaN : Number(e.target.value))}/></td>
            <td className="item-name">{itemNames[String(row.item_id)] ?? (Number.isInteger(row.item_id) && row.item_id > 0 ? 'Nama tidak ditemukan' : '—')}</td>
            {(['max_stack', 'drop_rate'] as const).map(field => <td key={field}><input aria-label={`${field === 'max_stack' ? 'Jumlah' : 'Peluang'} slot ${row.level_order}`} type="number" min={field === 'drop_rate' ? 0 : 1} max={field === 'drop_rate' ? 100 : 32767} step={field === 'drop_rate' ? 'any' : 1} disabled={busy || data.readOnly} value={Number.isNaN(row[field]) ? '' : row[field]} onChange={e => edit(row, field, e.target.value === '' ? NaN : Number(e.target.value))}/></td>)}
            {flags.map(([field, label]) => <td key={field}><input aria-label={`${label} slot ${row.level_order}`} type="checkbox" checked={row[field] === 1} disabled={busy || data.readOnly} onChange={e => edit(row, field, e.target.checked ? 1 : 0)}/></td>)}
          </tr>)}</tbody></table></div>
        <p className="paragon-help">“Hanya ambil” mengakhiri rantai pada hadiah tersebut. Item ID mengacu pada katalog item game. Penyimpanan tidak me-restart realm.</p>
        <div className="paragon-save"><div><strong>{dirty ? `${changedCount} hadiah diubah` : 'Belum ada perubahan'}</strong><p>{invalid ? 'Periksa Item ID, jumlah, dan total peluang pada semua tingkat.' : 'Semua perubahan disimpan bersama dengan salinan nilai sebelumnya.'}</p></div><button className="primary-button" disabled={!dirty || invalid || busy || data.readOnly} onClick={save}>{busy ? 'Memproses…' : 'Simpan perubahan'}</button></div>
      </>}
    </section>
    {data && <section className="panel paragon-history"><header><h3>Riwayat perubahan</h3></header>{data.history.length ? <ul>{data.history.map(entry => <li key={entry.id}><strong>{entry.actor}</strong><time>{new Date(entry.createdAt).toLocaleString('id-ID')}</time></li>)}</ul> : <p>Belum ada perubahan tersimpan melalui dashboard.</p>}</section>}
  </div>;
}
