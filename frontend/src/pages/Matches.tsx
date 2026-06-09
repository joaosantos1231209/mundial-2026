import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../components/ui/MatchCard';
import { getMatches } from '../lib/api';
import type { Match } from '../types';

const ALL_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const STAGES = ['Group', 'Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Third Place', 'Final'];
const STAGE_LABELS: Record<string, string> = {
  'Group': 'Fase de Grupos',
  'Round of 32': 'Fase dos 32',
  'Round of 16': 'Oitavos de Final',
  'Quarter-Final': 'Quartos de Final',
  'Semi-Final': 'Meias-Finais',
  'Third Place': '3º Lugar',
  'Final': 'Final',
};

function groupByDate(matches: Match[]) {
  const grouped: Record<string, Match[]> = {};
  for (const m of matches) {
    const day = m.date.split('T')[0];
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(m);
  }
  return grouped;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function Matches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const filterGroup = searchParams.get('group') || '';
  const filterStage = searchParams.get('stage') || '';
  const filterStatus = searchParams.get('status') || '';

  useEffect(() => {
    getMatches().then(setAllMatches).finally(() => setLoading(false));
  }, []);

  const filtered = allMatches.filter(m => {
    if (filterGroup && m.groupName !== filterGroup) return false;
    if (filterStage && m.stage !== filterStage) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    return true;
  });

  const grouped = groupByDate(filtered);
  const sortedDates = Object.keys(grouped).sort();

  const setFilter = (key: string, val: string) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    setSearchParams(p);
  };

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-extrabold text-white">Calendário</h1>
        <span className="text-white/30 text-sm">🕐 hora de Portugal</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-wc-navy border border-wc-blue rounded-xl">
        {/* Stage */}
        <div className="flex items-center gap-2">
          <label className="text-white/50 text-xs uppercase tracking-wider">Fase:</label>
          <select
            value={filterStage}
            onChange={e => {
              const p = new URLSearchParams(searchParams);
              if (e.target.value) p.set('stage', e.target.value); else p.delete('stage');
              p.delete('group');
              setSearchParams(p);
            }}
            className="bg-wc-blue text-white text-sm rounded-lg px-3 py-1.5 border border-wc-blue/50 focus:outline-none focus:border-wc-gold"
          >
            <option value="">Todas</option>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s] ?? s}</option>)}
          </select>
        </div>

        {/* Group (only shown for group stage) */}
        {(filterStage === 'Group' || !filterStage) && (
          <div className="flex items-center gap-2">
            <label className="text-white/50 text-xs uppercase tracking-wider">Grupo:</label>
            <select
              value={filterGroup}
              onChange={e => setFilter('group', e.target.value)}
              className="bg-wc-blue text-white text-sm rounded-lg px-3 py-1.5 border border-wc-blue/50 focus:outline-none focus:border-wc-gold"
            >
              <option value="">Todos</option>
              {ALL_GROUPS.map(g => <option key={g} value={g}>Grupo {g}</option>)}
            </select>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          <label className="text-white/50 text-xs uppercase tracking-wider">Estado:</label>
          <select
            value={filterStatus}
            onChange={e => setFilter('status', e.target.value)}
            className="bg-wc-blue text-white text-sm rounded-lg px-3 py-1.5 border border-wc-blue/50 focus:outline-none focus:border-wc-gold"
          >
            <option value="">Todos</option>
            <option value="Scheduled">Agendados</option>
            <option value="Live">Ao Vivo</option>
            <option value="Finished">Terminados</option>
          </select>
        </div>

        {(filterGroup || filterStage || filterStatus) && (
          <button
            onClick={() => setSearchParams({})}
            className="text-white/40 hover:text-white text-xs underline"
          >
            Limpar filtros
          </button>
        )}

        <span className="ml-auto text-white/30 text-sm self-center">{filtered.length} jogos</span>
      </div>

      {/* Matches by date */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <div className="text-4xl mb-3">📅</div>
          <p>Nenhum jogo encontrado com os filtros selecionados</p>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date}>
            <h3 className="text-wc-gold font-semibold text-sm uppercase tracking-wider mb-3 capitalize">
              {formatDate(date)}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {grouped[date].map(m => <MatchCard key={m.id} match={m} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
