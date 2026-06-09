import React, { useState } from 'react';
import ScraperHealthMonitor from '../components/ScraperHealthMonitor';
import { downloadBackup } from '../lib/api';

interface SyncState {
  loading: boolean;
  result: string | null;
  error: string | null;
  log: string[];
}

const initial: SyncState = { loading: false, result: null, error: null, log: [] };

async function apiPost(path: string) {
  const res = await fetch(path, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'admin';
const SESSION_KEY = 'mundial_admin_auth';

function AdminGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  if (authed) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setAuthed(true);
    } else {
      setError(true);
      setInput('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card-gradient rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-white">Área Restrita</h2>
          <p className="text-white/40 text-sm mt-1">Insere a password para aceder ao painel de administração</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            placeholder="Password"
            autoFocus
            className="w-full bg-wc-blue border border-wc-blue/60 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-wc-gold/50 transition-colors"
          />
          {error && <p className="text-red-400 text-sm text-center">Password incorreta</p>}
          <button
            type="submit"
            className="w-full bg-wc-gold text-wc-dark font-bold py-3 rounded-lg hover:bg-wc-gold-light transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Admin() {
  const [squadsState, setSquadsState] = useState<SyncState>(initial);
  const [scoresState, setScoresState] = useState<SyncState>(initial);

  const syncSquads = async () => {
    setSquadsState({ loading: true, result: null, error: null, log: ['A iniciar sincronização de plantéis...'] });
    try {
      const data = await apiPost('/api/sync/squads');
      setSquadsState({
        loading: false,
        result: `✅ ${data.synced} jogadores sincronizados de 48 equipas`,
        error: data.errors?.length ? `⚠️ ${data.errors.length} erros: ${data.errors.slice(0, 3).join(', ')}` : null,
        log: data.log || [],
      });
    } catch (e: any) {
      setSquadsState({ loading: false, result: null, error: `❌ Erro: ${e.message}`, log: [] });
    }
  };

  const syncScores = async () => {
    setScoresState({ loading: true, result: null, error: null, log: ['A sincronizar resultados...'] });
    try {
      const data = await apiPost('/api/sync/scores');
      setScoresState({
        loading: false,
        result: `✅ ${data.updated} jogos atualizados`,
        error: data.errors?.length ? `⚠️ ${data.errors.slice(0, 2).join(', ')}` : null,
        log: [],
      });
    } catch (e: any) {
      setScoresState({ loading: false, result: null, error: `❌ Erro: ${e.message}`, log: [] });
    }
  };

  return (
    <AdminGate>
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Painel de Administração</h1>
          <p className="text-white/50 text-sm">Sincronização automática com a ESPN · Backup · Monitor</p>
        </div>
        <button
          onClick={downloadBackup}
          className="flex items-center gap-2 bg-wc-blue border border-wc-blue/60 hover:border-wc-gold/50 text-white/70 hover:text-wc-gold px-4 py-2.5 rounded-lg transition-colors text-sm font-medium"
          title="Download da base de dados SQLite"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Backup .db
        </button>
      </div>

      {/* Sync Squads */}
      <div className="bg-wc-navy border border-wc-blue rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">👥 Sincronizar Plantéis</h2>
          <p className="text-white/50 text-sm mt-1">
            Vai buscar os 26 jogadores de cada uma das 48 seleções à ESPN.<br />
            Demora cerca de 30–60 segundos. Faz isto uma vez antes do torneio.
          </p>
        </div>
        <button
          onClick={syncSquads}
          disabled={squadsState.loading}
          className="w-full bg-wc-gold text-wc-dark font-bold py-3 rounded-lg hover:bg-wc-gold-light disabled:opacity-50 disabled:cursor-wait transition-colors text-lg"
        >
          {squadsState.loading ? '⏳ A sincronizar... aguarda' : '🔄 Sincronizar Plantéis (48 equipas)'}
        </button>
        {squadsState.loading && (
          <div className="mt-4 bg-wc-blue/30 rounded-lg p-3 max-h-48 overflow-y-auto">
            {squadsState.log.map((msg, i) => <div key={i} className="text-white/70 text-xs font-mono">{msg}</div>)}
            <div className="text-wc-gold text-xs animate-pulse">...</div>
          </div>
        )}
        {!squadsState.loading && squadsState.result && (
          <div className="mt-4 space-y-2">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-300 text-sm">{squadsState.result}</div>
            {squadsState.error && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">{squadsState.error}</div>}
            {squadsState.log.length > 0 && (
              <details className="mt-2">
                <summary className="text-white/40 text-xs cursor-pointer hover:text-white/60">Ver log completo ({squadsState.log.length} linhas)</summary>
                <div className="mt-2 bg-wc-blue/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {squadsState.log.map((msg, i) => <div key={i} className="text-white/50 text-xs font-mono">{msg}</div>)}
                </div>
              </details>
            )}
          </div>
        )}
        {!squadsState.loading && squadsState.error && !squadsState.result && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">{squadsState.error}</div>
        )}
      </div>

      {/* Sync Scores */}
      <div className="bg-wc-navy border border-wc-blue rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">📡 Atualizar Resultados</h2>
          <p className="text-white/50 text-sm mt-1">
            Vai buscar os resultados e estados dos jogos à ESPN em tempo real.<br />
            Usa isto durante e após cada jornada para atualizar automaticamente.
          </p>
        </div>
        <button
          onClick={syncScores}
          disabled={scoresState.loading}
          className="w-full bg-wc-blue border border-wc-gold/30 text-wc-gold font-bold py-3 rounded-lg hover:bg-wc-gold hover:text-wc-dark disabled:opacity-50 disabled:cursor-wait transition-colors text-lg"
        >
          {scoresState.loading ? '⏳ A atualizar...' : '📡 Atualizar Resultados Agora'}
        </button>
        {!scoresState.loading && scoresState.result && (
          <div className="mt-4 space-y-2">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-300 text-sm">{scoresState.result}</div>
            {scoresState.error && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">{scoresState.error}</div>}
          </div>
        )}
        {!scoresState.loading && scoresState.error && !scoresState.result && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">{scoresState.error}</div>
        )}
      </div>

      {/* Health Monitor */}
      <ScraperHealthMonitor />

      {/* Info */}
      <div className="bg-wc-blue/20 border border-wc-blue/40 rounded-xl p-5">
        <h3 className="text-white/70 font-semibold mb-3 text-sm uppercase tracking-wider">Como usar</h3>
        <ol className="space-y-2 text-white/50 text-sm list-decimal list-inside">
          <li><span className="text-white/80">Antes do Mundial</span> — Clica em "Sincronizar Plantéis" para carregar os 26 jogadores de cada equipa</li>
          <li><span className="text-white/80">Durante os jogos</span> — Clica em "Atualizar Resultados" para ver os marcadores em tempo real</li>
          <li><span className="text-white/80">Eventos manuais</span> — Vai a cada jogo e adiciona golos, cartões e MOTM manualmente</li>
          <li><span className="text-white/80">Backup</span> — Clica em "Backup .db" no canto superior direito para guardar uma cópia da base de dados</li>
        </ol>
        <div className="mt-4 text-white/30 text-xs">Fonte: ESPN API pública · Gratuita · Sem registo</div>
      </div>
    </div>
    </AdminGate>
  );
}
