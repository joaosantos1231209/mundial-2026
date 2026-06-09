import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StandingsTable from '../components/ui/StandingsTable';
import MatchCard from '../components/ui/MatchCard';
import { getGroupStandings, getMatches } from '../lib/api';
import type { GroupStandings, Match } from '../types';

const ALL_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function Groups() {
  const [standings, setStandings] = useState<GroupStandings>({});
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getGroupStandings(), getMatches({ stage: 'Group' })])
      .then(([s, m]) => { setStandings(s); setMatches(m); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;

  const groupTeams = standings[selectedGroup] || [];
  const groupMatches = matches.filter(m => m.groupName === selectedGroup);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white">Fase de Grupos</h1>
        <Link to="/matches?stage=Group" className="text-wc-gold text-sm hover:underline">Ver todos os jogos →</Link>
      </div>

      {/* Group Tabs */}
      <div className="flex flex-wrap gap-2">
        {ALL_GROUPS.map(g => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              selectedGroup === g
                ? 'bg-wc-gold text-wc-dark'
                : 'bg-wc-blue text-white/70 hover:bg-wc-blue/70 hover:text-white'
            }`}
          >
            Grupo {g}
          </button>
        ))}
      </div>

      {/* Selected Group Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Standings */}
        <div>
          {groupTeams.length > 0 ? (
            <StandingsTable teams={groupTeams} groupName={selectedGroup} />
          ) : (
            <div className="bg-wc-navy border border-wc-blue rounded-xl p-8 text-center text-white/30">
              Sem dados para o Grupo {selectedGroup}
            </div>
          )}
        </div>

        {/* Matches */}
        <div className="space-y-3">
          <h3 className="text-white/60 text-sm font-semibold uppercase tracking-wider">Jogos do Grupo {selectedGroup}</h3>
          {groupMatches.length === 0 ? (
            <div className="text-white/30 text-sm py-4">Sem jogos</div>
          ) : (
            groupMatches.map(m => <MatchCard key={m.id} match={m} compact />)
          )}
        </div>
      </div>

      {/* All Groups Overview */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-white mb-4">Visão Geral — Todos os Grupos</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ALL_GROUPS.map(g => (
            <button key={g} onClick={() => { setSelectedGroup(g); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-left">
              <StandingsTable teams={standings[g] || []} groupName={g} compact />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
