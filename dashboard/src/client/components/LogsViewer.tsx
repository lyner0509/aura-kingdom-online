import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, type Overview } from '../lib/api';
import { RefreshIcon, SearchIcon } from './Icons';

interface LogsViewerProps {
  services: Overview['services'];
  activeService?: string;
  onServiceChange?: (service: string) => void;
}

export function LogsViewer({ services, activeService = 'WorldServer', onServiceChange }: LogsViewerProps) {
  const [selectedService, setSelectedService] = useState(activeService);
  const [linesCount, setLinesCount] = useState<number>(120);
  const [filterText, setFilterText] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [content, setContent] = useState<string>('Memuat log runtime…');
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [autoScrollBottom, setAutoScrollBottom] = useState<boolean>(true);

  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Synchronize when parent prop activeService changes
  useEffect(() => {
    if (activeService && activeService !== selectedService) {
      setSelectedService(activeService);
    }
  }, [activeService]);

  const loadLogs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.logs(selectedService, linesCount);
      setContent(res.content || '');
      setLastUpdated(new Date());
    } catch (e) {
      if (!quiet) {
        setContent(e instanceof Error ? `[GAGAL MEMUAT LOG]\n${e.message}` : 'Gagal memuat log service.');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedService, linesCount]);

  // Load when selected service or lines count changes
  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Auto-refresh interval (5s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadLogs(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs]);

  // Auto-scroll to bottom when new logs load if autoScrollBottom is enabled
  useEffect(() => {
    if (autoScrollBottom && terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [content, autoScrollBottom]);

  // Handle service change
  const handleSelectService = (serviceName: string) => {
    setSelectedService(serviceName);
    onServiceChange?.(serviceName);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  // Download log as file
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = `${selectedService}-${timestamp}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Scroll to bottom manually
  const scrollToBottom = () => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTo({
        top: terminalBodyRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setAutoScrollBottom(true);
    }
  };

  // Process and filter lines
  const rawLines = useMemo(() => {
    if (!content.trim()) return [];
    return content.split('\n');
  }, [content]);

  const filteredLines = useMemo(() => {
    return rawLines
      .map((line, idx) => ({ line, originalIndex: idx + 1 }))
      .filter(({ line }) => {
        // Level filter
        if (filterLevel === 'error') {
          if (!/(error|fatal|fail|critical|exception|panic)/i.test(line)) return false;
        } else if (filterLevel === 'warn') {
          if (!/(warn|warning)/i.test(line)) return false;
        } else if (filterLevel === 'info') {
          if (!/(info|success|connect|listening|ready|loaded|started)/i.test(line)) return false;
        }

        // Search text filter
        if (filterText.trim()) {
          return line.toLowerCase().includes(filterText.toLowerCase());
        }

        return true;
      });
  }, [rawLines, filterLevel, filterText]);

  // Determine line style/type
  const getLineClass = (line: string): string => {
    if (/(error|fatal|critical|exception|panic|fail)/i.test(line)) return 'log-line-error';
    if (/(warn|warning)/i.test(line)) return 'log-line-warn';
    if (/(success|connect|ready|started|ok)/i.test(line)) return 'log-line-success';
    if (/(info|debug)/i.test(line)) return 'log-line-info';
    return 'log-line-normal';
  };

  const selectedServiceObj = services.find((s) => s.name === selectedService);

  return (
    <section className="panel logs-terminal-panel" id="realm-logs-section">
      {/* Header Info */}
      <header className="logs-terminal-header">
        <div>
          <p className="kicker">Runtime Stream & Audit</p>
          <div className="logs-title-row">
            <h3>Log Realm Service</h3>
            <span className="log-current-pill">
              <span className={`log-service-dot ${selectedServiceObj?.online ? 'online' : 'offline'}`} />
              <strong>{selectedService}</strong>
              <small>{selectedServiceObj?.online ? `PID ${selectedServiceObj.pid}` : 'offline'}</small>
            </span>
          </div>
          <p className="logs-header-sub">
            Pemantauan langsung aliran output dan histori eksekusi proses server.
          </p>
        </div>

        {/* Action buttons on top right */}
        <div className="logs-top-actions">
          <button
            type="button"
            className={`log-btn-auto ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh setiap 5 detik"
          >
            <span className={`pulse-indicator ${autoRefresh ? 'live' : ''}`} />
            {autoRefresh ? 'Auto-sync On (5s)' : 'Auto-sync Off'}
          </button>

          <button
            type="button"
            className="log-btn-action"
            onClick={() => void loadLogs()}
            disabled={loading}
            title="Muat ulang log sekarang"
          >
            <RefreshIcon className={loading ? 'spin' : ''} />
            <span>{loading ? 'Memuat…' : 'Segarkan'}</span>
          </button>

          <button
            type="button"
            className="log-btn-action"
            onClick={handleCopy}
            title="Salin seluruh isi log ke clipboard"
          >
            {copied ? '✓ Tersalin!' : 'Salin Log'}
          </button>

          <button
            type="button"
            className="log-btn-action"
            onClick={handleDownload}
            title="Unduh log ke file .log"
          >
            Unduh
          </button>
        </div>
      </header>

      {/* Service Tabs Bar */}
      <div className="logs-service-tabs-bar">
        <div className="logs-service-tabs-scroll">
          {services.map((svc) => {
            const isSelected = svc.name === selectedService;
            return (
              <button
                key={svc.name}
                type="button"
                className={`log-service-tab ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectService(svc.name)}
              >
                <span className={`service-tab-dot ${svc.online ? 'online' : 'offline'}`} />
                <span className="service-tab-name">{svc.name}</span>
                {svc.online && <small className="service-tab-pid">:{svc.pid}</small>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Options Toolbar */}
      <div className="logs-toolbar">
        {/* Search Input */}
        <div className="logs-search-wrapper">
          <SearchIcon className="logs-search-icon" width={14} height={14} />
          <input
            type="text"
            placeholder="Cari kata kunci dalam log (contoh: error, connect, size)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="logs-search-input"
          />
          {filterText && (
            <button
              type="button"
              className="logs-search-clear"
              onClick={() => setFilterText('')}
              title="Hapus filter pencarian"
            >
              ✕
            </button>
          )}
        </div>

        {/* Level Filters */}
        <div className="logs-filter-pills">
          <button
            type="button"
            className={`filter-pill ${filterLevel === 'all' ? 'active' : ''}`}
            onClick={() => setFilterLevel('all')}
          >
            Semua ({rawLines.length})
          </button>
          <button
            type="button"
            className={`filter-pill error ${filterLevel === 'error' ? 'active' : ''}`}
            onClick={() => setFilterLevel('error')}
          >
            ● Error
          </button>
          <button
            type="button"
            className={`filter-pill warn ${filterLevel === 'warn' ? 'active' : ''}`}
            onClick={() => setFilterLevel('warn')}
          >
            ● Warning
          </button>
          <button
            type="button"
            className={`filter-pill info ${filterLevel === 'info' ? 'active' : ''}`}
            onClick={() => setFilterLevel('info')}
          >
            ● Info
          </button>
        </div>

        {/* Lines Limit & Wrap Switch */}
        <div className="logs-view-controls">
          <label className="logs-limit-label">
            <span>Baris:</span>
            <select
              value={linesCount}
              onChange={(e) => setLinesCount(Number(e.target.value))}
              className="logs-limit-select"
            >
              <option value={50}>50 baris</option>
              <option value={120}>120 baris</option>
              <option value={250}>250 baris</option>
              <option value={500}>500 baris</option>
            </select>
          </label>

          <button
            type="button"
            className={`log-toggle-wrap-btn ${wordWrap ? 'active' : ''}`}
            onClick={() => setWordWrap(!wordWrap)}
            title={wordWrap ? 'Matikan line wrap' : 'Aktifkan line wrap'}
          >
            {wordWrap ? 'Wrap: ON' : 'Wrap: OFF'}
          </button>

          <button
            type="button"
            className="log-bottom-btn"
            onClick={scrollToBottom}
            title="Gulir langsung ke baris paling bawah"
          >
            ↓ Bawah
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="logs-terminal-viewport">
        {/* Terminal Title Bar */}
        <div className="terminal-titlebar">
          <div className="terminal-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="terminal-title-text">
            azuria-stream ~ /{selectedService}.log
          </span>
          <span className="terminal-meta-text">
            {lastUpdated
              ? `Update: ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Memuat...'}
          </span>
        </div>

        {/* Terminal Log Lines Body */}
        <div
          ref={terminalBodyRef}
          className={`terminal-log-body ${wordWrap ? 'wrap-lines' : ''}`}
          onScroll={(e) => {
            const target = e.currentTarget;
            const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 40;
            setAutoScrollBottom(isNearBottom);
          }}
        >
          {loading && !rawLines.length ? (
            <div className="terminal-empty-msg">
              <RefreshIcon className="spin" />
              <span>Menghubungkan ke runtime socket {selectedService}…</span>
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="terminal-empty-msg">
              <span>
                {rawLines.length === 0
                  ? `Log file untuk ${selectedService} kosong atau belum menghasilkan entri.`
                  : 'Tidak ada baris log yang cocok dengan filter yang aktif.'}
              </span>
            </div>
          ) : (
            <div className="terminal-lines-table">
              {filteredLines.map(({ line, originalIndex }) => {
                const lineClass = getLineClass(line);
                return (
                  <div key={originalIndex} className={`terminal-line-row ${lineClass}`}>
                    <span className="terminal-line-num">{originalIndex}</span>
                    <span className="terminal-line-text">{line}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Terminal Status Bar Footer */}
        <div className="terminal-footer-bar">
          <div className="terminal-footer-left">
            <span>
              Menampilkan <strong>{filteredLines.length}</strong> dari {rawLines.length} baris
              {filterText ? ` (filter: "${filterText}")` : ''}
            </span>
          </div>
          <div className="terminal-footer-right">
            <span>Encoding: UTF-8</span>
            <span>•</span>
            <span>Buffer: {Math.round(content.length / 1024)} KB</span>
            <span>•</span>
            <span className="footer-status-indicator">
              <span className={`live-pulse-dot ${selectedServiceObj?.online ? 'online' : 'offline'}`} />
              {selectedServiceObj?.online ? 'Streaming active' : 'Process halted'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
