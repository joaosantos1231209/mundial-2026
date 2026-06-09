import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, getBestThirds } from '../lib/api';
import type { Match, TeamStat } from '../types';

const KNOCKOUT_STAGES = ['Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Third Place', 'Final'];

const STAGE_LABELS: Record<string, string> = {
  'Round of 32': 'Fase dos 32',
  'Round of 16': 'Oitavos de Final',
  'Quarter-Final': 'Quartos de Final',
  'Semi-Final': 'Meias-Finais',
  'Third Place': '3º Lugar',
  'Final': 'Final',
};

function BracketMatch({ match }: { match?: Match }) {
  if (!match) {
    return (
      <div className="bg-wc-blue/20 border border-wc-blue/30 rounded-lg p-3 w-52 opacity-40">
        <div className="h-6 bg-wc-blue/30 rounded mb-1" />
        <div className="text-center text-white/20 text-xs my-1">vs</div>
        <div className="h-6 bg-wc-blue/30 rounded" />
      </div>
    );
  }

  return (
    <Link to={`/matches/${match.id}`}>
      <div className="bg-wc-navy border border-wc-blue hover:border-wc-gold/50 rounded-lg p-3 w-52 transition-all">
        <TeamRow
          team={match.homeTeam}
          label={match.homeLabel}
          score={match.homeScore}
          winner={match.status === 'Finished' && (match.homeScore ?? 0) > (match.awayScore ?? 0)}
        />
        <div className="text-center text-white/20 text-xs my-1">vs</div>
        <TeamRow
          team={match.awayTeam}
          label={match.awayLabel}
          score={match.awayScore}
          winner={match.status === 'Finished' && (match.awayScore ?? 0) > (match.homeScore ?? 0)}
        />
      </div>
    </Link>
  );
}

function TeamRow({ team, label, score, winner }: {
  team?: { name: string; flagUrl: string; code?: string } | null;
  label?: string | null;
  score: number | null;
  winner: boolean;
}) {
  const isPlaceholder = !!label || !team?.flagUrl;
  const displayName = label ?? team?.name ?? 'A definir';

  return (
    <div className={`flex items-center gap-2 h-6 ${winner ? 'text-wc-gold font-bold' : isPlaceholder ? 'text-white/30' : 'text-white/70'}`}>
      {isPlaceholder
        ? <div className="w-5 h-3 bg-wc-blue/60 rounded-sm flex-shrink-0" />
        : <img src={team!.flagUrl} alt="" className="w-5 h-3 object-cover rounded-sm flex-shrink-0" />
      }
      <span className={`text-xs flex-1 truncate ${isPlaceholder ? 'italic' : ''}`}>{displayName}</span>
      {score !== null && !isPlaceholder && <span className="font-bold text-sm">{score}</span>}
    </div>
  );
}

export default function Bracket() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [bestThirds, setBestThirds] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMatches(), getBestThirds()])
      .then(([all, bt]) => {
        setMatches(all.filter(m => m.stage !== 'Group'));
        setBestThirds(bt);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;

  const byStage = (stage: string) => matches.filter(m => m.stage === stage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-extrabold text-white">Fase Eliminatória</h1>
        <span className="text-white/40 text-sm">Atualiza automaticamente</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-4">
          {KNOCKOUT_STAGES.map(stage => {
            const stageMatches = byStage(stage);
            return (
              <div key={stage} className="flex flex-col">
                <div className="text-wc-gold text-xs font-bold uppercase tracking-widest mb-4 text-center">
                  {STAGE_LABELS[stage] ?? stage}
                </div>
                <div className="flex flex-col justify-around gap-3 flex-1">
                  {stageMatches.length > 0
                    ? stageMatches.map(m => <BracketMatch key={m.id} match={m} />)
                    : <BracketMatch />
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {bestThirds.length > 0 && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-wc-blue/20 border-b border-wc-blue">
            <h3 className="text-white/70 text-xs font-bold uppercase tracking-wider">Melhores 3ºs Classificados</h3>
          </div>
          <div className="flex flex-wrap gap-0 divide-x divide-wc-blue/20">
            {bestThirds.slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3 flex-1 min-w-fit">
                <span className="text-wc-gold font-bold text-xs w-4">{i + 1}</span>
                <img src={t.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                <span className="text-white/70 text-xs">{t.name}</span>
                <span className="text-wc-gold font-bold text-xs ml-auto">{t.pts}pt</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
