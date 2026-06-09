import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTeam, getMatches } from '../lib/api';
import MatchCard from '../components/ui/MatchCard';
import type { Team, Player, Match } from '../types';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

const posColors: Record<string, string> = {
  GK: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DEF: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MID: 'bg-green-500/20 text-green-300 border-green-500/30',
  FWD: 'bg-red-500/20 text-red-300 border-red-500/30',
};

type ActiveTab = 'squad' | 'matches';

function RoleBadges({ player }: { player: Player }) {
  if (!player.isCaptain && !player.isViceCaptain) return null;
  return (
    <div className="flex gap-1">
      {!!player.isCaptain && <span title="Capitão" className="text-xs font-bold px-1.5 py-0.5 rounded bg-wc-gold text-wc-dark">C</span>}
      {!!player.isViceCaptain && <span title="Vice-Capitão" className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">VC</span>}
    </div>
  );
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('squad');

useEffect(() => {
    if (!id) return;
    const teamId = Number(id);
    Promise.all([
      getTeam(teamId),
      getMatches(),
    ]).then(([t, allMatches]) => {
      setTeam(t);
      setTeamMatches(allMatches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;
  if (!team) return <div className="text-center py-20 text-red-400">Equipa não encontrada</div>;

  const playersByPos = POSITIONS.map(pos => ({
    pos, players: (team.players || []).filter(p => p.position === pos).sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
  }));

  const finishedMatches = teamMatches.filter(m => m.status === 'Finished');
  const upcomingMatches = teamMatches.filter(m => m.status !== 'Finished');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to="/teams" className="text-wc-gold hover:underline text-sm">← Voltar às equipas</Link>

      {/* Header */}
      <div className="bg-wc-navy border border-wc-blue rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <img src={team.flagUrl} alt={team.code} className="w-24 h-16 object-cover rounded-lg shadow-xl" />
          <div className="flex-1">
            <div className="text-white/40 text-sm uppercase tracking-wider mb-1">Grupo {team.group}</div>
            <h1 className="text-3xl font-extrabold text-white">{team.name}</h1>
            <div className="text-wc-gold text-lg font-bold">{team.code}</div>
          </div>
          <div className="text-right">
            <div className="text-wc-gold text-3xl font-extrabold">{team.points}</div>
            <div className="text-white/40 text-sm">pontos</div>
            <div className="text-white/60 text-sm mt-1">{team.wins}V {team.draws}E {team.losses}D</div>
            <div className="text-white/40 text-xs">{team.goalsFor} GF · {team.goalsAgainst} GS</div>
          </div>
        </div>
      </div>

      {/* Formation */}
      <div className="bg-wc-navy border border-wc-blue rounded-xl px-5 py-3 flex items-center gap-3">
        <span className="text-white/50 text-sm">Formação:</span>
        <span className="text-wc-gold font-extrabold text-xl">{team.defaultFormation}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-wc-blue/20 p-1 rounded-xl">
        {([
          { id: 'squad', label: '👥 Plantel' },
          { id: 'matches', label: '📅 Jogos' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-wc-navy text-wc-gold shadow' : 'text-white/50 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Squad */}
      {activeTab === 'squad' && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-wc-blue/40 border-b border-wc-blue">
            <span className="text-wc-gold font-bold uppercase tracking-wider text-sm">
              Plantel ({team.players?.length ?? 0})
            </span>
          </div>
          <div className="divide-y divide-wc-blue/20">
            {playersByPos.map(({ pos, players: posPlayers }) => posPlayers.length > 0 && (
              <div key={pos}>
                <div className="px-5 py-2 bg-wc-blue/20">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${posColors[pos]}`}>{pos}</span>
                </div>
                {posPlayers.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-wc-blue/20 transition-colors">
                    <span className="text-white/30 text-sm font-mono w-6 text-right">{p.shirtNumber ?? '–'}</span>
                    <Link to={`/players/${p.id}`} className="flex-1 text-white font-medium text-sm hover:text-wc-gold transition-colors">
                      {p.name}
                    </Link>
                    <RoleBadges player={p} />
                    <div className="flex gap-3 text-xs text-white/40">
                      {p.goals > 0 && <span>⚽ {p.goals}</span>}
                      {p.assists > 0 && <span>🎯 {p.assists}</span>}
                      {p.minutesPlayed > 0 && <span>⏱ {p.minutesPlayed}'</span>}
                      {p.yellowCards > 0 && <span>🟨 {p.yellowCards}</span>}
                      {p.redCards > 0 && <span>🟥 {p.redCards}</span>}
                      {p.cleanSheets > 0 && <span>🧤 {p.cleanSheets}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {(team.players?.length ?? 0) === 0 && (
              <div className="py-12 text-center text-white/30 text-sm">
                Plantel vazio. Usa o painel Admin para sincronizar os plantéis.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Matches */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          {upcomingMatches.length > 0 && (
            <div>
              <h3 className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-3">Próximos Jogos</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {upcomingMatches.map(m => <MatchCard key={m.id} match={m} showDate />)}
              </div>
            </div>
          )}
          {finishedMatches.length > 0 && (
            <div>
              <h3 className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-3">Resultados</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {[...finishedMatches].reverse().map(m => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}
          {teamMatches.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">Sem jogos para esta equipa</div>
          )}
        </div>
      )}
    </div>
  );
}
