import React, { useState, useEffect, useCallback } from 'react';
import { api, type Player } from '../lib/api';

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

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

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
      if (e.key === 'Escape') setSelectedPlayer(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <label className="search-box">
          <SearchIcon />
          <input
            placeholder="Cari nama karakter atau akun…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </header>

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
              const avatarFile = player.avatarIcon ? `${player.avatarIcon}.webp` : (isFemale ? 'p00002.webp' : 'p00001.webp');
              const weaponFile = player.classIcon ? `${player.classIcon}.webp` : 'wp0101.webp';

              return (
                <tr key={player.id}>
                  <td>
                    <div className="char-cell">
                      <div className={`char-avatar-box ${isFemale ? 'female' : 'male'}`}>
                        <img
                          src={`/ops/avatars/${avatarFile}`}
                          alt={player.name}
                          className="char-avatar-img"
                          loading="lazy"
                          onError={(e) => {
                            // Fallback to default avatar
                            (e.currentTarget as HTMLImageElement).src = isFemale ? '/ops/avatars/p00002.webp' : '/ops/avatars/p00001.webp';
                          }}
                        />
                        <div className="char-weapon-badge" title={player.className || 'Class'}>
                          <img
                            src={`/ops/class-icons/${weaponFile}`}
                            alt={player.className || 'Class'}
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
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

                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="detail-stat-btn"
                      onClick={() => setSelectedPlayer(player)}
                      title="Lihat Detail Statistik Karakter"
                    >
                      <StatIcon />
                      Detail
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
              const avatarFile = selectedPlayer.avatarIcon ? `${selectedPlayer.avatarIcon}.webp` : (isFemale ? 'p00002.webp' : 'p00001.webp');
              const weaponFile = selectedPlayer.classIcon ? `${selectedPlayer.classIcon}.webp` : 'wp0101.webp';
              const hpPercent = selectedPlayer.maxHp && selectedPlayer.maxHp > 0
                ? Math.min(100, Math.round(((selectedPlayer.hp ?? 0) / selectedPlayer.maxHp) * 100))
                : 100;
              const mpPercent = selectedPlayer.maxMp && selectedPlayer.maxMp > 0
                ? Math.min(100, Math.round(((selectedPlayer.mp ?? 0) / selectedPlayer.maxMp) * 100))
                : 0;

              return (
                <>
                  <div className="modal-header-hero">
                    <div className={`modal-hero-avatar-box ${isFemale ? 'female' : 'male'}`}>
                      <img
                        src={`/ops/avatars/${avatarFile}`}
                        alt={selectedPlayer.name}
                        className="hero-avatar-img"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = isFemale ? '/ops/avatars/p00002.webp' : '/ops/avatars/p00001.webp';
                        }}
                      />
                      <div className="modal-hero-weapon-badge" title={selectedPlayer.className || 'Class'}>
                        <img
                          src={`/ops/class-icons/${weaponFile}`}
                          alt={selectedPlayer.className || 'Class'}
                        />
                      </div>
                    </div>

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
                  </div>

                  <div className="modal-footer">
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
    </section>
  );
}
