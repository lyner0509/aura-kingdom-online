import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  api,
  type Player,
  type ItemIndexItem,
  type GiftSettings,
  type GiftHistoryEntry,
  type SendGiftPayload,
} from '../lib/api';
import { ItemIcon } from './ItemIcon';
import {
  MailIcon,
  SendIcon,
  SearchIcon,
  CheckIcon,
  RefreshIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from './Icons';

interface GiftItemPageProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export function GiftItemPage({ onDirtyChange }: GiftItemPageProps) {
  const [activeTab, setActiveTab] = useState<'send' | 'settings' | 'history'>('send');

  // Settings State
  const [settings, setSettings] = useState<GiftSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<GiftSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // History State
  const [history, setHistory] = useState<GiftHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Players list for quick suggestion
  const [players, setPlayers] = useState<Player[]>([]);

  // Send Gift Form State
  const [targetType, setTargetType] = useState<'character' | 'online' | 'all'>('character');
  const [targetQuery, setTargetQuery] = useState('');
  const [selectedCharacterName, setSelectedCharacterName] = useState('');

  // Item selection
  const [itemId, setItemId] = useState<number | ''>('');
  const [itemName, setItemName] = useState('');
  const [itemCount, setItemCount] = useState<number>(1);
  const [isBound, setIsBound] = useState<boolean>(true);
  const [gold, setGold] = useState<number>(0);

  // Mail contents
  const [senderName, setSenderName] = useState('');
  const [mailTitle, setMailTitle] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [announce, setAnnounce] = useState<boolean>(false);
  const [announceMessage, setAnnounceMessage] = useState('');

  // Item Search State
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ItemIndexItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Notifications & Execution status
  const [submitting, setSubmitting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dirty detection for settings
  const dirty =
    !!settings &&
    !!settingsForm &&
    JSON.stringify(settings) !== JSON.stringify(settingsForm);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  // Load Settings
  const loadSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const s = await api.giftSettings();
      setSettings(s);
      setSettingsForm(s);
      if (!senderName) setSenderName(s.default_sender_name);
      if (!mailTitle) setMailTitle(s.default_mail_title);
      if (!mailContent) setMailContent(s.default_mail_content);
      setIsBound(s.default_is_bound);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat pengaturan surat default.');
    } finally {
      setSettingsLoading(false);
    }
  }, [senderName, mailTitle, mailContent]);

  // Load History
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const h = await api.giftHistory(50);
      setHistory(h);
    } catch (err) {
      console.error('Failed to load gift history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load active players for helper suggestions
  useEffect(() => {
    api.players({ limit: 100 })
      .then((res) => setPlayers(res.players))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadHistory();
  }, [loadSettings, loadHistory]);

  // Handle Search Outside Click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node)
      ) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Items in Catalog
  useEffect(() => {
    const trimmed = itemSearchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.itemIndex({ q: trimmed, limit: 12 });
        setSearchResults(res.items);
        setShowItemDropdown(true);
      } catch (err) {
        console.error('Failed to search items:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [itemSearchQuery]);

  // Handle Select Item
  const handleSelectItem = (item: ItemIndexItem) => {
    setItemId(item.id);
    setItemName(item.name);
    setIsBound(item.isTradable === false);
    setShowItemDropdown(false);
    setItemSearchQuery('');
  };

  // Save Settings Tab
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;

    setErrorMsg('');
    setSuccessMsg('');
    setSavingSettings(true);

    try {
      const updated = await api.saveGiftSettings({
        default_sender_name: settingsForm.default_sender_name,
        default_mail_title: settingsForm.default_mail_title,
        default_mail_content: settingsForm.default_mail_content,
        default_is_bound: settingsForm.default_is_bound,
        allow_online_broadcast: settingsForm.allow_online_broadcast,
      });
      setSettings(updated);
      setSettingsForm(updated);
      setSuccessMsg('Pengaturan template surat default berhasil disimpan!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Submit Send Gift
  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!itemId || Number(itemId) <= 0) {
      setErrorMsg('Pilih atau masukkan Item ID yang valid.');
      return;
    }
    if (itemCount < 1) {
      setErrorMsg('Jumlah item minimal 1.');
      return;
    }
    if (targetType === 'character' && !targetQuery.trim()) {
      setErrorMsg('Masukkan Nama Karakter atau ID Karakter tujuan.');
      return;
    }

    const confirmTarget =
      targetType === 'character'
        ? `karakter ${selectedCharacterName || targetQuery}`
        : targetType === 'online'
        ? 'SEMUA PEMAIN YANG SEDANG ONLINE'
        : 'SELURUH AKUN / KARAKTER SERVER';

    if (
      !window.confirm(
        `Kirim hadiah ${itemName || `Item #${itemId}`} (x${itemCount}) ke ${confirmTarget}? Item akan langsung masuk ke kotak surat in-game.`
      )
    ) {
      return;
    }

    setSubmitting(true);

    try {
      const payload: SendGiftPayload = {
        target_type: targetType,
        target_query: targetType === 'character' ? targetQuery.trim() : undefined,
        item_id: Number(itemId),
        item_name: itemName.trim() || undefined,
        item_count: Number(itemCount),
        is_bound: isBound,
        gold: Number(gold) || 0,
        sender_name: senderName.trim() || undefined,
        title: mailTitle.trim() || undefined,
        content: mailContent.trim() || undefined,
        announce,
        announce_message: announce ? announceMessage.trim() : undefined,
      };

      const res = await api.sendGift(payload);
      setSuccessMsg(res.message);

      // Refresh history
      void loadHistory();

      // Reset item inputs
      setItemId('');
      setItemName('');
      setItemCount(1);
      setGold(0);
      setAnnounce(false);
      setAnnounceMessage('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirimkan hadiah ke mail.');
    } finally {
      setSubmitting(false);
    }
  };

  const onlinePlayersCount = players.filter((p) => p.online).length;

  return (
    <div className="gift-page-container">
      <section className="panel">
        <header className="starterpack-header">
          <div>
            <p className="kicker">In-Game Logistics & Player Rewards</p>
            <h3>Gift Item ke Pemain (In-Game Mailbox)</h3>
            <p>
              Kirimkan item hadiah, perlengkapan, bahan crafting, atau gold langsung ke kotak surat (*mailbox*) pemain secara instan melalui sistem antrean ZoneServer CGI.
            </p>
          </div>
          <div className="starterpack-actions">
            <button
              className="starterpack-btn-secondary"
              onClick={() => {
                void loadSettings();
                void loadHistory();
              }}
              disabled={settingsLoading || historyLoading || submitting}
            >
              <RefreshIcon className={settingsLoading || historyLoading ? 'spin' : ''} />
              Segarkan
            </button>
            {activeTab === 'settings' && (
              <button
                className="starterpack-btn-primary"
                onClick={handleSaveSettings}
                disabled={savingSettings || !dirty}
              >
                Simpan Pengaturan
              </button>
            )}
          </div>
        </header>

        {successMsg && <div className="notice">{successMsg}</div>}
        {errorMsg && <div className="notice error">{errorMsg}</div>}

        {/* Metric Cards Strip */}
        <div className="starterpack-stats-strip" style={{ marginBottom: 20 }}>
          <article className="starterpack-stat-card">
            <span className="card-kicker">Status Mail Queue</span>
            <div className="card-value">
              <span className="status-badge active">Aktif &amp; Terhubung</span>
            </div>
            <span className="card-tag">ZoneServer CGI 20060</span>
          </article>

          <article className="starterpack-stat-card">
            <span className="card-kicker">Pemain Sedang Online</span>
            <div className="card-value">
              {onlinePlayersCount}
              <span>Pemain</span>
            </div>
            <span className="card-tag">Siap Menerima Notifikasi Instan</span>
          </article>

          <article className="starterpack-stat-card">
            <span className="card-kicker">Total Hadiah Terkirim</span>
            <div className="card-value">
              {history.length}
              <span>Transaksi</span>
            </div>
            <span className="card-tag">Tercatat di Audit Trail</span>
          </article>

          <article className="starterpack-stat-card">
            <span className="card-kicker">Pengirim Default</span>
            <div className="card-value" style={{ fontSize: '1.25rem' }}>
              {settings?.default_sender_name || 'Game Master'}
            </div>
            <span className="card-tag">{settings?.default_is_bound ? 'Item Terikat (Bound)' : 'Item Bebas (Tradeable)'}</span>
          </article>
        </div>

        {/* Navigation Tabs */}
        <div className="starterpack-tab-bar" style={{ marginBottom: 20 }}>
          <button
            className={`starterpack-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('send');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <SendIcon width={14} height={14} /> Kirim Hadiah Item
          </button>
          <button
            className={`starterpack-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              setErrorMsg('');
              setSuccessMsg('');
              void loadHistory();
            }}
          >
            <MailIcon width={14} height={14} /> Riwayat Pengiriman ({history.length})
          </button>
          <button
            className={`starterpack-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <SparklesIcon width={14} height={14} /> Template Default Surat
          </button>
        </div>

        {/* TAB 1: SEND GIFT */}
        {activeTab === 'send' && (
          <form onSubmit={handleSendGift} className="gift-modal-form">
            <div className="gift-form-grid">
              {/* Left Column: Target & Item Picker */}
              <div className="gift-form-column">
                <div className="gift-section-title">
                  <UsersIcon width={16} height={16} /> 1. Penerima Hadiah
                </div>

                {/* Target Type Picker */}
                <div className="gift-target-selector">
                  <label className={`target-option-card ${targetType === 'character' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="targetType"
                      value="character"
                      checked={targetType === 'character'}
                      onChange={() => setTargetType('character')}
                    />
                    <div className="target-card-body">
                      <strong>Karakter Tertentu</strong>
                      <span>Kirim ke 1 karakter spesifik (Nama / ID Karakter)</span>
                    </div>
                  </label>

                  <label className={`target-option-card ${targetType === 'online' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="targetType"
                      value="online"
                      checked={targetType === 'online'}
                      onChange={() => setTargetType('online')}
                    />
                    <div className="target-card-body">
                      <strong>Semua Pemain Online</strong>
                      <span>Kirim ke seluruh karakter yang sedang online saat ini ({onlinePlayersCount} pemain)</span>
                    </div>
                  </label>

                  <label className={`target-option-card ${targetType === 'all' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="targetType"
                      value="all"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                    />
                    <div className="target-card-body">
                      <strong>Semua Karakter Server</strong>
                      <span>Kirim massal ke seluruh database karakter terdaftar</span>
                    </div>
                  </label>
                </div>

                {/* Single Character Query Input */}
                {targetType === 'character' && (
                  <div className="field-group" style={{ marginTop: 12 }}>
                    <label>Nama Karakter atau ID Karakter Tujuan <span className="req">*</span></label>
                    <div className="target-input-wrapper">
                      <input
                        type="text"
                        placeholder="Contoh: Lynerouxes atau 50000002"
                        value={targetQuery}
                        onChange={(e) => {
                          setTargetQuery(e.target.value);
                          setSelectedCharacterName('');
                        }}
                        required
                      />
                    </div>
                    {/* Fast Suggestions from Online / Recent Players */}
                    {players.length > 0 && !selectedCharacterName && (
                      <div className="character-chips-list">
                        <span className="chips-label">Pilihan Cepat:</span>
                        {players.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="character-chip"
                            onClick={() => {
                              setTargetQuery(p.name);
                              setSelectedCharacterName(p.name);
                            }}
                          >
                            <span className={`chip-dot ${p.online ? 'online' : ''}`} />
                            {p.name} <small>(Lv.{p.level})</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section: Item Selection */}
                <div className="gift-section-title" style={{ marginTop: 24 }}>
                  <SparklesIcon width={16} height={16} /> 2. Pilih Item &amp; Kuantitas
                </div>

                {/* Interactive Catalog Search */}
                <div className="field-group search-catalog-wrapper" ref={searchDropdownRef}>
                  <label>Pencarian Katalog Item (38.000+ Item)</label>
                  <div className="catalog-search-input">
                    <SearchIcon width={15} height={15} className="search-icon-inside" />
                    <input
                      type="text"
                      placeholder="Ketik nama item atau ID (misal: Backpack, XP, Potion, Ruby)..."
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowItemDropdown(true);
                      }}
                    />
                    {searchLoading && <span className="search-spinner-text">Mencari...</span>}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showItemDropdown && searchResults.length > 0 && (
                    <div className="catalog-dropdown-results">
                      {searchResults.map((item) => (
                        <div
                          key={item.id}
                          className="catalog-dropdown-item"
                          onClick={() => handleSelectItem(item)}
                        >
                          <ItemIcon itemId={item.id} icon={item.icon} size={32} name={item.name} />
                          <div className="dropdown-item-meta">
                            <strong>{item.name}</strong>
                            <span className="item-submeta">
                              ID: <code>{item.id}</code> · Kategori: {item.category} ·{' '}
                              {item.isTradable ? (
                                <span className="tradable-badge">Tradeable</span>
                              ) : (
                                <span className="bound-badge">Bound</span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Item Preview Box */}
                <div className="selected-item-box">
                  <div className="selected-item-preview">
                    <ItemIcon
                      itemId={itemId ? Number(itemId) : undefined}
                      size={44}
                      name={itemName || 'Item'}
                    />
                    <div className="selected-item-info">
                      <div className="item-title-row">
                        <h4>{itemName || (itemId ? `Item ID #${itemId}` : 'Belum Ada Item Terpilih')}</h4>
                        {isBound ? (
                          <span className="item-bound-pill">Terikat (Bound)</span>
                        ) : (
                          <span className="item-tradeable-pill">Dapat Ditransaksikan</span>
                        )}
                      </div>
                      <p className="item-hint">
                        {itemId ? `Item ID: ${itemId}` : 'Gunakan pencarian di atas atau isi ID secara manual.'}
                      </p>
                    </div>
                  </div>

                  {/* Manual Inputs for ID & Name if needed */}
                  <div className="id-count-row">
                    <div className="field-group id-field">
                      <label>Item ID <span className="req">*</span></label>
                      <input
                        type="number"
                        placeholder="Contoh: 40358"
                        value={itemId}
                        onChange={(e) => setItemId(e.target.value ? parseInt(e.target.value, 10) : '')}
                        required
                        min="1"
                      />
                    </div>
                    <div className="field-group name-field">
                      <label>Nama Item</label>
                      <input
                        type="text"
                        placeholder="Nama Item (opsional)"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Quantity & Shortcut Presets */}
                  <div className="count-gold-row">
                    <div className="field-group count-field">
                      <label>Jumlah Item <span className="req">*</span></label>
                      <div className="counter-input-row">
                        <input
                          type="number"
                          value={itemCount}
                          onChange={(e) => setItemCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          min="1"
                          max="9999"
                          required
                        />
                        <div className="preset-count-btns">
                          {[1, 5, 10, 50, 99].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              className={`count-preset-btn ${itemCount === cnt ? 'active' : ''}`}
                              onClick={() => setItemCount(cnt)}
                            >
                              +{cnt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="field-group gold-field">
                      <label>Lampiran Gold (Mata Uang)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={gold}
                        onChange={(e) => setGold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Bound Switcher */}
                  <div className="bound-toggle-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={isBound}
                        onChange={(e) => setIsBound(e.target.checked)}
                      />
                      <span>
                        <strong>Kirim sebagai Item Terikat (Account Bound)</strong>
                        <small>Jika dicentang, pemain tidak dapat memperjualbelikan item ini ke pemain lain.</small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Mail Customization & Live Preview */}
              <div className="gift-form-column">
                <div className="gift-section-title">
                  <MailIcon width={16} height={16} /> 3. Kustomisasi Surat In-Game
                </div>

                <div className="field-group">
                  <label>Nama Pengirim Surat</label>
                  <input
                    type="text"
                    placeholder="Contoh: Game Master / Arthur / Event GM"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    maxLength={32}
                  />
                </div>

                <div className="field-group">
                  <label>Judul Surat</label>
                  <input
                    type="text"
                    placeholder="Contoh: [Hadiah GM] Hadiah Spesial Petualang"
                    value={mailTitle}
                    onChange={(e) => setMailTitle(e.target.value)}
                    maxLength={40}
                  />
                </div>

                <div className="field-group">
                  <label>Isi Pesan Surat</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan ucapan selamat atau instruksi penggunaan hadiah untuk pemain..."
                    value={mailContent}
                    onChange={(e) => setMailContent(e.target.value)}
                    maxLength={500}
                  />
                </div>

                {/* In-Game Announce Broadcast Option */}
                <div className="announce-card-box">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={announce}
                      onChange={(e) => setAnnounce(e.target.checked)}
                    />
                    <span>
                      <strong>Siarkan Notifikasi In-Game (Banner Broadcast)</strong>
                      <small>Muncul sebagai running text pengumuman di layar semua petualang Azuria.</small>
                    </span>
                  </label>

                  {announce && (
                    <div className="field-group announce-input" style={{ marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="Contoh: Petualang beruntung telah menerima hadiah spesial dari GM!"
                        value={announceMessage}
                        onChange={(e) => setAnnounceMessage(e.target.value)}
                        maxLength={100}
                      />
                    </div>
                  )}
                </div>

                {/* Live Preview Card */}
                <div className="mailbox-preview-card">
                  <div className="mailbox-preview-header">
                    <MailIcon width={14} height={14} /> Live In-Game Mailbox Preview
                  </div>
                  <div className="mailbox-envelope">
                    <div className="envelope-sender-row">
                      <span className="env-label">Dari:</span>
                      <strong>{senderName || 'Game Master'}</strong>
                    </div>
                    <div className="envelope-title-row">
                      <span className="env-label">Judul:</span>
                      <span className="env-title">{mailTitle || '[Hadiah GM] Hadiah Spesial'}</span>
                    </div>
                    <div className="envelope-content-box">
                      {mailContent || 'Selamat! Kamu menerima hadiah item dari Game Master.'}
                    </div>
                    <div className="envelope-attachment-row">
                      <div className="attached-item">
                        <ItemIcon
                          itemId={itemId ? Number(itemId) : undefined}
                          size={32}
                          name={itemName || 'Hadiah'}
                        />
                        <div className="attached-meta">
                          <strong>{itemName || (itemId ? `Item #${itemId}` : 'Pilih Item')}</strong>
                          <span>x{itemCount} {isBound ? '(Bound)' : '(Tradeable)'}</span>
                        </div>
                      </div>
                      {gold > 0 && (
                        <div className="attached-gold">
                          <span>💰 {gold.toLocaleString('id-ID')} Gold</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="gift-modal-actions" style={{ marginTop: 24 }}>
                  <button
                    type="submit"
                    className="gift-submit-btn"
                    disabled={submitting || !itemId}
                  >
                    <ZapIcon width={16} height={16} />
                    {submitting ? 'Mengirimkan Surat...' : 'Kirim Hadiah ke Mail Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: SETTINGS TEMPLATE */}
        {activeTab === 'settings' && settingsForm && (
          <form onSubmit={handleSaveSettings} className="gift-settings-view">
            <div className="gift-settings-card">
              <h4>Konfigurasi Template Default Surat Hadiah</h4>
              <p>
                Nilai-nilai di bawah ini akan dijadikan template awal setiap kali Anda membuka formulir pengiriman hadiah item.
              </p>

              <div className="field-group">
                <label>Nama Pengirim Bawaan (Default Sender)</label>
                <input
                  type="text"
                  value={settingsForm.default_sender_name}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, default_sender_name: e.target.value })
                  }
                  maxLength={32}
                  required
                />
              </div>

              <div className="field-group">
                <label>Judul Surat Bawaan (Default Title)</label>
                <input
                  type="text"
                  value={settingsForm.default_mail_title}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, default_mail_title: e.target.value })
                  }
                  maxLength={40}
                  required
                />
              </div>

              <div className="field-group">
                <label>Isi Pesan Surat Bawaan (Default Content)</label>
                <textarea
                  rows={4}
                  value={settingsForm.default_mail_content}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, default_mail_content: e.target.value })
                  }
                  maxLength={500}
                  required
                />
              </div>

              <div className="bound-toggle-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settingsForm.default_is_bound}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, default_is_bound: e.target.checked })
                    }
                  />
                  <span>
                    <strong>Default Status Terikat (Account Bound)</strong>
                    <small>Secara bawaan item yang dikirimkan terikat dan tidak bisa ditukar pemain.</small>
                  </span>
                </label>
              </div>

              <div className="bound-toggle-row" style={{ marginTop: 12 }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settingsForm.allow_online_broadcast}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, allow_online_broadcast: e.target.checked })
                    }
                  />
                  <span>
                    <strong>Izinkan Broadcast Pengumuman Layar</strong>
                    <small>Admin dapat memilih untuk menyiarkan pesan banner saat mengirim hadiah.</small>
                  </span>
                </label>
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  className="starterpack-btn-primary"
                  disabled={savingSettings || !dirty}
                >
                  {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Template'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: AUDIT TRAIL HISTORY */}
        {activeTab === 'history' && (
          <div className="gift-history-view">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Operator</th>
                    <th>Target</th>
                    <th>Item Hadiah</th>
                    <th>Jumlah</th>
                    <th>Status / Gold</th>
                    <th>Pesan Surat</th>
                    <th>Pengiriman</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={8} className="empty-cell">Memuat riwayat pengiriman...</td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-cell">Belum ada riwayat pengiriman hadiah.</td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id}>
                        <td className="history-time-cell">
                          {new Date(h.created_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <span className="operator-badge">{h.operator}</span>
                        </td>
                        <td>
                          <strong>{h.target_name}</strong>
                          <span className="target-subtag">
                            {h.target_type === 'character'
                              ? 'Karakter'
                              : h.target_type === 'online'
                              ? 'Semua Online'
                              : 'Semua Server'}
                          </span>
                        </td>
                        <td>
                          <div className="table-item-cell">
                            <ItemIcon itemId={h.item_id} size={26} name={h.item_name} />
                            <div>
                              <strong>{h.item_name || `Item #${h.item_id}`}</strong>
                              <span className="item-id-quiet">#{h.item_id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="count-badge">x{h.item_count}</span>
                        </td>
                        <td>
                          <div className="status-gold-cell">
                            {h.is_bound ? (
                              <span className="bound-tag">Bound</span>
                            ) : (
                              <span className="trade-tag">Tradeable</span>
                            )}
                            {h.gold > 0 && <span className="gold-tag">+{h.gold.toLocaleString()} G</span>}
                          </div>
                        </td>
                        <td>
                          <div className="mail-summary-cell" title={h.content}>
                            <strong>{h.title}</strong>
                            <small>{h.content}</small>
                          </div>
                        </td>
                        <td>
                          <span className="delivery-badge-success">
                            <CheckIcon width={13} height={13} /> {h.delivered_count} Terkirim
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
