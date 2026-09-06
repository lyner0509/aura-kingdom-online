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
  GiftIcon,
  CloseIcon,
  SearchIcon,
  CheckIcon,
  RefreshIcon,
  SparklesIcon,
} from './Icons';

interface GiftItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillPlayer?: Player | null;
  playersList?: Player[];
  onSuccess?: (msg: string) => void;
}

export function GiftItemModal({
  isOpen,
  onClose,
  prefillPlayer,
  playersList = [],
  onSuccess,
}: GiftItemModalProps) {
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'settings'>('send');

  // Gift Form State
  const [targetType, setTargetType] = useState<'character' | 'online' | 'all'>('character');
  const [targetQuery, setTargetQuery] = useState('');
  const [selectedCharacterName, setSelectedCharacterName] = useState('');

  // Item selection
  const [itemId, setItemId] = useState<number | ''>('');
  const [itemName, setItemName] = useState('');
  const [itemCount, setItemCount] = useState<number>(1);
  const [isBound, setIsBound] = useState<boolean>(true);
  const [gold, setGold] = useState<number>(0);

  // Mail settings
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

  // Settings & History State
  const [settings, setSettings] = useState<GiftSettings | null>(null);
  const [history, setHistory] = useState<GiftHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load default settings
  const loadSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const s = await api.giftSettings();
      setSettings(s);
      if (!senderName) setSenderName(s.default_sender_name);
      if (!mailTitle) setMailTitle(s.default_mail_title);
      if (!mailContent) setMailContent(s.default_mail_content);
      setIsBound(s.default_is_bound);
    } catch (err) {
      console.error('Failed to load gift settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, [senderName, mailTitle, mailContent]);

  // Load history
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

  // Initialize modal data
  useEffect(() => {
    if (isOpen) {
      void loadSettings();
      setErrorMsg('');
      setSuccessMsg('');

      if (prefillPlayer) {
        setTargetType('character');
        setTargetQuery(String(prefillPlayer.id));
        setSelectedCharacterName(prefillPlayer.name);
      } else {
        setTargetQuery('');
        setSelectedCharacterName('');
      }
    }
  }, [isOpen, prefillPlayer, loadSettings]);

  // Handle active tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      void loadHistory();
    }
  }, [activeTab, loadHistory]);

  // Debounced item catalog search
  useEffect(() => {
    if (!itemSearchQuery.trim()) {
      setSearchResults([]);
      setShowItemDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.itemIndex({ q: itemSearchQuery.trim(), limit: 8 });
        setSearchResults(res.items);
        setShowItemDropdown(true);
      } catch (e) {
        console.error('Failed to search items:', e);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [itemSearchQuery]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Select an item from catalog dropdown
  const handleSelectItem = (item: ItemIndexItem) => {
    setItemId(item.id);
    setItemName(item.name);
    setIsBound(item.is_bound);
    setItemSearchQuery('');
    setShowItemDropdown(false);
  };

  // Submit Gift
  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || Number(itemId) <= 0) {
      setErrorMsg('Silakan pilih atau masukkan Item ID yang valid.');
      return;
    }

    if (targetType === 'character' && !targetQuery.trim()) {
      setErrorMsg('Nama atau ID karakter tujuan wajib diisi.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload: SendGiftPayload = {
        target_type: targetType,
        target_query: targetType === 'character' ? targetQuery.trim() : undefined,
        item_id: Number(itemId),
        item_name: itemName.trim() || undefined,
        item_count: Math.max(1, itemCount || 1),
        is_bound: isBound,
        gold: Math.max(0, gold || 0),
        sender_name: senderName.trim() || undefined,
        title: mailTitle.trim() || undefined,
        content: mailContent.trim() || undefined,
        announce,
        announce_message: announce ? announceMessage.trim() || undefined : undefined,
      };

      const res = await api.sendGift(payload);
      setSuccessMsg(res.message);
      if (onSuccess) onSuccess(res.message);

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

  // Save default settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.saveGiftSettings({
        default_sender_name: settings.default_sender_name,
        default_mail_title: settings.default_mail_title,
        default_mail_content: settings.default_mail_content,
        default_is_bound: settings.default_is_bound,
        allow_online_broadcast: settings.allow_online_broadcast,
      });
      setSettings(res.settings);
      setSuccessMsg(res.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan template.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="player-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="player-modal-content gift-modal-content">
        {/* Modal Header */}
        <header className="modal-header-hero gift-header-hero">
          <div className="gift-header-icon-box">
            <GiftIcon width={28} height={28} />
          </div>
          <div className="modal-hero-details">
            <div className="modal-hero-title-row">
              <span className="modal-hero-name">Kirim Gift Item ke Player</span>
              <span className="status-pill online">
                <i></i>
                In-Game Mail System
              </span>
            </div>
            <p className="gift-header-subtitle">
              Kirimkan item dan reward langsung ke kotak surat pemain dengan notifikasi instan via ZoneServer & sys_mail_queue.
            </p>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={submitting}
            title="Tutup Modal"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="gift-modal-tabs">
          <button
            type="button"
            className={`gift-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => setActiveTab('send')}
          >
            <GiftIcon width={16} height={16} />
            Formulir Hadiah
          </button>
          <button
            type="button"
            className={`gift-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <RefreshIcon width={16} height={16} />
            Riwayat Pengiriman ({history.length})
          </button>
          <button
            type="button"
            className={`gift-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SparklesIcon width={16} height={16} />
            Template Default
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="gift-alert error">
            <span>⚠</span>
            <div>{errorMsg}</div>
          </div>
        )}
        {successMsg && (
          <div className="gift-alert success">
            <span>✓</span>
            <div>{successMsg}</div>
          </div>
        )}

        {/* Tab 1: Formulir Hadiah */}
        {activeTab === 'send' && (
          <form onSubmit={handleSendGift} className="gift-form-container">
            {/* Step 1: Penerima */}
            <div className="gift-form-section">
              <div className="gift-section-title">
                <span className="step-num">1</span>
                <span>Pilih Sasaran Penerima</span>
              </div>

              <div className="gift-target-pills">
                <label className={`target-pill ${targetType === 'character' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="target_type"
                    value="character"
                    checked={targetType === 'character'}
                    onChange={() => setTargetType('character')}
                  />
                  <strong>Karakter Tertentu</strong>
                  <small>Kirim ke satu pemain spesifik</small>
                </label>

                <label className={`target-pill ${targetType === 'online' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="target_type"
                    value="online"
                    checked={targetType === 'online'}
                    onChange={() => setTargetType('online')}
                  />
                  <strong>Semua Pemain Online</strong>
                  <small>Broadcast giveaway aktif</small>
                </label>

                <label className={`target-pill ${targetType === 'all' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="target_type"
                    value="all"
                    checked={targetType === 'all'}
                    onChange={() => setTargetType('all')}
                  />
                  <strong>Semua Karakter</strong>
                  <small>Kompensasi / reward global</small>
                </label>
              </div>

              {targetType === 'character' && (
                <div className="gift-input-group character-target-group">
                  <label>Nama Karakter atau ID Karakter:</label>
                  <div className="char-input-wrapper">
                    <input
                      type="text"
                      className="gift-text-input"
                      placeholder="Contoh: Lynerouxes atau 50000002"
                      value={targetQuery}
                      onChange={(e) => {
                        setTargetQuery(e.target.value);
                        setSelectedCharacterName('');
                      }}
                      required
                    />

                    {playersList.length > 0 && (
                      <select
                        className="gift-select-player"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const p = playersList.find((x) => String(x.id) === e.target.value);
                            if (p) {
                              setTargetQuery(String(p.id));
                              setSelectedCharacterName(p.name);
                            }
                          }
                        }}
                      >
                        <option value="">Pilih dari daftar pemain...</option>
                        {playersList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Lv.{p.level} {p.className || ''}) {p.online ? '• Online' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {selectedCharacterName && (
                    <div className="selected-char-hint">
                      Penerima terpilih: <strong>{selectedCharacterName}</strong> (ID: {targetQuery})
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Pilih Item & Jumlah */}
            <div className="gift-form-section">
              <div className="gift-section-title">
                <span className="step-num">2</span>
                <span>Pilih Item & Jumlah</span>
              </div>

              {/* Item Search Autocomplete */}
              <div className="gift-input-group" ref={searchDropdownRef} style={{ position: 'relative' }}>
                <label>Cari Item dari Catalog (Nama atau ID):</label>
                <div className="item-search-box">
                  <SearchIcon width={16} height={16} className="search-icon-svg" />
                  <input
                    type="text"
                    className="gift-text-input search-input"
                    placeholder="Ketik nama item (contoh: Ruby, Scroll, Box, Diamond, dll)..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowItemDropdown(true);
                    }}
                  />
                  {searchLoading && <span className="search-spinner">Mencari…</span>}
                </div>

                {/* Dropdown Results */}
                {showItemDropdown && searchResults.length > 0 && (
                  <div className="item-search-dropdown">
                    {searchResults.map((it) => (
                      <div
                        key={it.id}
                        className="item-dropdown-row"
                        onClick={() => handleSelectItem(it)}
                      >
                        <ItemIcon itemId={it.id} icon={it.icon} size={32} />
                        <div className="dropdown-item-info">
                          <span className="dropdown-item-name">{it.name}</span>
                          <span className="dropdown-item-meta">
                            ID: <strong>#{it.id}</strong> • {it.category} • {it.is_bound ? 'Terikat' : 'Tradable'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Item Indicator */}
              <div className="gift-item-picker-grid">
                <div className="selected-item-card">
                  <div className="selected-item-icon-col">
                    <ItemIcon itemId={itemId ? Number(itemId) : undefined} size={48} />
                  </div>
                  <div className="selected-item-info-col">
                    <div className="selected-item-title-row">
                      <span className="item-badge-name">
                        {itemName || (itemId ? `Item ID #${itemId}` : 'Belum memilih item')}
                      </span>
                      {itemId && (
                        <span className={`bind-chip ${isBound ? 'bound' : 'trade'}`}>
                          {isBound ? 'Terikat' : 'Bisa Ditransaksikan'}
                        </span>
                      )}
                    </div>

                    <div className="selected-item-inputs">
                      <div className="mini-input-group">
                        <label>Item ID:</label>
                        <input
                          type="number"
                          className="gift-num-input"
                          placeholder="ID Item"
                          value={itemId}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : '';
                            setItemId(val);
                            if (!val) setItemName('');
                          }}
                          required
                          min={1}
                        />
                      </div>

                      <div className="mini-input-group">
                        <label>Nama Item (Opsional):</label>
                        <input
                          type="text"
                          className="gift-text-input"
                          placeholder="Keterangan nama item"
                          value={itemName}
                          onChange={(e) => setItemName(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Count and Bind Options */}
                <div className="gift-counts-row">
                  <div className="count-col">
                    <label>Jumlah Item (Count):</label>
                    <div className="count-input-with-presets">
                      <input
                        type="number"
                        className="gift-num-input count-input"
                        value={itemCount}
                        onChange={(e) => setItemCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                        min={1}
                        max={9999}
                        required
                      />
                      <div className="preset-chips">
                        {[1, 5, 10, 50, 99].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            className="chip-btn"
                            onClick={() => setItemCount(amt)}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bind-col">
                    <label>Status Ikatan (Binding):</label>
                    <div className="bind-switch-box">
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={isBound}
                          onChange={(e) => setIsBound(e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                      <span className="switch-label">
                        {isBound ? 'Item Terikat (Bound)' : 'Bisa Ditransaksikan (Tradable)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attached Gold */}
                <div className="gift-gold-group">
                  <label>Lampirkan Gold (Opsional):</label>
                  <div className="gold-input-row">
                    <input
                      type="number"
                      className="gift-num-input gold-input"
                      placeholder="0 Gold"
                      value={gold || ''}
                      onChange={(e) => setGold(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      min={0}
                    />
                    <div className="preset-chips">
                      {[
                        { label: '0 Gold', val: 0 },
                        { label: '+50.000', val: 50000 },
                        { label: '+100.000', val: 100000 },
                        { label: '+1.000.000', val: 1000000 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="chip-btn"
                          onClick={() => setGold(preset.val)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Pengaturan Surat In-Game */}
            <div className="gift-form-section">
              <div className="gift-section-title">
                <span className="step-num">3</span>
                <span>Pengaturan Surat In-Game</span>
              </div>

              <div className="mail-settings-grid">
                <div className="gift-input-group">
                  <label>Nama Pengirim (Sender Name):</label>
                  <input
                    type="text"
                    className="gift-text-input"
                    maxLength={32}
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Game Master"
                  />
                </div>

                <div className="gift-input-group">
                  <label>Judul Surat (Mail Title):</label>
                  <input
                    type="text"
                    className="gift-text-input"
                    maxLength={40}
                    value={mailTitle}
                    onChange={(e) => setMailTitle(e.target.value)}
                    placeholder="[Hadiah GM] Hadiah Spesial"
                    required
                  />
                </div>
              </div>

              <div className="gift-input-group">
                <label>Isi Pesan Surat (Mail Content):</label>
                <textarea
                  className="gift-textarea"
                  rows={3}
                  maxLength={500}
                  value={mailContent}
                  onChange={(e) => setMailContent(e.target.value)}
                  placeholder="Pesan ucapan atau instruksi untuk pemain..."
                  required
                />
              </div>

              {/* In-Game Announcement Option */}
              <div className="gift-announcement-box">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={announce}
                    onChange={(e) => setAnnounce(e.target.checked)}
                  />
                  <span>Siarkan Pengumuman In-Game (Broadcast Announce Banner di layar pemain)</span>
                </label>

                {announce && (
                  <div className="announce-custom-input">
                    <input
                      type="text"
                      className="gift-text-input"
                      placeholder="Pesan kustom pengumuman (kosongkan untuk pesan otomatis)..."
                      maxLength={100}
                      value={announceMessage}
                      onChange={(e) => setAnnounceMessage(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* In-Game Mail Preview Card */}
            <div className="gift-preview-card">
              <div className="preview-header">
                <span className="preview-badge">Preview Kotak Surat In-Game</span>
                <span className="preview-type">Surat Pribadi (Personal Mail)</span>
              </div>
              <div className="preview-body">
                <div className="preview-meta-row">
                  <span><strong>Dari:</strong> {senderName || 'Game Master'}</span>
                  <span><strong>Judul:</strong> {mailTitle || '[Hadiah GM] Hadiah Spesial'}</span>
                </div>
                <div className="preview-content-box">
                  <p>{mailContent || 'Selamat! Kamu menerima hadiah item dari Game Master.'}</p>
                </div>
                <div className="preview-attachments">
                  <div className="attachment-item">
                    <ItemIcon itemId={itemId ? Number(itemId) : undefined} size={36} />
                    <div className="attachment-info">
                      <span className="att-name">{itemName || `Item #${itemId || '---'}`}</span>
                      <span className="att-meta">
                        Jumlah: <strong>{itemCount}</strong> • {isBound ? 'Terikat' : 'Bisa Dijual'}
                      </span>
                    </div>
                  </div>
                  {gold > 0 && (
                    <div className="attachment-gold">
                      <span className="gold-icon">💰</span>
                      <span>{gold.toLocaleString('id-ID')} Gold</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <footer className="gift-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-submit-gift"
                disabled={submitting || !itemId}
              >
                <GiftIcon width={18} height={18} />
                {submitting ? 'Mengirimkan Hadiah…' : 'Kirim Hadiah ke Mail In-Game'}
              </button>
            </footer>
          </form>
        )}

        {/* Tab 2: Riwayat Pengiriman */}
        {activeTab === 'history' && (
          <div className="gift-history-container">
            <div className="history-toolbar">
              <span>Menampilkan {history.length} pengiriman hadiah terakhir</span>
              <button
                type="button"
                className="btn-refresh-history"
                onClick={loadHistory}
                disabled={historyLoading}
              >
                <RefreshIcon width={14} height={14} />
                {historyLoading ? 'Menyegarkan…' : 'Segarkan Riwayat'}
              </button>
            </div>

            {historyLoading ? (
              <div className="history-empty">Memuat riwayat pengiriman…</div>
            ) : history.length === 0 ? (
              <div className="history-empty">Belum ada riwayat pengiriman hadiah.</div>
            ) : (
              <div className="history-table-wrapper">
                <table className="gift-history-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Operator</th>
                      <th>Target Penerima</th>
                      <th>Item Terkirim</th>
                      <th>Gold</th>
                      <th>Judul Surat</th>
                      <th>Status Broadcast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="time-col">
                          {new Date(h.created_at).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td>
                          <span className="operator-badge">{h.operator}</span>
                        </td>
                        <td>
                          <strong>{h.target_name}</strong>
                          {h.char_id && <small> (#{h.char_id})</small>}
                        </td>
                        <td className="item-col">
                          <div className="history-item-inline">
                            <ItemIcon itemId={h.item_id} size={24} />
                            <span>
                              {h.item_name || `Item #${h.item_id}`}
                              <strong className="qty-tag">x{h.item_count}</strong>
                            </span>
                          </div>
                        </td>
                        <td>{h.gold > 0 ? `${h.gold.toLocaleString('id-ID')} G` : '—'}</td>
                        <td className="title-col" title={h.title}>
                          {h.title}
                        </td>
                        <td>
                          {h.announced ? (
                            <span className="announced-pill yes">Disiarkan</span>
                          ) : (
                            <span className="announced-pill no">Personal</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Template & Setting Default */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="gift-settings-form">
            <div className="gift-form-section">
              <div className="gift-section-title">
                <span>Pengaturan Template Hadiah Default</span>
              </div>
              <p className="gift-settings-intro">
                Pengaturan template ini digunakan sebagai nilai bawaan saat admin membuka form pengiriman hadiah.
              </p>

              {settings && (
                <>
                  <div className="mail-settings-grid">
                    <div className="gift-input-group">
                      <label>Default Nama Pengirim:</label>
                      <input
                        type="text"
                        className="gift-text-input"
                        value={settings.default_sender_name}
                        onChange={(e) =>
                          setSettings({ ...settings, default_sender_name: e.target.value })
                        }
                        required
                        maxLength={32}
                      />
                    </div>

                    <div className="gift-input-group">
                      <label>Default Judul Surat:</label>
                      <input
                        type="text"
                        className="gift-text-input"
                        value={settings.default_mail_title}
                        onChange={(e) =>
                          setSettings({ ...settings, default_mail_title: e.target.value })
                        }
                        required
                        maxLength={40}
                      />
                    </div>
                  </div>

                  <div className="gift-input-group">
                    <label>Default Isi Pesan Surat:</label>
                    <textarea
                      className="gift-textarea"
                      rows={3}
                      value={settings.default_mail_content}
                      onChange={(e) =>
                        setSettings({ ...settings, default_mail_content: e.target.value })
                      }
                      required
                      maxLength={500}
                    />
                  </div>

                  <div className="bind-switch-box" style={{ marginTop: '12px' }}>
                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={settings.default_is_bound}
                        onChange={(e) =>
                          setSettings({ ...settings, default_is_bound: e.target.checked })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      Secara default item berstatus <strong>{settings.default_is_bound ? 'Terikat (Bound)' : 'Bisa Ditransaksikan'}</strong>
                    </span>
                  </div>
                </>
              )}
            </div>

            <footer className="gift-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Tutup
              </button>
              <button
                type="submit"
                className="btn-submit-gift"
                disabled={submitting || settingsLoading}
              >
                <CheckIcon width={16} height={16} />
                {submitting ? 'Menyimpan…' : 'Simpan Template Default'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
