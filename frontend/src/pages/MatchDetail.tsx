import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMatch, syncMatchStats, syncScores, getMatchEspnData } from '../lib/api';
import type { Match } from '../types';

type Tab = 'dados' | 'formacoes' | 'stats';

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽', own_goal: '🔴', assist: '🎯',
  yellow_card: '🟨', red_card: '🟥',
  Goal: '⚽', OwnGoal: '🔴', Assist: '🎯', Yellow: '🟨', Red: '🟥',
};

const STAT_LABELS: Record<string, string> = {
  possessionPct: 'Posse de Bola',
  totalShots: 'Remates',
  shotsOnTarget: 'Remates à Baliza',
  wonCorners: 'Cantos',
  foulsCommitted: 'Faltas',
  yellowCards: 'Cartões Amarelos',
  redCards: 'Cartões Vermelhos',
  offsides: 'Foras de Jogo',
  saves: 'Defesas',
};

const STAT_ORDER = ['possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'foulsCommitted', 'yellowCards', 'redCards', 'offsides', 'saves'];

type EspnData = Awaited<ReturnType<typeof getMatchEspnData>>;

function FormationPitch({ lineup, side }: {
  lineup: EspnData['lineups'][0];
  side: 'home' | 'away';
}) {
  const formation = lineup.formation || '4-4-2';
  const lines = formation.split('-').map(Number);
  const allLines = [1, ...lines]; // GK + field lines
  const starters = lineup.starters;

  // Distribute starters into formation lines
  let idx = 0;
  const rows: typeof starters[] = allLines.map(count => {
    const row = starters.slice(idx, idx + count);
    idx += count;
    return row;
  });

  // For away team, reverse the rows so GK is at bottom
  const displayRows = side === 'home' ? [...rows].reverse() : rows;

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="text-center text-wc-gold font-bold text-sm tracking-wider mb-1">{formation}</div>
      {displayRows.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-2 flex-wrap">
          {row.map((player, pi) => (
            <div key={pi} className="flex flex-col items-center gap-1 w-14">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                player.subbedOut ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300' : 'border-wc-gold bg-wc-gold/20 text-white'
              }`}>
                {player.jersey}
              </div>
              <div className="text-white/70 text-xs text-center leading-tight max-w-[56px] truncate" title={player.name}>
                {player.name.split(' ').slice(-1)[0]}
              </div>
              {player.subbedOut && <span className="text-yellow-400 text-xs">↓</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatBar({ label, homeVal, awayVal }: { label: string; homeVal: number; awayVal: number }) {
  const total = homeVal + awayVal || 1;
  const homePct = Math.round((homeVal / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-wc-gold font-bold">{homeVal}</span>
        <span className="text-white/50 text-xs">{label}</span>
        <span className="text-wc-violet font-bold">{awayVal}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <div className="rounded-l-full bg-wc-gold transition-all" style={{ width: `${homePct}%` }} />
        <div className="rounded-r-full bg-wc-violet transition-all" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [espnData, setEspnData] = useState<EspnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [espnLoading, setEspnLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('dados');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadMatch = () => getMatch(Number(id)).then(setMatch);

  const loadEspn = () => {
    setEspnLoading(true);
    getMatchEspnData(Number(id))
      .then(setEspnData)
      .catch(() => setEspnData(null))
      .finally(() => setEspnLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    loadMatch().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (match && match.espnEventId && match.status !== 'Scheduled') {
      loadEspn();
    }
  }, [match?.espnEventId, match?.status]);

  // Auto-refresh quando o jogo está Live: recarrega dados a cada 30s
  useEffect(() => {
    if (match?.status !== 'Live') return;
    const interval = setInterval(() => {
      loadMatch();
      loadEspn();
    }, 30_000);
    return () => clearInterval(interval);
  }, [match?.status]);

  const handleSyncESPN = async () => {
    if (!match) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      await syncScores();
      await loadMatch();
      const result = await syncMatchStats(match.id);
      if (result.error) {
        setSyncMsg(`⚠️ ${result.error}`);
      } else {
        setSyncMsg(`✅ ${result.events} eventos sincronizados`);
        await loadMatch();
        loadEspn();
      }
    } catch (err: any) {
      setSyncMsg(`❌ ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;
  if (!match) return <div className="text-center py-20 text-red-400">Jogo não encontrado</div>;

  const visibleEvents = (match.events ?? []).filter(e => (e.eventType as string) !== 'minutes_played');
  const homeLineup = espnData?.lineups.find(l => l.homeAway === 'home');
  const awayLineup = espnData?.lineups.find(l => l.homeAway === 'away');
  const homeStats = espnData?.teamStats[0];
  const awayStats = espnData?.teamStats[1];

  return (
    <div className="relative -mx-4 -mt-6 px-4 pt-8 pb-12 min-h-screen">
      {/* Full-page stadium background */}
      <div className="fixed inset-0 -z-10"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1920)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />
      <div className="fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(180deg, rgba(7,9,26,0.75) 0%, rgba(7,9,26,0.88) 40%, rgba(7,9,26,0.97) 100%)' }}
      />

    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/matches" className="text-wc-gold hover:underline text-sm">← Voltar ao calendário</Link>

      {/* Match Header */}
      <div className="relative border border-wc-blue rounded-2xl p-8 text-center overflow-hidden">
        {/* Flags background — split left/right */}
        {match.homeTeam?.flagUrl && (
          <div className="absolute inset-0 flex">
            <div className="w-1/2 h-full"
              style={{
                backgroundImage: `url(${match.homeTeam.flagUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(8px) brightness(0.25)',
                transform: 'scale(1.1)',
              }}
            />
            <div className="w-1/2 h-full"
              style={{
                backgroundImage: `url(${match.awayTeam?.flagUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(8px) brightness(0.25)',
                transform: 'scale(1.1)',
              }}
            />
          </div>
        )}
        {/* Dark gradient over flags */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(13,17,48,0.55) 0%, rgba(7,9,26,0.6) 50%, rgba(13,17,48,0.55) 100%)' }}
        />
        <div className="relative z-10 text-white/40 text-sm mb-4 uppercase tracking-wider">
          {match.stage === 'Group' ? `Grupo ${match.groupName}` : match.stage}
        </div>

        <div className="relative z-10 flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 flex-1">
            {match.homeTeam && <img src={match.homeTeam.flagUrl} alt="" className="w-16 h-10 object-cover rounded shadow-lg" />}
            <span className="font-bold text-white text-xl">{match.homeTeam?.name}</span>
          </div>

          <div className="text-center">
            {match.status === 'Finished' ? (
              <div className="text-5xl font-extrabold text-wc-gold">{match.homeScore} — {match.awayScore}</div>
            ) : match.status === 'Live' ? (
              <div className="text-5xl font-extrabold text-green-400">{match.homeScore ?? 0} — {match.awayScore ?? 0}</div>
            ) : (
              <div className="text-3xl font-bold text-white/30">
                {match.date.includes('T') ? match.date.split('T')[1].substring(0, 5) : '—'}
              </div>
            )}
            <div className={`mt-2 text-xs px-3 py-1 rounded-full font-semibold inline-block ${
              match.status === 'Finished' ? 'bg-gray-500/20 text-gray-400' :
              match.status === 'Live' ? 'bg-green-500/20 text-green-300 animate-pulse' :
              'bg-blue-500/20 text-blue-300'
            }`}>
              {match.status === 'Finished' ? 'Terminado' :
               match.status === 'Live' ? '⚡ AO VIVO' :
               match.date.includes('T')
                 ? `${match.date.split('T')[0].split('-').reverse().join('/')} · ${match.date.split('T')[1].substring(0,5)}`
                 : match.date}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            {match.awayTeam && <img src={match.awayTeam.flagUrl} alt="" className="w-16 h-10 object-cover rounded shadow-lg" />}
            <span className="font-bold text-white text-xl">{match.awayTeam?.name}</span>
          </div>
        </div>

        {match.venue && <div className="relative z-10 mt-4 text-white/30 text-sm">📍 {match.venue}</div>}
        {match.motmPlayer && (
          <div className="relative z-10 mt-3 text-sm text-wc-gold">⭐ MOTM: {match.motmPlayer.name} ({match.motmPlayer.team?.name})</div>
        )}
      </div>

      {/* ESPN Sync */}
      <div className="rounded-xl border border-wc-purple/30 p-4 flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(13,17,48,0.8))' }}
      >
        <div>
          <div className="text-white font-semibold text-sm">Sincronizar com ESPN</div>
          <div className="text-white/40 text-xs mt-0.5">
            {match.status === 'Live' ? 'Atualiza resultado e marcadores em tempo real' :
             match.status === 'Finished' ? 'Importa golos, assistências, cartões e minutos jogados' :
             'Força sync — atualiza estado do jogo a partir da ESPN'}
          </div>
          {syncMsg && <div className="text-sm mt-2 font-medium text-wc-gold">{syncMsg}</div>}
        </div>
        <button
          onClick={handleSyncESPN}
          disabled={syncing}
          className="shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: syncing ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7C3AED, #A855F7)', color: 'white' }}
        >
          {syncing ? '⟳ A sincronizar...' : '⚡ Sync ESPN'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(13,17,48,0.8)', border: '1px solid rgba(26,34,80,0.8)' }}>
        {([['dados', '📋 Dados do Jogo'], ['formacoes', '🗺️ Formações'], ['stats', '📊 Estatísticas']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? 'text-wc-dark shadow-glow-gold'
                : 'text-white/50 hover:text-white'
            }`}
            style={tab === key ? { background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Dados do Jogo */}
      {tab === 'dados' && (
        <div>
          {visibleEvents.length === 0 ? (
            <div className="text-center py-12 text-white/25">
              {match.status === 'Scheduled' ? 'O jogo ainda não começou' : 'Sem eventos registados — faz Sync ESPN'}
            </div>
          ) : (
            <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-wc-blue/40 border-b border-wc-blue">
                <span className="text-wc-gold font-bold text-sm uppercase tracking-wider">Eventos do Jogo</span>
              </div>
              <div className="divide-y divide-wc-blue/30">
                {visibleEvents
                  .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
                  .map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xl">{EVENT_ICONS[ev.eventType] || '•'}</span>
                      <span className="text-white/40 text-sm w-12 font-mono">{ev.minute ? `${ev.minute}'` : '—'}</span>
                      <div className="flex-1">
                        <span className="text-white font-medium">{ev.player?.name ?? ev.description ?? '—'}</span>
                        {ev.team && <span className="text-white/40 text-xs ml-2">({ev.team.name})</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Formações */}
      {tab === 'formacoes' && (
        <div>
          {espnLoading ? (
            <div className="text-center py-12 text-wc-gold animate-pulse">A carregar formações...</div>
          ) : !homeLineup ? (
            <div className="text-center py-12 text-white/25">
              {match.status === 'Scheduled' ? 'Formações disponíveis quando o jogo começar' : 'Faz Sync ESPN para carregar formações'}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pitch */}
              <div className="rounded-xl overflow-hidden border border-wc-blue/50" style={{ background: 'rgba(13,17,48,0.6)' }}>
                <div className="grid grid-cols-2 divide-x divide-wc-blue/30">
                  {/* Home */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {match.homeTeam && <img src={match.homeTeam.flagUrl} alt="" className="w-6 h-4 object-cover rounded" />}
                      <span className="text-white font-bold text-sm">{match.homeTeam?.name}</span>
                    </div>
                    <FormationPitch lineup={homeLineup} side="home" />
                  </div>
                  {/* Away */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3 justify-end">
                      <span className="text-white font-bold text-sm">{match.awayTeam?.name}</span>
                      {match.awayTeam && <img src={match.awayTeam.flagUrl} alt="" className="w-6 h-4 object-cover rounded" />}
                    </div>
                    {awayLineup && <FormationPitch lineup={awayLineup} side="away" />}
                  </div>
                </div>
              </div>

              {/* Bancos */}
              <div className="grid grid-cols-2 gap-4">
                {[homeLineup, awayLineup].map((lineup, i) => lineup && (
                  <div key={i} className="bg-wc-navy border border-wc-blue/50 rounded-xl p-4">
                    <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Banco</div>
                    <div className="space-y-2">
                      {lineup.bench.map((p, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="text-white/30 text-xs w-5 text-right">{p.jersey}</span>
                          <span className={`text-sm ${p.subbedIn ? 'text-green-400' : 'text-white/60'}`}>
                            {p.name} {p.subbedIn && '↑'}
                          </span>
                          <span className="text-white/30 text-xs ml-auto">{p.position}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Estatísticas */}
      {tab === 'stats' && (
        <div>
          {espnLoading ? (
            <div className="text-center py-12 text-wc-gold animate-pulse">A carregar estatísticas...</div>
          ) : !homeStats || !awayStats ? (
            <div className="text-center py-12 text-white/25">
              {match.status === 'Scheduled' ? 'Estatísticas disponíveis quando o jogo começar' : 'Faz Sync ESPN para carregar estatísticas'}
            </div>
          ) : (
            <div className="bg-wc-navy border border-wc-blue rounded-xl p-6 space-y-5">
              {/* Cabeçalho */}
              <div className="flex justify-between items-center pb-3 border-b border-wc-blue/30">
                <div className="flex items-center gap-2">
                  {match.homeTeam && <img src={match.homeTeam.flagUrl} alt="" className="w-7 h-5 object-cover rounded" />}
                  <span className="text-wc-gold font-bold">{match.homeTeam?.name}</span>
                </div>
                <span className="text-white/30 text-xs">vs</span>
                <div className="flex items-center gap-2">
                  <span className="text-wc-violet font-bold">{match.awayTeam?.name}</span>
                  {match.awayTeam && <img src={match.awayTeam.flagUrl} alt="" className="w-7 h-5 object-cover rounded" />}
                </div>
              </div>

              {/* Barras */}
              {STAT_ORDER.map(key => {
                const hv = parseFloat(homeStats.stats[key] ?? '0');
                const av = parseFloat(awayStats.stats[key] ?? '0');
                if (hv === 0 && av === 0) return null;
                return <StatBar key={key} label={STAT_LABELS[key] ?? key} homeVal={hv} awayVal={av} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
