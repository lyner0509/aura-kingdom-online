import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, type ItemIndexItem, type ItemIndexResponse } from '../lib/api';
import {
  SearchIcon,
  TableIcon,
  GridIcon,
  CopyIcon,
  CheckIcon,
  RefreshIcon,
  ChevronIcon,
  DatabaseIcon,
} from './Icons';
import { ItemIcon } from './ItemIcon';

type ViewMode = 'table' | 'grid';
type SortOption = 'id_asc' | 'id_desc' | 'name_asc' | 'name_desc';

export function ItemIndexPage() {
  const [items, setItems] = useState<ItemIndexItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(48);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [stats, setStats] = useState<{ totalItems: number; tradableCount: number; boundCount: number }>({
    totalItems: 0,
    tradableCount: 0,
    boundCount: 0,
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tradableFilter, setTradableFilter] = useState<'all' | 'tradable' | 'non_tradable'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('id_asc');

  // UI states
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('aura_item_view') as ViewMode) || 'table';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [jumpPageInput, setJumpPageInput] = useState('');

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle view change and save to localStorage
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('aura_item_view', mode);
  };

  // Load items
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res: ItemIndexResponse = await api.itemIndex({
        q: debouncedSearch,
        page,
        limit,
        category: selectedCategory,
        tradable: tradableFilter,
        sort: sortOption,
      });

      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setLimit(res.limit);
      setTotalPages(res.totalPages);
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      }
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat katalog item.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, limit, selectedCategory, tradableFilter, sortOption]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Copy ID function
  const copyToClipboard = async (item: ItemIndexItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const textToCopy = String(item.id);
    let success = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      // Fallback
      try {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopiedId(item.id);
      setCopiedNotice(`ID ${item.id} (${item.name}) berhasil disalin!`);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedId(null);
        setCopiedNotice(null);
      }, 2000);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedCategory('all');
    setTradableFilter('all');
    setSortOption('id_asc');
    setPage(1);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setPage(target);
      setJumpPageInput('');
    }
  };

  // Helper for category badge styling
  const getCategoryClass = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('weapon')) return 'cat-badge cat-weapon';
    if (c.includes('armor')) return 'cat-badge cat-armor';
    if (c.includes('costume')) return 'cat-badge cat-costume';
    if (c.includes('mount')) return 'cat-badge cat-mount';
    if (c.includes('eidolon')) return 'cat-badge cat-eidolon';
    if (c.includes('bag')) return 'cat-badge cat-bag';
    if (c.includes('consumable')) return 'cat-badge cat-consumable';
    if (c.includes('secret')) return 'cat-badge cat-secret';
    if (c.includes('material')) return 'cat-badge cat-material';
    return 'cat-badge cat-other';
  };

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="item-index-page">
      {/* Toast Notification */}
      {copiedNotice && (
        <div className="item-copy-toast">
          <CheckIcon />
          <span>{copiedNotice}</span>
        </div>
      )}

      {/* Header Panel */}
      <section className="panel item-index-header-panel">
        <div className="item-index-title-area">
          <div className="title-icon-box">
            <DatabaseIcon />
          </div>
          <div>
            <p className="kicker">Aura Kingdom Catalog</p>
            <h2>Item Index &amp; Database</h2>
            <p className="subtitle">
              Pencarian dan katalog lengkap item game Aura Kingdom V15. Salin ID item dengan satu klik untuk konfigurasi Paragon, Item Mall, Loyalty Shop, Starter Pack, atau In-Game Mail.
            </p>
          </div>
        </div>

        <div className="item-index-stat-pills">
          <div className="stat-pill">
            <span className="stat-label">Total Item Database</span>
            <span className="stat-value">{stats.totalItems.toLocaleString('id-ID')}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Tradable Items</span>
            <span className="stat-value text-emerald">{stats.tradableCount.toLocaleString('id-ID')}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Non-tradable Items</span>
            <span className="stat-value text-amber">{stats.boundCount.toLocaleString('id-ID')}</span>
          </div>
          <div className="stat-pill highlight">
            <span className="stat-label">Hasil Pencarian</span>
            <span className="stat-value">{total.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </section>

      {/* Filter & Toolbar Panel */}
      <section className="panel item-index-toolbar-panel">
        <div className="toolbar-row top-row">
          {/* Search Box */}
          <div className="item-search-wrapper">
            <SearchIcon className="search-icon" />
            <input
              type="text"
              className="item-search-input"
              placeholder="Cari nama item atau ID (contoh: 40358, Backpack, Potion, Gaia)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm('')}
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => handleViewChange('table')}
              title="Tampilan Tabel"
            >
              <TableIcon />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => handleViewChange('grid')}
              title="Tampilan Grid"
            >
              <GridIcon />
              <span>Grid</span>
            </button>
          </div>
        </div>

        <div className="toolbar-row filters-row">
          {/* Category Selector */}
          <div className="filter-group">
            <label>Kategori:</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua Kategori ({stats.totalItems.toLocaleString('id-ID')})</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count.toLocaleString('id-ID')})
                </option>
              ))}
            </select>
          </div>

          {/* Tradable Filter */}
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={tradableFilter}
              onChange={(e) => {
                setTradableFilter(e.target.value as 'all' | 'tradable' | 'non_tradable');
                setPage(1);
              }}
            >
              <option value="all">Semua Status</option>
              <option value="tradable">Tradable Sahaja</option>
              <option value="non_tradable">Non-tradable (Bound)</option>
            </select>
          </div>

          {/* Sort Option */}
          <div className="filter-group">
            <label>Urutan:</label>
            <select
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value as SortOption);
                setPage(1);
              }}
            >
              <option value="id_asc">ID Menaik (1 → 9)</option>
              <option value="id_desc">ID Menurun (9 → 1)</option>
              <option value="name_asc">Nama (A → Z)</option>
              <option value="name_desc">Nama (Z → A)</option>
            </select>
          </div>

          {/* Limit per page */}
          <div className="filter-group">
            <label>Per Halaman:</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={24}>24 item</option>
              <option value={48}>48 item</option>
              <option value={96}>96 item</option>
            </select>
          </div>

          {/* Reset button */}
          {(searchTerm || selectedCategory !== 'all' || tradableFilter !== 'all' || sortOption !== 'id_asc') && (
            <button type="button" className="reset-filter-btn" onClick={handleResetFilters}>
              Reset Filter
            </button>
          )}

          <button
            type="button"
            className="refresh-btn"
            onClick={() => void loadItems()}
            disabled={loading}
            title="Muat ulang"
          >
            <RefreshIcon className={loading ? 'spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      {error && <div className="notice error">{error}</div>}

      {loading ? (
        <div className="panel loading-panel">
          <RefreshIcon className="spin" />
          <p>Mencari dan memuat katalog item…</p>
        </div>
      ) : items.length === 0 ? (
        <section className="panel empty-panel">
          <div className="empty-content">
            <DatabaseIcon />
            <h3>Tidak Ada Item Yang Cocok</h3>
            <p>
              Tidak ditemukan item dengan kata kunci <strong>"{debouncedSearch}"</strong> atau kriteria filter yang dipilih.
            </p>
            <button type="button" className="btn-primary" onClick={handleResetFilters}>
              Reset Semua Filter
            </button>
          </div>
        </section>
      ) : viewMode === 'table' ? (
        /* ================= TABLE VIEW ================= */
        <section className="panel item-table-panel">
          <div className="table-wrap">
            <table className="item-index-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Item ID</th>
                  <th>Nama Item</th>
                  <th style={{ width: '150px' }}>Kategori</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isCopied = copiedId === it.id;
                  return (
                    <tr key={it.id} className={isCopied ? 'row-copied' : ''}>
                      <td>
                        <button
                          type="button"
                          className={`item-id-badge ${isCopied ? 'badge-copied' : ''}`}
                          onClick={(e) => copyToClipboard(it, e)}
                          title="Klik untuk salin ID"
                        >
                          <span className="id-number">{it.id}</span>
                          {isCopied ? <CheckIcon className="badge-icon" /> : <CopyIcon className="badge-icon" />}
                        </button>
                      </td>
                      <td>
                        <div className="table-item-cell">
                          <ItemIcon itemId={it.id} icon={it.icon} name={it.name} size={32} />
                          <div className="item-name-cell">
                            <strong className="item-name-text">{it.name}</strong>
                            {it.is_bound && <span className="bound-tag">Non-tradable</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={getCategoryClass(it.category)}>{it.category}</span>
                      </td>
                      <td>
                        {it.is_bound ? (
                          <span className="status-bound">Non-tradable</span>
                        ) : (
                          <span className="status-tradable">Tradable</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`btn-copy-action ${isCopied ? 'copied' : ''}`}
                          onClick={(e) => copyToClipboard(it, e)}
                          title="Salin ID ke clipboard"
                        >
                          {isCopied ? (
                            <>
                              <CheckIcon />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <CopyIcon />
                              <span>Salin ID</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* ================= GRID VIEW ================= */
        <section className="item-grid-container">
          {items.map((it) => {
            const isCopied = copiedId === it.id;
            return (
              <div key={it.id} className={`item-grid-card ${isCopied ? 'card-copied' : ''}`}>
                <div className="card-top">
                  <button
                    type="button"
                    className={`item-id-badge ${isCopied ? 'badge-copied' : ''}`}
                    onClick={(e) => copyToClipboard(it, e)}
                    title="Klik untuk salin ID"
                  >
                    <span className="id-number">{it.id}</span>
                    {isCopied ? <CheckIcon className="badge-icon" /> : <CopyIcon className="badge-icon" />}
                  </button>
                  <span className={getCategoryClass(it.category)}>{it.category}</span>
                </div>

                <div className="card-icon-container">
                  <ItemIcon itemId={it.id} icon={it.icon} name={it.name} size={48} />
                </div>

                <div className="card-middle">
                  <h4 className="card-item-name" title={it.name}>
                    {it.name}
                  </h4>
                  <div className="card-badges">
                    {it.is_bound ? (
                      <span className="status-bound">Non-tradable</span>
                    ) : (
                      <span className="status-tradable">Tradable</span>
                    )}
                  </div>
                </div>

                <div className="card-bottom">
                  <button
                    type="button"
                    className={`btn-card-copy ${isCopied ? 'copied' : ''}`}
                    onClick={(e) => copyToClipboard(it, e)}
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon />
                        <span>ID Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon />
                        <span>Salin ID #{it.id}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <section className="panel item-index-pagination-panel">
          <div className="pagination-info">
            Menampilkan <strong>{startRecord.toLocaleString('id-ID')}</strong>–<strong>{endRecord.toLocaleString('id-ID')}</strong> dari{' '}
            <strong>{total.toLocaleString('id-ID')}</strong> item (Halaman {page} dari {totalPages})
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="page-nav-btn"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title="Halaman Pertama"
            >
              ««
            </button>
            <button
              type="button"
              className="page-nav-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Halaman Sebelumnya"
            >
              ‹
            </button>

            {/* Smart page numbers */}
            {(() => {
              const pages: (number | string)[] = [];
              const start = Math.max(1, page - 2);
              const end = Math.min(totalPages, page + 2);

              if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push('...');
              }

              for (let i = start; i <= end; i++) {
                pages.push(i);
              }

              if (end < totalPages) {
                if (end < totalPages - 1) pages.push('...');
                pages.push(totalPages);
              }

              return pages.map((p, idx) =>
                typeof p === 'number' ? (
                  <button
                    key={p}
                    type="button"
                    className={`page-num-btn ${page === p ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={`dots-${idx}`} className="page-dots">
                    …
                  </span>
                )
              );
            })()}

            <button
              type="button"
              className="page-nav-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Halaman Selanjutnya"
            >
              ›
            </button>
            <button
              type="button"
              className="page-nav-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              title="Halaman Terakhir"
            >
              »»
            </button>

            {/* Jump to page form */}
            <form className="jump-page-form" onSubmit={handleJumpSubmit}>
              <input
                type="number"
                min={1}
                max={totalPages}
                placeholder="Ke Hal"
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                className="jump-page-input"
              />
              <button type="submit" className="jump-page-btn">
                Lompat
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
