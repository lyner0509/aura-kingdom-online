import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Overview, type Player } from './lib/api';
import { Login } from './components/Login';
import {
  ChevronIcon, CloseIcon, LogoutIcon, MenuIcon, PulseIcon, RefreshIcon,
  ScrollIcon, SearchIcon, ServerIcon, SigilIcon, UsersIcon,
} from './components/Icons';

type Page = 'overview' | 'services' | 'logs' | 'players';
const navigation: { id: Page; label: string; icon: typeof PulseIcon }[] = [
  { id: 'overview', label: 'Ringkasan', icon: PulseIcon },
  { id: 'services', label: 'Service', icon: ServerIcon },
  { id: 'logs', label: 'Log realm', icon: ScrollIcon },
  { id: 'players', label: 'Pemain', icon: UsersIcon },
];

function formatBytes(value: number | string): string {
  if (typeof value === 'string') return value;
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}h ${hours}j` : hours ? `${hours}j ${minutes}m` : `${minutes}m`;
}

function Meter({ value, warn = 78 }: { value: number; warn?: number }) {
  return <div className="meter" aria-label={`${Math.round(value)} persen`}><i className={value >= warn ? 'warn' : ''} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

function OverviewPage({ data }: { data: Overview }) {
  const memoryPercent = data.system.memory.total ? data.system.memory.used / data.system.memory.total * 100 : 0;
  const onlineServices = data.services.filter((service) => service.online).length;
  const realmHealthy = onlineServices === data.services.length && data.database.available;
  return (
    <>
      <section className="realm-banner">
        <div className={`realm-orb ${realmHealthy ? '' : 'degraded'}`}><span>{onlineServices}</span><small>/{data.services.length}</small></div>
        <div>
          <p className="kicker">Kondisi realm</p>
          <h2>{realmHealthy ? 'Azuria berjalan normal' : 'Realm memerlukan perhatian'}</h2>
          <p>{realmHealthy ? 'Seluruh service inti merespons dan database dapat dijangkau.' : 'Ada service yang berhenti atau jalur database terputus.'}</p>
        </div>
        <time>{new Date(data.system.sampledAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
      </section>

      <section className="metric-strip">
        <article><span>Pemain online</span><strong>{data.players.online}</strong><small>dari {data.players.total.toLocaleString('id-ID')} karakter</small></article>
        <article><span>Load 1 menit</span><strong>{data.system.load[0]?.toFixed(2)}</strong><small>host {data.system.hostname}</small></article>
        <article><span>Database</span><strong>{data.database.available ? `${data.database.latencyMs} ms` : 'Putus'}</strong><small>{data.database.available ? 'PostgreSQL merespons' : 'Periksa koneksi lokal'}</small></article>
        <article><span>Uptime host</span><strong>{formatDuration(data.system.uptimeSeconds)}</strong><small>sejak boot terakhir</small></article>
      </section>

      <div className="overview-grid">
        <section className="panel service-map">
          <header><div><p className="kicker">Jalur shard</p><h3>Service topology</h3></div><span className="quiet">live</span></header>
          <div className="service-flow">
            {data.services.map((service, index) => (
              <div className="flow-node" key={service.name}>
                {index > 0 && <i className={service.online ? '' : 'broken'} />}
                <div className={service.online ? 'online' : 'offline'}><span>{service.name.replace('Server', '')}</span><small>{service.online ? `PID ${service.pid}` : 'offline'}</small></div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel resource-panel">
          <header><div><p className="kicker">Kapasitas</p><h3>Sumber daya host</h3></div></header>
          <div className="resource-row"><div><span>Memori</span><strong>{formatBytes(data.system.memory.used)} / {formatBytes(data.system.memory.total)}</strong></div><Meter value={memoryPercent} /></div>
          <div className="resource-row"><div><span>Disk utama</span><strong>{formatBytes(data.system.disk.used)} / {formatBytes(data.system.disk.total)}</strong></div><Meter value={data.system.disk.usedPercent} /></div>
          <p className="capacity-note">Level karakter tertinggi saat ini <strong>{data.players.maxLevel}</strong>.</p>
        </section>
      </div>
    </>
  );
}

function ServicesPage({ data, refresh }: { data: Overview; refresh: () => Promise<void> }) {
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  async function control(action: 'start' | 'stop' | 'restart') {
    if (action === 'stop' && !window.confirm('Hentikan seluruh service game? Semua pemain akan terputus.')) return;
    if (action === 'restart' && !window.confirm('Restart seluruh realm sekarang?')) return;
    setPending(action); setNotice('');
    try { const result = await api.control(action); setNotice(result.output || `Aksi ${action} selesai.`); await refresh(); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Aksi gagal.'); }
    finally { setPending(null); }
  }
  return (
    <section className="panel table-panel">
      <header className="service-header"><div><p className="kicker">Process control</p><h3>Service realm</h3><p>Kontrol berlaku untuk seluruh rantai server agar urutan boot tetap benar.</p></div>
        <div className="actions"><button onClick={() => control('start')} disabled={!!pending}>Start</button><button onClick={() => control('restart')} disabled={!!pending}>Restart</button><button className="danger" onClick={() => control('stop')} disabled={!!pending}>Stop</button></div>
      </header>
      {notice && <div className="notice">{pending ? 'Menjalankan operasi…' : notice}</div>}
      <div className="table-wrap"><table><thead><tr><th>Service</th><th>Status</th><th>PID</th><th>CPU</th><th>Memori</th><th>Uptime</th></tr></thead><tbody>
        {data.services.map((service) => <tr key={service.name}><td><strong>{service.name}</strong></td><td><span className={`status-pill ${service.online ? 'online' : 'offline'}`}><i/>{service.online ? 'Online' : 'Offline'}</span></td><td>{service.pid ?? '—'}</td><td>{service.cpu.toFixed(1)}%</td><td>{service.memoryMb.toFixed(0)} MB</td><td>{formatDuration(service.uptimeSeconds)}</td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function LogsPage({ services }: { services: Overview['services'] }) {
  const [selected, setSelected] = useState('WorldServer');
  const [content, setContent] = useState('Memuat log…');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setContent((await api.logs(selected)).content || 'Log kosong.'); } catch (e) { setContent(e instanceof Error ? e.message : 'Gagal memuat log.'); } finally { setLoading(false); } }, [selected]);
  useEffect(() => { void load(); }, [load]);
  return <section className="panel logs-panel"><header><div><p className="kicker">Runtime stream</p><h3>Log realm</h3></div><div className="log-tools"><select value={selected} onChange={(e) => setSelected(e.target.value)}>{services.map(s => <option key={s.name}>{s.name}</option>)}</select><button onClick={load} disabled={loading}><RefreshIcon/>{loading ? 'Memuat' : 'Segarkan'}</button></div></header><pre><code>{content}</code></pre></section>;
}

function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { const timer = setTimeout(async () => { setLoading(true); setError(''); try { setPlayers((await api.players(search)).players); } catch (e) { setError(e instanceof Error ? e.message : 'Data pemain gagal dimuat.'); } finally { setLoading(false); } }, 280); return () => clearTimeout(timer); }, [search]);
  return <section className="panel table-panel"><header><div><p className="kicker">Character registry</p><h3>Direktori pemain</h3></div><label className="search-box"><SearchIcon/><input placeholder="Cari nama karakter…" value={search} onChange={(e) => setSearch(e.target.value)}/></label></header>{error && <div className="notice error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Karakter</th><th>Status</th><th>Level</th><th>Class ID</th><th>Terakhir terlihat</th></tr></thead><tbody>{players.map(player => <tr key={player.id}><td><div className="character"><span>{player.name.slice(0, 1).toUpperCase()}</span><div><strong>{player.name}</strong><small>#{player.id}</small></div></div></td><td><span className={`status-pill ${player.online ? 'online' : ''}`}><i/>{player.online ? 'Online' : 'Offline'}</span></td><td>{player.level}</td><td>{player.classId ?? '—'}</td><td>{player.online ? 'Sekarang' : player.lastSeen ? new Date(player.lastSeen).toLocaleString('id-ID') : '—'}</td></tr>)}</tbody></table>{!loading && !players.length && <div className="empty">Tidak ada karakter yang cocok.</div>}{loading && <div className="empty">Membaca registry…</div>}</div></section>;
}

export function App() {
  const [user, setUser] = useState<string | null>(null); const [checking, setChecking] = useState(true); const [page, setPage] = useState<Page>('overview'); const [overview, setOverview] = useState<Overview | null>(null); const [error, setError] = useState(''); const [menuOpen, setMenuOpen] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => { setRefreshing(true); try { setOverview(await api.overview()); setError(''); } catch (e) { if (e instanceof Error && e.message.includes('Sesi')) setUser(null); else setError(e instanceof Error ? e.message : 'Data tidak tersedia.'); } finally { setRefreshing(false); } }, []);
  useEffect(() => { api.session().then(s => setUser(s.user)).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (!user) return; void refresh(); const timer = setInterval(() => void refresh(), 15_000); return () => clearInterval(timer); }, [user, refresh]);
  const title = useMemo(() => navigation.find(item => item.id === page)?.label ?? '', [page]);
  async function logout() { await api.logout(); setUser(null); }
  if (checking) return <div className="boot-screen"><SigilIcon/><span>Menyiapkan ruang kendali…</span></div>;
  if (!user) return <Login onAuthenticated={setUser}/>;
  return <div className="app-shell">
    <aside className={menuOpen ? 'open' : ''}><div className="aside-head"><div className="brand-mark"><SigilIcon/></div><div><strong>Aura Kingdom</strong><span>Realm operations</span></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><CloseIcon/></button></div>
      <nav>{navigation.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setMenuOpen(false); }}><item.icon/><span>{item.label}</span>{page === item.id && <ChevronIcon className="chevron"/>}</button>)}</nav>
      <div className="operator"><span>{user.slice(0,1).toUpperCase()}</span><div><strong>{user}</strong><small>Realm operator</small></div><button title="Keluar" onClick={logout}><LogoutIcon/></button></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}/>} 
    <main className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}><MenuIcon/></button><div><p>VM-18-118 · Asia/Jakarta</p><h1>{title}</h1></div><button className="refresh-button" onClick={refresh} disabled={refreshing}><RefreshIcon className={refreshing ? 'spin' : ''}/><span>{refreshing ? 'Memuat' : 'Segarkan'}</span></button></header>
      <div className="content">{error && <div className="notice error">{error}</div>}{overview ? <>{page === 'overview' && <OverviewPage data={overview}/>} {page === 'services' && <ServicesPage data={overview} refresh={refresh}/>} {page === 'logs' && <LogsPage services={overview.services}/>} {page === 'players' && <PlayersPage/>}</> : <div className="loading-state"><SigilIcon/><p>Membaca kondisi realm…</p></div>}</div>
    </main>
  </div>;
}
