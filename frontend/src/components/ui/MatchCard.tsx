import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../../types';
import QuickEditModal from '../QuickEditModal';

interface Props {
  match: Match;
  compact?: boolean;
  onUpdated?: () => void;
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

export default function MatchCard({ match, compact, onUpdated }: Props) {
  const { homeTeam, awayTeam, homeScore, awayScore, status, date, stage, groupName, venue } = match;
  const [showEdit, setShowEdit] = useState(false);
  const time = formatTime(date);
  if (!homeTeam || !awayTeam) return null;

  const isFinished = status === 'Finished';
  const isLive = status === 'Live';

  return (
    <>
      <div className="relative group/card">
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
                {stage === 'Group' ? `Grupo ${groupName}` : stage}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[status]}`}>
                  {statusLabels[status]}
                </span>
              </div>
            </div>

            {/* Teams & Score */}
            <div className="flex items-center justify-between gap-4">
              {/* Home Team */}
              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className={`font-semibold text-right ${compact ? 'text-sm' : 'text-base'} ${isFinished && homeScore! > awayScore! ? 'text-wc-gold' : 'text-white'}`}>
                  {homeTeam.name}
                </span>
                <img src={homeTeam.flagUrl} alt={homeTeam.code} className="w-8 h-5 object-cover rounded-sm shadow" />
              </div>

              {/* Score */}
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
                  <div className="flex items-center bg-wc-blue/50 px-3 py-1.5 rounded-lg min-w-[70px] justify-center">
                    <span className="text-base font-bold text-white font-mono">{time || '—'}</span>
                  </div>
                )}
              </div>

              {/* Away Team */}
              <div className="flex items-center gap-2 flex-1">
                <img src={awayTeam.flagUrl} alt={awayTeam.code} className="w-8 h-5 object-cover rounded-sm shadow" />
                <span className={`font-semibold ${compact ? 'text-sm' : 'text-base'} ${isFinished && awayScore! > homeScore! ? 'text-wc-gold' : 'text-white'}`}>
                  {awayTeam.name}
                </span>
              </div>
            </div>

            {/* Venue */}
            {!compact && venue && (
              <div className="mt-3 text-center text-xs text-white/30">
                📍 {venue}
              </div>
            )}
          </div>
        </Link>

        {/* Quick edit button — visible on hover */}
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); setShowEdit(true); }}
          className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity bg-wc-blue border border-wc-gold/30 text-wc-gold hover:bg-wc-gold hover:text-wc-dark text-xs px-2 py-1 rounded-lg font-bold z-10"
          title="Edição rápida"
        >
          ✎
        </button>
      </div>

      {showEdit && (
        <QuickEditModal
          matchId={match.id}
          onClose={() => setShowEdit(false)}
          onSaved={() => { onUpdated?.(); }}
        />
      )}
    </>
  );
}
