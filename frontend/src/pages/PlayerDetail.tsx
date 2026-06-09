import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlayerHistory } from '../lib/api';
import type { Player, Match } from '../types';

const posColors: Record<string, string> = {
  GK: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DEF: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MID: 'bg-green-500/20 text-green-300 border-green-500/30',
  FWD: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const posFullName: Record<string, string> = {
  GK: 'Guarda-Redes', DEF: 'Defesa', MID: 'Médio', FWD: 'Avançado',
};

interface MatchHistory {
  match: Match;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  events: Array<{ type: string; minute: number | null; description: string }>;
}

function StatBox({ label, value, color = 'text-white' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-wc-blue/20 rounded-xl p-4 text-center">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="text-white/40 text-xs mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPlayerHistory(Number(id))
      .then(({ player: p, history: h }) => { setPlayer(p); setHistory(h); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;
  if (!player) return <div className="text-center py-20 text-red-400">Jogador não encontrado</div>;

  const gamesPlayed = history.length;
  const totalGoals = history.reduce((s, h) => s + h.goals, 0);
  const totalAssists = history.reduce((s, h) => s + h.assists, 0);
  const shotConversion = player.shots > 0 ? Math.round((player.goals / player.shots) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {player.team && (
        <Link to={`/teams/${player.team.id}`} className="text-wc-gold hover:underline text-sm">
          ← Voltar a {player.team.name}
        </Link>
      )}

      {/* Player header */}
      <div className="bg-wc-navy border border-wc-blue rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center text-2xl font-extrabold ${posColors[player.position]}`}>
              {player.shirtNumber ?? '?'}
            </div>
            {player.isCaptain ? (
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-wc-gold text-wc-dark text-xs font-extrabold flex items-center justify-center shadow-lg" title="Capitão">C</span>
            ) : null}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${posColors[player.position]}`}>{posFullName[player.position]}</span>
              {player.age && <span className="text-white/30 text-xs">{player.age} anos</span>}
            </div>
            <h1 className="text-3xl font-extrabold text-white">{player.name}</h1>

            {player.team && (
              <div className="flex items-center gap-2 mt-2">
                <img src={player.team.flagUrl} className="w-8 h-5 object-cover rounded-sm" />
                <span className="text-white/60 font-medium">{player.team.name}</span>
              </div>
            )}

            {/* Role badges */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {player.isCaptain ? <span className="px-2 py-1 rounded-full bg-wc-gold/20 text-wc-gold text-xs font-bold border border-wc-gold/30">Capitão</span> : null}
              {player.isPenaltyTaker ? <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">Marcador PK</span> : null}
              {player.isFreekickTaker ? <span className="px-2 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold border border-orange-500/30">Marcador FK</span> : null}
              {player.isCornerKicker ? <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">Cobrador CK</span> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Jogos" value={gamesPlayed} />
        <StatBox label="Golos" value={totalGoals} color="text-wc-gold" />
        <StatBox label="Assistências" value={totalAssists} color="text-blue-300" />
        <StatBox label="Minutos" value={player.minutesPlayed} />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Remates" value={player.shots} />
        <StatBox label="Alvo" value={player.shotsOnTarget} />
        <StatBox label="Conversão" value={`${shotConversion}%`} color={shotConversion > 30 ? 'text-green-400' : 'text-white'} />
        <StatBox label="Clean Sheets" value={player.cleanSheets} color="text-yellow-300" />
      </div>

      {/* Cards */}
      {(player.yellowCards > 0 || player.redCards > 0) && (
        <div className="flex gap-3">
          {player.yellowCards > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
              <span className="text-xl">🟨</span>
              <span className="text-yellow-300 font-bold text-lg">{player.yellowCards}</span>
              <span className="text-white/40 text-sm">amarelos</span>
            </div>
          )}
          {player.redCards > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <span className="text-xl">🟥</span>
              <span className="text-red-400 font-bold text-lg">{player.redCards}</span>
              <span className="text-white/40 text-sm">vermelhos</span>
            </div>
          )}
        </div>
      )}

      {/* Match history */}
      <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-wc-blue/30 border-b border-wc-blue">
          <h2 className="text-white font-bold">Histórico de Jogos</h2>
        </div>

        {history.length === 0 ? (
          <div className="py-10 text-center text-white/30 text-sm">
            <div className="text-4xl mb-3">📋</div>
            Sem participação registada ainda
          </div>
        ) : (
          <div className="divide-y divide-wc-blue/10">
            {history.map((h, i) => {
              const isHome = h.match.homeTeamId === player.teamId;
              const opponent = isHome ? h.match.awayTeam : h.match.homeTeam;
              const myScore = isHome ? h.match.homeScore : h.match.awayScore;
              const oppScore = isHome ? h.match.awayScore : h.match.homeScore;
              const result = myScore !== null && oppScore !== null
                ? myScore > oppScore ? 'V' : myScore === oppScore ? 'E' : 'D'
                : null;
              const resultColor = result === 'V' ? 'text-green-400' : result === 'E' ? 'text-yellow-400' : result === 'D' ? 'text-red-400' : 'text-white/30';

              return (
                <Link key={i} to={`/matches/${h.match.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-wc-blue/10 transition-colors">
                  <div className="text-white/30 text-xs w-20">
                    {new Date(h.match.date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    {opponent && <img src={opponent.flagUrl} className="w-6 h-4 object-cover rounded-sm" />}
                    <span className="text-white/70 text-sm">{opponent?.name ?? '?'}</span>
                  </div>
                  <div className="text-white/50 text-xs">
                    {myScore !== null ? `${myScore}–${oppScore}` : '–'}
                  </div>
                  {result && <span className={`text-xs font-bold w-4 text-center ${resultColor}`}>{result}</span>}
                  <div className="flex gap-2 text-xs">
                    {h.goals > 0 && <span className="text-wc-gold font-bold">⚽{h.goals}</span>}
                    {h.assists > 0 && <span className="text-blue-300">🅐{h.assists}</span>}
                    {h.yellowCards > 0 && <span>🟨</span>}
                    {h.redCards > 0 && <span>🟥</span>}
                  </div>
                  {h.events.length === 0 && <span className="text-white/20 text-xs">—</span>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
