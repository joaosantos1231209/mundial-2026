import { Link } from 'react-router-dom';
import type { Team } from '../../types';

interface Props {
  teams: Team[];
  groupName: string;
  compact?: boolean;
}

export default function StandingsTable({ teams, groupName, compact }: Props) {
  const sorted = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  const played = (t: Team) => t.wins + t.draws + t.losses;
  const gd = (t: Team) => t.goalsFor - t.goalsAgainst;

  return (
    <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-wc-blue/40 border-b border-wc-blue flex items-center gap-2">
        <span className="text-wc-gold font-bold text-sm tracking-wider">GRUPO {groupName}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/40 text-xs uppercase border-b border-wc-blue/50">
            <th className="text-left pl-4 py-2 w-8">#</th>
            <th className="text-left py-2">Equipa</th>
            {!compact && <th className="text-center py-2 w-10">J</th>}
            <th className="text-center py-2 w-10">V</th>
            <th className="text-center py-2 w-10">E</th>
            <th className="text-center py-2 w-10">D</th>
            {!compact && (
              <>
                <th className="text-center py-2 w-10">GM</th>
                <th className="text-center py-2 w-10">GS</th>
                <th className="text-center py-2 w-10">DG</th>
              </>
            )}
            <th className="text-center py-2 w-10 text-wc-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, idx) => (
            <tr
              key={team.id}
              className={`border-b border-wc-blue/30 last:border-0 hover:bg-wc-blue/20 transition-colors ${
                idx < 2 ? 'border-l-2 border-l-wc-gold' :
                idx === 2 ? 'border-l-2 border-l-gray-500 bg-white/[0.03]' : ''
              }`}
            >
              <td className="pl-4 py-3 text-white/40 font-medium">{idx + 1}</td>
              <td className="py-3">
                <Link to={`/teams/${team.id}`} className="flex items-center gap-2 hover:text-wc-gold transition-colors">
                  <img src={team.flagUrl} alt={team.code} className="w-6 h-4 object-cover rounded-sm" />
                  <span className="font-medium text-white">{team.name}</span>
                  <span className="text-white/30 text-xs">{team.code}</span>
                </Link>
              </td>
              {!compact && <td className="text-center py-3 text-white/60">{played(team)}</td>}
              <td className="text-center py-3 text-white/80">{team.wins}</td>
              <td className="text-center py-3 text-white/80">{team.draws}</td>
              <td className="text-center py-3 text-white/80">{team.losses}</td>
              {!compact && (
                <>
                  <td className="text-center py-3 text-white/60">{team.goalsFor}</td>
                  <td className="text-center py-3 text-white/60">{team.goalsAgainst}</td>
                  <td className={`text-center py-3 font-medium ${gd(team) > 0 ? 'text-green-400' : gd(team) < 0 ? 'text-red-400' : 'text-white/60'}`}>
                    {gd(team) > 0 ? `+${gd(team)}` : gd(team)}
                  </td>
                </>
              )}
              <td className="text-center py-3 font-bold text-wc-gold text-base">{team.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!compact && (
        <div className="px-4 py-2 text-xs text-white/30 border-t border-wc-blue/30 space-y-1">
          <div><span className="inline-block w-3 h-3 bg-wc-gold rounded-sm mr-1 align-middle"></span>Top 2 avançam para a fase eliminatória</div>
          <div><span className="inline-block w-3 h-3 bg-gray-500/60 rounded-sm mr-1 align-middle"></span>8 melhores 3ºs avançam</div>
        </div>
      )}
    </div>
  );
}
