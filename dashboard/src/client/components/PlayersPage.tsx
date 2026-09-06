import React, { useState, useEffect, useCallback } from 'react';
import { api, type KickReason, type Player, type PlayerDetail } from '../lib/api';
import { GiftIcon } from './Icons';
import { GiftItemModal } from './GiftItemModal';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}

function StatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}

const kickReasonOptions: { value: KickReason; label: string; help: string }[] = [
  { value: 'bug_glitch', label: 'Bug / glitch karakter', help: 'Posisi, animasi, atau state karakter bermasalah.' },
  { value: 'skill_glitch', label: 'Glitch skill', help: 'Skill macet, cooldown, atau efek combat tidak normal.' },
  { value: 'afk_botting', label: 'AFK / indikasi botting', help: 'Sesi perlu dihentikan untuk pemeriksaan operator.' },
  { value: 'other', label: 'Alasan lainnya', help: 'Tambahkan catatan singkat untuk audit.' },
];

function ClassCrestAvatar({
  classIcon,
  className,
  isFemale,
  size = 'md',
  bgColor,
}: {
  classIcon?: string;
  className?: string;
  isFemale: boolean;
  size?: 'md' | 'lg';
  bgColor?: string;
}) {
  const iconFile = classIcon ? `${classIcon.toLowerCase()}.webp` : 'wp0101.webp';
  return (
    <div
      className={`char-crest-avatar ${size} ${isFemale ? 'female' : 'male'}`}
      title={`${className || 'Adventurer'} (${isFemale ? 'Wanita ♀' : 'Pria ♂'})`}
    >
      <div className="crest-shield" style={bgColor ? { background: bgColor } : undefined}>
        <img
          src={`/ops/class-icons/${iconFile}`}
          alt={className || 'Class Crest'}
          className="crest-symbol-img"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/ops/class-icons/wp0101.webp';
          }}
        />
      </div>
      <span className={`crest-gender-tag ${isFemale ? 'female' : 'male'}`} title={isFemale ? 'Wanita' : 'Pria'}>
        {isFemale ? '♀' : '♂'}
      </span>
    </div>
  );
}

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftTargetPlayer, setGiftTargetPlayer] = useState<Player | null>(null);
  const [giftNotice, setGiftNotice] = useState('');
  const [kickTarget, setKickTarget] = useState<Player | null>(null);
  const [kickReason, setKickReason] = useState<KickReason | ''>('');
  const [kickNote, setKickNote] = useState('');
  const [kickPending, setKickPending] = useState(false);
  const [kickError, setKickError] = useState('');
  const [kickNotice, setKickNotice] = useState('');

  const closeKickDialog = () => {
    if (kickPending) return;
    setKickTarget(null); setKickReason(''); setKickNote(''); setKickError('');
  };

  const kickPlayer = async () => {
    if (!kickTarget || !kickReason) return;
    setKickPending(true); setKickError('');
    try {
      const result = await api.kickPlayer(kickTarget.id, kickReason, kickNote);
      setPlayers((current) => current.map((player) => player.id === kickTarget.id ? { ...player, online: false } : player));
      setKickNotice(result.message);
      setSelectedPlayer((current) => current?.id === kickTarget.id ? { ...current, online: false } : current);
      setKickTarget(null); setKickReason(''); setKickNote('');
    } catch (e) {
      setKickError(e instanceof Error ? e.message : 'Koneksi karakter gagal diputus.');
    } finally { setKickPending(false); }
  };

  const openDetail = async (player: Player) => {
    setSelectedPlayer(player); setDetail(null); setDetailError('');
    try { setDetail((await api.playerDetail(player.id)).detail); }
    catch (e) { setDetailError(e instanceof Error ? e.message : 'Detail tambahan gagal dimuat.'); }
  };

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        const result = await api.players(search, controller.signal);
        if (controller.signal.aborted) return;
        setPlayers(result.players);
        setError('');
      } catch (e) {
        if (controller.signal.aborted) return;
        setPlayers([]);
        setError(e instanceof Error ? e.message : 'Data pemain gagal dimuat.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(load, 5000);
        }
      }
    };

    timer = setTimeout(load, 280);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPlayer(null);
        if (!kickPending) {
          setKickTarget(null); setKickReason(''); setKickNote(''); setKickError('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [kickPending]);

  const formatNumber = (num?: number) => {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('id-ID');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="panel table-panel">
      <header>
        <div>
          <p className="kicker">Character Registry</p>
          <h3>Direktori Karakter & Pemain</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-gift-main"
            onClick={() => {
              setGiftTargetPlayer(null);
              setShowGiftModal(true);
            }}
          >
            <GiftIcon width={16} height={16} />
            Kirim Gift Item
          </button>
          <label className="search-box">
            <SearchIcon />
            <input
              placeholder="Cari nama karakter atau akun…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </header>

      {kickNotice && <div className="notice kick-success">{kickNotice}</div>}
      {giftNotice && (
        <div className="notice success" style={{ marginBottom: '12px' }}>
          {giftNotice}
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Karakter</th>
              <th>Class / Senjata</th>
              <th>Status</th>
              <th>Level</th>
              <th>Lokasi Terakhir</th>
              <th>Terakhir Terlihat</th>
              <th style={{ textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const isFemale = player.genderId === 2 || player.gender === 'Female';
              const weaponFile = player.classIcon ? `${player.classIcon}.webp` : 'wp0101.webp';

              return (
                <tr key={player.id}>
                  <td>
                    <div className="char-cell">
                      <ClassCrestAvatar
                        classIcon={player.classIcon}
                        className={player.className}
                        isFemale={isFemale}
                        size="md"
                        bgColor={player.classBg}
                      />
                      <div className="char-info-col">
                        <div className="char-name-row">
                          <strong>{player.name}</strong>
                          <span className={`gender-badge ${isFemale ? 'female' : 'male'}`} title={isFemale ? 'Wanita' : 'Pria'}>
                            {isFemale ? '♀' : '♂'}
                          </span>
                        </div>
                        <span className="char-acc-sub">
                          #{player.id} {player.accountName ? `• @${player.accountName}` : ''}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="class-col-cell">
                      <div className="class-crest-icon">
                        <img
                          src={`/ops/class-icons/${weaponFile}`}
                          alt={player.className || 'Class'}
                          loading="lazy"
                        />
                      </div>
                      <div className="class-text-details">
                        <span className="class-primary-name">{player.className || 'Adventurer'}</span>
                        {player.subClassName && (
                          <span className="class-sub-name">Sub: {player.subClassName}</span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`status-pill ${player.online ? 'online' : ''}`}>
                      <i />
                      {player.online ? 'Online' : 'Offline'}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                      Lv. {player.level}
                    </span>
                  </td>

                  <td>
                    <span style={{ color: '#cbd5e1', fontSize: '13px' }}>
                      {player.mapName || 'Zone #1'}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {player.online ? (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>Sekarang</span>
                      ) : (
                        formatDate(player.lastSeen)
                      )}
                    </span>
                  </td>

                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="detail-stat-btn"
                      onClick={() => void openDetail(player)}
                      title="Lihat Detail Statistik Karakter"
                    >
                      <StatIcon />
                      Detail
                    </button>
                    <button
                      type="button"
                      className="btn-gift-row"
                      onClick={() => {
                        setGiftTargetPlayer(player);
                        setShowGiftModal(true);
                      }}
                      title={`Kirim Gift Item ke ${player.name}`}
                    >
                      <GiftIcon width={12} height={12} />
                      Gift
                    </button>
                    <button
                      type="button"
                      className="btn-kick-row"
                      disabled={!player.online}
                      onClick={() => { setKickTarget(player); setKickReason(''); setKickNote(''); setKickError(''); }}
                      title={player.online ? `Putus koneksi ${player.name}` : 'Karakter sedang offline'}
                    >
                      <DisconnectIcon />
                      Kick
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && !players.length && (
          <div className="empty">Tidak ada karakter yang cocok.</div>
        )}
        {loading && <div className="empty">Membaca registry…</div>}
      </div>

      {/* Detail Stat Modal Popup */}
      {selectedPlayer && (
        <div
          className="player-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPlayer(null);
          }}
        >
          <div className="player-modal-content">
            {/* Hero Header */}
            {(() => {
              const isFemale = selectedPlayer.genderId === 2 || selectedPlayer.gender === 'Female';
              const hpPercent = selectedPlayer.maxHp && selectedPlayer.maxHp > 0
                ? Math.min(100, Math.round(((selectedPlayer.hp ?? 0) / selectedPlayer.maxHp) * 100))
                : 100;
              const mpPercent = selectedPlayer.maxMp && selectedPlayer.maxMp > 0
                ? Math.min(100, Math.round(((selectedPlayer.mp ?? 0) / selectedPlayer.maxMp) * 100))
                : 0;

              return (
                <>
                  <div className="modal-header-hero">
                    <ClassCrestAvatar
                      classIcon={selectedPlayer.classIcon}
                      className={selectedPlayer.className}
                      isFemale={isFemale}
                      size="lg"
                      bgColor={selectedPlayer.classBg}
                    />

                    <div className="modal-hero-details">
                      <div className="modal-hero-title-row">
                        <span className="modal-hero-name">{selectedPlayer.name}</span>
                        <span className={`status-pill ${selectedPlayer.online ? 'online' : ''}`}>
                          <i />
                          {selectedPlayer.online ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="modal-hero-tags">
                        <span className="modal-tag class">
                          Class: {selectedPlayer.className || 'Adventurer'}
                          {selectedPlayer.subClassName ? ` / ${selectedPlayer.subClassName}` : ''}
                        </span>
                        <span className="modal-tag">Level {selectedPlayer.level}</span>
                        <span className="modal-tag">
                          {isFemale ? '♀ Perempuan' : '♂ Laki-laki'}
                        </span>
                        <span className="modal-tag">
                          Akun: {selectedPlayer.accountName || '—'} (#{selectedPlayer.id})
                        </span>
                      </div>
                    </div>

                    <button
                      className="modal-close-btn"
                      onClick={() => setSelectedPlayer(null)}
                      title="Tutup (Esc)"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="modal-body">
                    <div className="stat-cards-grid">
                      {/* Vital Status Card */}
                      <div className="stat-group-card">
                        <div className="stat-group-title">
                          <span>❤️</span> Status Vitalitas
                        </div>
                        <div className="stat-rows">
                          <div>
                            <div className="stat-row-item">
                              <span className="stat-label">Health Points (HP)</span>
                              <span className="stat-val" style={{ color: '#34d399' }}>
                                {formatNumber(selectedPlayer.hp)} / {formatNumber(selectedPlayer.maxHp)}
                              </span>
                            </div>
                            <div className="stat-bar-container">
                              <div className="stat-bar-fill hp" style={{ width: `${hpPercent}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="stat-row-item">
                              <span className="stat-label">Mana / Energy (MP)</span>
                              <span className="stat-val" style={{ color: '#60a5fa' }}>
                                {formatNumber(selectedPlayer.mp)} / {formatNumber(selectedPlayer.maxMp)}
                              </span>
                            </div>
                            <div className="stat-bar-container">
                              <div className="stat-bar-fill mp" style={{ width: `${mpPercent}%` }} />
                            </div>
                          </div>

                          <div className="stat-row-item" style={{ marginTop: '4px' }}>
                            <span className="stat-label">Skill Points (SP)</span>
                            <span className="stat-val">{formatNumber(selectedPlayer.skillPoint)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Currency & Finance Card */}
                      <div className="stat-group-card">
                        <div className="stat-group-title">
                          <span>🪙</span> Keuangan & Kekayaan
                        </div>
                        <div className="stat-rows">
                          <div className="stat-row-item">
                            <span className="stat-label">Gold Bebas</span>
                            <span className="stat-val" style={{ color: '#fbbf24' }}>
                              {formatNumber(selectedPlayer.gold)} G
                            </span>
                          </div>
                          <div className="stat-row-item">
                            <span className="stat-label">Bound Gold</span>
                            <span className="stat-val" style={{ color: '#cbd5e1' }}>
                              {formatNumber(selectedPlayer.bindGold)} G
                            </span>
                          </div>
                          <div className="stat-row-item">
                            <span className="stat-label">Crafting Score</span>
                            <span className="stat-val">
                              {formatNumber(selectedPlayer.craftingScore)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Location & Coordinates Card */}
                      <div className="stat-group-card">
                        <div className="stat-group-title">
                          <span>📍</span> Lokasi & Posisi World
                        </div>
                        <div className="stat-rows">
                          <div className="stat-row-item">
                            <span className="stat-label">Wilayah (Zone)</span>
                            <span className="stat-val" style={{ color: '#38bdf8' }}>
                              {selectedPlayer.mapName} (ID: {selectedPlayer.nodeId ?? 1})
                            </span>
                          </div>
                          <div className="stat-row-item">
                            <span className="stat-label">Koordinat (X, Y)</span>
                            <span className="stat-val">
                              X: {selectedPlayer.x ?? 0} | Y: {selectedPlayer.y ?? 0}
                            </span>
                          </div>
                          <div className="stat-row-item">
                            <span className="stat-label">Elevasi (Z)</span>
                            <span className="stat-val">{selectedPlayer.z ?? 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Combat & Arena Record Card */}
                      <div className="stat-group-card">
                        <div className="stat-group-title">
                          <span>⚔️</span> Rekor PvP & Medan Pertempuran
                        </div>
                        <div className="stat-rows">
                          <div className="stat-row-item">
                            <span className="stat-label">Centurion Battlefield</span>
                            <span className="stat-val">
                              {selectedPlayer.csKillNum ?? 0} Kill / {selectedPlayer.csWinNum ?? 0} Menang
                            </span>
                          </div>
                          <div className="stat-row-item">
                            <span className="stat-label">Battlefield (BF)</span>
                            <span className="stat-val">
                              {selectedPlayer.bfKillNum ?? 0} Kill / {selectedPlayer.bfWinNum ?? 0} Menang
                            </span>
                          </div>
                          <div className="stat-row-item">
                            <span className="stat-label">Riwayat Karakter</span>
                            <span className="stat-val" style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Dibuat: {formatDate(selectedPlayer.createTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="stat-group-card player-extra-detail">
                      <div className="stat-group-title"><span>📚</span> Progres & Akun</div>
                      {!detail && !detailError && <div className="stat-label">Memuat detail karakter…</div>}
                      {detailError && <div className="notice error">{detailError}</div>}
                      {detail && <div className="stat-rows">
                        <div className="stat-row-item"><span className="stat-label">EXP / terakhir level-up</span><span className="stat-val">{formatNumber(detail.exp)} · {formatDate(detail.lastLevelUp)}</span></div>
                        <div className="stat-row-item"><span className="stat-label">Family</span><span className="stat-val">{detail.family ? `${detail.family.name} Lv.${detail.family.level} · Kontribusi ${formatNumber(detail.family.contribution)}` : 'Tidak bergabung'}</span></div>
                        <div className="stat-row-item"><span className="stat-label">Achievement</span><span className="stat-val">{formatNumber(detail.achievement.points)} poin · {formatNumber(detail.achievement.coins)} coin</span></div>
                        <div className="stat-row-item"><span className="stat-label">Sosial</span><span className="stat-val">{detail.friends} teman · {detail.unreadMail} mail belum dibuka</span></div>
                        <div className="stat-row-item"><span className="stat-label">Karakter pada akun</span><span className="stat-val">{detail.accountCharacters.map(c => `${c.name} (Lv.${c.level})`).join(', ') || '—'}</span></div>
                      </div>}
                    </div>
                    {detail && <div className="stat-cards-grid player-extra-detail">
                      <div className="stat-group-card"><div className="stat-group-title"><span>🛡️</span> Equipment & Inventori</div><div className="stat-rows"><div className="stat-row-item"><span className="stat-label">Equipment terpasang</span><span className="stat-val">{detail.equipment.equipped} item · +{detail.equipment.avgEnhance} rata-rata · +{detail.equipment.maxEnhance} tertinggi</span></div><div className="stat-row-item"><span className="stat-label">Inventory</span><span className="stat-val">{detail.inventory.items} item · {detail.inventory.locked} terkunci · Storage +{detail.inventory.expandedStorage}</span></div></div></div>
                      <div className="stat-group-card"><div className="stat-group-title"><span>✨</span> Progres Lanjutan</div><div className="stat-rows"><div className="stat-row-item"><span className="stat-label">Class terlatih</span><span className="stat-val">{detail.classes.map(c => `#${c.classId} Lv.${c.level}`).join(', ') || '—'}</span></div><div className="stat-row-item"><span className="stat-label">Sky Tower / Weapon Expert</span><span className="stat-val">{detail.skyTower ? `${detail.skyTower.highest} (percobaan ${detail.skyTower.attempts})` : '—'} · {detail.weaponExpert ? `Tipe ${detail.weaponExpert.type} Lv.${detail.weaponExpert.level}` : '—'}</span></div><div className="stat-row-item"><span className="stat-label">Potential</span><span className="stat-val">{detail.potential ? `ATK ${detail.potential.atk} · DEF ${detail.potential.def} · Total ${detail.potential.total}` : '—'}</span></div></div></div>
                    </div>}
                  </div>

                  <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-gift-modal"
                      onClick={() => {
                        setGiftTargetPlayer(selectedPlayer);
                        setShowGiftModal(true);
                      }}
                    >
                      <GiftIcon width={16} height={16} />
                      Kirim Gift Item ke {selectedPlayer.name}
                    </button>
                    <button
                      className="modal-btn-close"
                      onClick={() => setSelectedPlayer(null)}
                    >
                      Tutup
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {kickTarget && (
        <div className="kick-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeKickDialog();
        }}>
          <section className="kick-modal" role="dialog" aria-modal="true" aria-labelledby="kick-dialog-title">
            <header>
              <div className="kick-warning-mark"><DisconnectIcon /></div>
              <div><h3 id="kick-dialog-title">Putus koneksi karakter?</h3><p>Aksi ini langsung mengakhiri sesi aktif melalui ZoneServer CGI.</p></div>
            </header>
            <div className="kick-target-summary">
              <strong>{kickTarget.name}</strong>
              <span>#{kickTarget.id}{kickTarget.accountName ? ` · @${kickTarget.accountName}` : ''}</span>
              <span>{kickTarget.mapName || `Zone #${kickTarget.nodeId ?? 1}`} · Level {kickTarget.level}</span>
            </div>
            <fieldset className="kick-reasons">
              <legend>Alasan pemutusan</legend>
              {kickReasonOptions.map((option) => <label key={option.value} className={kickReason === option.value ? 'selected' : ''}>
                <input type="radio" name="kick-reason" value={option.value} checked={kickReason === option.value} onChange={() => { setKickReason(option.value); setKickError(''); }} />
                <span><strong>{option.label}</strong><small>{option.help}</small></span>
              </label>)}
            </fieldset>
            <label className="kick-note"><span>Catatan {kickReason === 'other' ? '(wajib)' : '(opsional)'}</span><textarea rows={3} maxLength={240} value={kickNote} onChange={(event) => setKickNote(event.target.value)} placeholder="Konteks singkat untuk log audit…" /><small>{kickNote.length}/240</small></label>
            {kickError && <div className="notice error">{kickError}</div>}
            <footer><button type="button" className="modal-btn-close" onClick={closeKickDialog} disabled={kickPending}>Batal</button><button type="button" className="kick-confirm-button" onClick={() => void kickPlayer()} disabled={kickPending || !kickReason || (kickReason === 'other' && kickNote.trim().length < 3)}>{kickPending ? 'Memutus koneksi…' : 'Putus koneksi'}</button></footer>
          </section>
        </div>
      )}

      {/* Gift Item Modal Component */}
      <GiftItemModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        prefillPlayer={giftTargetPlayer}
        playersList={players}
        onSuccess={(msg) => setGiftNotice(msg)}
      />
    </section>
  );
}
