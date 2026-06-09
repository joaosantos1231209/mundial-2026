import type { Player } from '../../types';

interface Props {
  title: string;
  icon: string;
  players: Player[];
  statKey: 'goals' | 'assists' | 'cleanSheets';
  statLabel: string;
  limit?: number;
}

const positionColors = {
  GK: 'bg-yellow-500/20 text-yellow-300',
  DEF: 'bg-blue-500/20 text-blue-300',
  MID: 'bg-green-500/20 text-green-300',
  FWD: 'bg-red-500/20 text-red-300',
};

export default function StatCard({ title, icon, players, statKey, statLabel, limit = 10 }: Props) {
  const ranked = [...players]
    .sort((a, b) => b[statKey] - a[statKey])
    .filter(p => p[statKey] > 0)
    .slice(0, limit);

  return (
    <div className="rounded-xl overflow-hidden border border-wc-blue/50"
      style={{ background: 'linear-gradient(160deg, rgba(26,34,80,0.6) 0%, rgba(13,17,48,0.9) 100%)' }}
    >
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2"
        style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.15), rgba(26,34,80,0.5))' }}
      >
        <span className="text-xl">{icon}</span>
        <span className="text-wc-gold font-bold text-sm tracking-wider uppercase">{title}</span>
      </div>
      {ranked.length === 0 ? (
        <div className="py-10 text-center text-white/30 text-sm">Sem dados ainda</div>
      ) : (
        <div className="divide-y divide-white/4">
          {ranked.map((player, idx) => (
            <div key={player.id} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/4 ${idx === 0 ? 'top2-row' : ''}`}>
              <span className={`text-sm font-bold w-6 text-center ${idx === 0 ? 'text-gradient-gold' : 'text-white/30'}`}>
                {idx + 1}
              </span>
              {player.team && (
                <img src={player.team.flagUrl} alt={player.team.code} className="w-6 h-4 object-cover rounded-sm" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{player.name}</div>
                <div className="text-white/35 text-xs">{player.team?.name}</div>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded ${positionColors[player.position] || ''}`}>
                {player.position}
              </span>
              <div className="text-right">
                <span className="text-wc-gold font-bold text-lg">{player[statKey]}</span>
                <div className="text-white/25 text-xs">{statLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
