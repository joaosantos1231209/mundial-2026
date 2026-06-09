import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTeams } from '../lib/api';
import type { Team } from '../types';

const ALL_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  useEffect(() => {
    getTeams().then(setTeams).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;

  const filtered = teams.filter(t => {
    if (filterGroup && t.group !== filterGroup) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byGroup = ALL_GROUPS
    .filter(g => !filterGroup || g === filterGroup)
    .map(g => ({ group: g, teams: filtered.filter(t => t.group === g) }))
    .filter(g => g.teams.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white">Equipas</h1>
        <span className="text-white/40 text-sm">{teams.length} equipas qualificadas</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Pesquisar equipa..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-wc-blue border border-wc-blue/50 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-wc-gold placeholder-white/30 flex-1 min-w-48" />
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold">
          <option value="">Todos os grupos</option>
          {ALL_GROUPS.map(g => <option key={g} value={g}>Grupo {g}</option>)}
        </select>
      </div>

      {/* Teams by Group */}
      {byGroup.map(({ group, teams: groupTeams }) => (
        <div key={group}>
          <h3 className="text-wc-gold font-bold text-sm uppercase tracking-widest mb-3">Grupo {group}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {groupTeams.map(team => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="bg-wc-navy border border-wc-blue rounded-xl p-4 hover:border-wc-gold/50 hover:shadow-lg hover:shadow-wc-gold/5 transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img src={team.flagUrl} alt={team.code} className="w-10 h-7 object-cover rounded shadow" />
                  <div>
                    <div className="font-bold text-white group-hover:text-wc-gold transition-colors">{team.name}</div>
                    <div className="text-white/40 text-xs">{team.code} · {team.defaultFormation}</div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-white/50 border-t border-wc-blue/30 pt-3">
                  <span>{team.wins}V {team.draws}E {team.losses}D</span>
                  <span className="text-wc-gold font-bold">{team.points} pts</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-white/30">
          <div className="text-4xl mb-3">🔍</div>
          <p>Nenhuma equipa encontrada</p>
        </div>
      )}
    </div>
  );
}
