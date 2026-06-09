import { useEffect, useState, useCallback } from 'react';
import { getScraperLogs } from '../lib/api';
import type { ScraperLog } from '../types';

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">✓ OK</span>;
  if (status === 'partial') return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">⚠ Parcial</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">✕ Erro</span>;
}

export default function ScraperHealthMonitor() {
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getScraperLogs();
      setLogs(data);
    } catch {
      // silently ignore if backend not running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const lastLog = logs[0];
  const lastRunMins = lastLog ? Math.floor((Date.now() - new Date(lastLog.runAt).getTime()) / 60000) : null;

  let healthStatus: 'green' | 'yellow' | 'red' = 'green';
  if (!lastLog) healthStatus = 'red';
  else if (lastLog.status === 'error') healthStatus = 'red';
  else if (lastRunMins !== null && lastRunMins > 60) healthStatus = 'yellow';

  return (
    <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-wc-blue/30 border-b border-wc-blue flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            healthStatus === 'green' ? 'bg-green-400' :
            healthStatus === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
          }`} />
          <span className="text-wc-gold font-bold uppercase tracking-wider text-sm">Monitor do Scraper</span>
        </div>
        <div className="flex items-center gap-3">
          {lastLog && (
            <span className={`text-xs ${
              healthStatus === 'green' ? 'text-green-400' :
              healthStatus === 'yellow' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              Último sync: {timeAgo(lastLog.runAt)}
            </span>
          )}
          <button onClick={load} className="text-white/40 hover:text-white text-xs transition-colors">↻ Refresh</button>
        </div>
      </div>

      {/* Alert banners */}
      {healthStatus === 'red' && lastLog && (
        <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <span>⚠</span> Último sync falhou — verifica a ligação à ESPN
        </div>
      )}
      {healthStatus === 'yellow' && (
        <div className="px-5 py-3 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-2">
          <span>⏰</span> Sem sync há mais de 1 hora
        </div>
      )}
      {!lastLog && !loading && (
        <div className="px-5 py-3 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-sm">
          Ainda não há registos de sync. Usa os botões acima para sincronizar.
        </div>
      )}

      {/* Logs list */}
      {loading ? (
        <div className="py-8 text-center text-white/30 text-sm animate-pulse">A carregar logs...</div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-white/30 text-sm">Sem registos ainda</div>
      ) : (
        <div className="divide-y divide-wc-blue/20 max-h-80 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id}>
              <button
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-wc-blue/10 transition-colors text-left"
              >
                <StatusBadge status={log.status} />
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  log.type === 'squads' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                }`}>{log.type}</span>
                <span className="flex-1 text-white/70 text-xs truncate">{log.message}</span>
                <span className="text-white/30 text-xs">{log.recordsUpdated} reg.</span>
                <span className="text-white/20 text-xs">{log.durationMs}ms</span>
                <span className="text-white/30 text-xs ml-2">{timeAgo(log.runAt)}</span>
              </button>
              {expanded === log.id && (
                <div className="px-5 pb-3 bg-black/20">
                  <div className="font-mono text-xs text-white/50 bg-black/30 rounded p-3">
                    <div><span className="text-white/30">Hora:</span> {new Date(log.runAt).toLocaleString('pt-PT')}</div>
                    <div><span className="text-white/30">Duração:</span> {log.durationMs}ms</div>
                    <div><span className="text-white/30">Registos:</span> {log.recordsUpdated}</div>
                    <div><span className="text-white/30">Mensagem:</span> {log.message}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
