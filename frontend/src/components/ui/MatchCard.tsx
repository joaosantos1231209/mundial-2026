import { Link } from 'react-router-dom';
import type { Match, Team } from '../../types';

interface Props {
  match: Match;
  compact?: boolean;
  showDate?: boolean;
}

const statusColors = {
  Scheduled: 'bg-blue-500/20 text-blue-300',
  Live: 'bg-green-500/20 text-green-300 animate-pulse',
  Finished: 'bg-gray-500/20 text-gray-400',
};

const statusLabels = {
  Scheduled: 'Agendado',
  Live: 'AO VIVO',
  Finished: 'Terminado',
};

function formatTime(dateStr: string): string {
  if (!dateStr.includes('T')) return '';
  return dateStr.split('T')[1].substring(0, 5);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
  const weekday = d.toLocaleDateString('pt-PT', { weekday: 'short' });
  const day = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  return `${weekday.replace('.', '')} ${day}`;
}

function TeamSlot({ team, label, align, compact, winner }: {
  team?: Team;
  label?: string | null;
  align: 'left' | 'right';
  compact?: boolean;
  winner?: boolean;
}) {
  const displayName = label ?? team?.name ?? '?';
  const isPlaceholder = !!label || !team?.flagUrl;
  const textClass = `font-semibold ${compact ? 'text-sm' : 'text-base'} ${winner ? 'text-wc-gold' : 'text-white'} ${isPlaceholder ? 'text-white/60 italic' : ''}`;

  const flag = isPlaceholder
    ? <div className="w-8 h-5 bg-wc-blue/80 rounded-sm flex items-center justify-center text-white/20 text-[9px] font-bold flex-shrink-0">?</div>
    : <img src={team!.flagUrl} alt={team!.code} className="w-8 h-5 object-cover rounded-sm shadow flex-shrink-0" />;

  if (align === 'right') {
    return (
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className={`text-right ${textClass}`}>{displayName}</span>
        {flag}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-1">
      {flag}
      <span className={textClass}>{displayName}</span>
    </div>
  );
}

export default function MatchCard({ match, compact, showDate }: Props) {
  const { homeTeam, awayTeam, homeLabel, awayLabel, homeScore, awayScore, status, date, stage, groupName, venue } = match;
  const time = formatTime(date);

  const isFinished = status === 'Finished';
  const isLive = status === 'Live';
  const isScheduled = status === 'Scheduled';

  const STAGE_LABELS: Record<string, string> = {
    'Group': `Grupo ${groupName}`,
    'Round of 32': 'Fase dos 32',
    'Round of 16': 'Oitavos de Final',
    'Quarter-Final': 'Quartos de Final',
    'Semi-Final': 'Meias-Finais',
    'Third Place': '3º Lugar',
    'Final': 'Final',
  };

  return (
    <div className="relative">
        <Link to={`/matches/${match.id}`} className="block">
          <div className="rounded-xl p-4 transition-all duration-200 hover:shadow-glow-gold border overflow-hidden"
            style={{
              backgroundImage: 'linear-gradient(135deg, rgba(26,34,80,0.88) 0%, rgba(13,17,48,0.92) 100%), url(https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800)',
              backgroundSize: 'auto, cover',
              backgroundPosition: 'auto, center',
              borderColor: isLive ? 'rgba(124,58,237,0.5)' : 'rgba(26,34,80,0.8)',
            }}
          >
            {/* Stage + Status */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
                {STAGE_LABELS[stage] ?? stage}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[status]}`}>
                {statusLabels[status]}
              </span>
            </div>

            {/* Teams & Score */}
            <div className="flex items-center justify-between gap-4">
              <TeamSlot team={homeTeam} label={homeLabel} align="right" compact={compact}
                winner={isFinished && (homeScore ?? 0) > (awayScore ?? 0)} />

              {/* Score / Time */}
              <div className="flex items-center gap-2 shrink-0">
                {isFinished ? (
                  <div className="flex items-center gap-1 bg-wc-blue px-3 py-1.5 rounded-lg">
                    <span className="text-xl font-bold text-white">{homeScore}</span>
                    <span className="text-white/40 mx-1">–</span>
                    <span className="text-xl font-bold text-white">{awayScore}</span>
                  </div>
                ) : isLive ? (
                  <div className="flex items-center gap-1 bg-green-900/40 border border-green-500/30 px-3 py-1.5 rounded-lg">
                    <span className="text-xl font-bold text-white">{homeScore ?? 0}</span>
                    <span className="text-green-400/60 mx-1">–</span>
                    <span className="text-xl font-bold text-white">{awayScore ?? 0}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center bg-wc-blue/50 px-3 py-1 rounded-lg min-w-[70px] justify-center">
                    {showDate && isScheduled && (
                      <span className="text-white/40 text-xs font-medium capitalize">
                        {formatShortDate(date)}
                      </span>
                    )}
                    <span className="text-base font-bold text-white font-mono">{time || '—'}</span>
                  </div>
                )}
              </div>

              <TeamSlot team={awayTeam} label={awayLabel} align="left" compact={compact}
                winner={isFinished && (awayScore ?? 0) > (homeScore ?? 0)} />
            </div>

            {/* Venue */}
            {!compact && venue && (
              <div className="mt-3 text-center text-xs text-white/30">
                📍 {venue}
              </div>
            )}
          </div>
        </Link>
      </div>
  );
}
