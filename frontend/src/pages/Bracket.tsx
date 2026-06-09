import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMatches, getGroupStandings, getBestThirds } from '../lib/api';
import type { Match, GroupStandings, TeamStat } from '../types';

const KNOCKOUT_STAGES = ['Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Third Place', 'Final'];

// Which group-position feeds each Round of 32 slot (FIFA 2026 bracket)
const ROUND32_SLOTS = [
  { label: '1A vs 2B', pos1: { group: 'A', rank: 1 }, pos2: { group: 'B', rank: 2 } },
  { label: '1C vs 2D', pos1: { group: 'C', rank: 1 }, pos2: { group: 'D', rank: 2 } },
  { label: '1E vs 2F', pos1: { group: 'E', rank: 1 }, pos2: { group: 'F', rank: 2 } },
  { label: '1G vs 2H', pos1: { group: 'G', rank: 1 }, pos2: { group: 'H', rank: 2 } },
  { label: '1I vs 2J', pos1: { group: 'I', rank: 1 }, pos2: { group: 'J', rank: 2 } },
  { label: '1K vs 2L', pos1: { group: 'K', rank: 1 }, pos2: { group: 'L', rank: 2 } },
  { label: '1B vs 2A', pos1: { group: 'B', rank: 1 }, pos2: { group: 'A', rank: 2 } },
  { label: '1D vs 2C', pos1: { group: 'D', rank: 1 }, pos2: { group: 'C', rank: 2 } },
  { label: '1F vs 2E', pos1: { group: 'F', rank: 1 }, pos2: { group: 'E', rank: 2 } },
  { label: '1H vs 2G', pos1: { group: 'H', rank: 1 }, pos2: { group: 'G', rank: 2 } },
  { label: '1J vs 2I', pos1: { group: 'J', rank: 1 }, pos2: { group: 'I', rank: 2 } },
  { label: '1L vs 2K', pos1: { group: 'L', rank: 1 }, pos2: { group: 'K', rank: 2 } },
  { label: '3º #1 vs 3º #2', pos1: null, pos2: null },
  { label: '3º #3 vs 3º #4', pos1: null, pos2: null },
  { label: '3º #5 vs 3º #6', pos1: null, pos2: null },
  { label: '3º #7 vs 3º #8', pos1: null, pos2: null },
];

function isGroupComplete(groupName: string, allMatches: Match[]): boolean {
  const gm = allMatches.filter(m => m.groupName === groupName && m.stage === 'Group');
  return gm.length > 0 && gm.every(m => m.status === 'Finished');
}

function BracketMatch({ match, provisional, label }: { match?: Match; provisional?: { home?: string; away?: string }; label?: string }) {
  const isProvisional = !match && provisional && (provisional.home || provisional.away);

  if (isProvisional) {
    return (
      <div className="bg-wc-blue/20 border border-dashed border-wc-gold/20 rounded-lg p-3 w-52">
        {label && <div className="text-white/20 text-xs mb-2 text-center">{label}</div>}
        <div className="flex items-center gap-2 h-6 text-white/30">
          <span className="text-xs flex-1 truncate italic">{provisional.home ?? 'A definir'}</span>
        </div>
        <div className="text-center text-white/20 text-xs my-1">vs</div>
        <div className="flex items-center gap-2 h-6 text-white/30">
          <span className="text-xs flex-1 truncate italic">{provisional.away ?? 'A definir'}</span>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="bg-wc-blue/20 border border-wc-blue/30 rounded-lg p-3 w-52 opacity-40">
        {label && <div className="text-white/20 text-xs mb-2 text-center">{label}</div>}
        <div className="h-6 bg-wc-blue/30 rounded mb-1"></div>
        <div className="text-center text-white/20 text-xs my-1">vs</div>
        <div className="h-6 bg-wc-blue/30 rounded"></div>
      </div>
    );
  }

  return (
    <Link to={`/matches/${match.id}`}>
      <div className="bg-wc-navy border border-wc-blue hover:border-wc-gold/50 rounded-lg p-3 w-52 transition-all">
        {label && <div className="text-white/20 text-xs mb-2 text-center">{label}</div>}
        <TeamRow team={match.homeTeam} score={match.homeScore} winner={match.status === 'Finished' && match.homeScore! > match.awayScore!} />
        <div className="text-center text-white/20 text-xs my-1">vs</div>
        <TeamRow team={match.awayTeam} score={match.awayScore} winner={match.status === 'Finished' && match.awayScore! > match.homeScore!} />
      </div>
    </Link>
  );
}

function TeamRow({ team, score, winner }: { team?: { name: string; flagUrl: string } | null; score: number | null; winner: boolean }) {
  if (!team) return <div className="flex items-center gap-2 h-6"><span className="text-white/20 text-xs italic">A definir</span></div>;
  return (
    <div className={`flex items-center gap-2 h-6 ${winner ? 'text-wc-gold font-bold' : 'text-white/70'}`}>
      <img src={team.flagUrl} alt="" className="w-5 h-3 object-cover rounded-sm" />
      <span className="text-xs flex-1 truncate">{team.name}</span>
      {score !== null && <span className="font-bold text-sm">{score}</span>}
    </div>
  );
}

export default function Bracket() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<GroupStandings>({});
  const [bestThirds, setBestThirds] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMatches(), getGroupStandings(), getBestThirds()])
      .then(([all, gs, bt]) => {
        setAllMatches(all);
        setMatches(all.filter(m => m.stage !== 'Group'));
        setStandings(gs);
        setBestThirds(bt);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;

  const byStage = (stage: string) => matches.filter(m => m.stage === stage);

  // Build provisional R32 slots based on current group standings
  const provisionalR32 = ROUND32_SLOTS.map((slot, i) => {
    // Check if there's already a real match for this slot
    const realMatch = byStage('Round of 32')[i];
    if (realMatch) return { match: realMatch, provisional: undefined, label: slot.label };

    if (!slot.pos1 && !slot.pos2) {
      // Best thirds slots
      const t1 = bestThirds[i - 12];
      const t2 = bestThirds[i - 11];
      return {
        match: undefined,
        provisional: { home: t1?.name, away: t2?.name },
        label: slot.label,
      };
    }

    const g1Complete = slot.pos1 ? isGroupComplete(slot.pos1.group, allMatches) : false;
    const g2Complete = slot.pos2 ? isGroupComplete(slot.pos2.group, allMatches) : false;

    const team1 = slot.pos1 ? standings[slot.pos1.group]?.[slot.pos1.rank - 1] : undefined;
    const team2 = slot.pos2 ? standings[slot.pos2.group]?.[slot.pos2.rank - 1] : undefined;

    const hasProvisional = team1 || team2;
    return {
      match: undefined,
      provisional: hasProvisional ? {
        home: team1?.name ? `${team1.name}${!g1Complete ? ' *' : ''}` : undefined,
        away: team2?.name ? `${team2.name}${!g2Complete ? ' *' : ''}` : undefined,
      } : undefined,
      label: slot.label,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Fase Eliminatória</h1>
          <p className="text-white/30 text-sm mt-1">* Posição provisória (grupo ainda não concluído)</p>
        </div>
        <span className="text-white/40 text-sm">Atualiza automaticamente com os grupos</span>
      </div>

      {/* No knockout matches yet — show projected bracket */}
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-4">

          {/* Round of 32 — projected */}
          <div className="flex flex-col">
            <div className="text-wc-gold text-xs font-bold uppercase tracking-widest mb-4 text-center">Oitavos de Final</div>
            <div className="flex flex-col gap-4">
              {provisionalR32.map((slot, i) => (
                <BracketMatch
                  key={i}
                  match={slot.match}
                  provisional={slot.provisional}
                  label={slot.label}
                />
              ))}
            </div>
          </div>

          {/* Remaining stages */}
          {KNOCKOUT_STAGES.filter(s => s !== 'Round of 32').map(stage => {
            const stageMatches = byStage(stage);
            return (
              <div key={stage} className="flex flex-col">
                <div className="text-wc-gold text-xs font-bold uppercase tracking-widest mb-4 text-center">
                  {stage === 'Round of 16' ? '16 Avos' :
                   stage === 'Quarter-Final' ? 'Quartos' :
                   stage === 'Semi-Final' ? 'Meias' :
                   stage === 'Third Place' ? '3º Lugar' : stage}
                </div>
                <div className="flex flex-col justify-around gap-4 flex-1">
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

      {/* Best thirds */}
      {bestThirds.length > 0 && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-wc-blue/20 border-b border-wc-blue">
            <h3 className="text-white/70 text-xs font-bold uppercase tracking-wider">Melhores 3ºs Classificados (atual)</h3>
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
