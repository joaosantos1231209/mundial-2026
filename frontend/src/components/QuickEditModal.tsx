import { useState, useEffect, useRef } from 'react';
import { getMatch, updateMatchResult, addMatchEvent, deleteMatchEvent, getPlayers } from '../lib/api';
import type { Match, Player } from '../types';

interface Props {
  matchId: number;
  onClose: () => void;
  onSaved: () => void;
}

const EVENT_TYPES = ['Goal', 'OwnGoal', 'Assist', 'Yellow', 'Red'];
const EVENT_ICONS: Record<string, string> = { Goal: '⚽', OwnGoal: '⚽ (OG)', Assist: '🅐', Yellow: '🟨', Red: '🟥' };

export default function QuickEditModal({ matchId, onClose, onSaved }: Props) {
  const [match, setMatch] = useState<Match | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [saving, setSaving] = useState(false);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [status, setStatus] = useState<string>('Scheduled');
  const [newEvent, setNewEvent] = useState({ teamId: '', playerId: '', eventType: 'Goal', minute: '' });
  const overlayRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const m = await getMatch(matchId);
    setMatch(m);
    setHomeScore(m.homeScore ?? 0);
    setAwayScore(m.awayScore ?? 0);
    setStatus(m.status);
    if (m.homeTeam) {
      const hp = await getPlayers(m.homeTeamId);
      setHomePlayers(hp);
    }
    if (m.awayTeam) {
      const ap = await getPlayers(m.awayTeamId);
      setAwayPlayers(ap);
    }
  };

  useEffect(() => { load(); }, [matchId]);

  const handleSaveResult = async () => {
    setSaving(true);
    try {
      await updateMatchResult(matchId, { homeScore, awayScore, status });
      onSaved();
      await load();
    } finally { setSaving(false); }
  };

  const handleAddEvent = async () => {
    if (!newEvent.eventType) return;
    setSaving(true);
    try {
      await addMatchEvent(matchId, {
        eventType: newEvent.eventType as any,
        teamId: newEvent.teamId ? Number(newEvent.teamId) : undefined,
        playerId: newEvent.playerId ? Number(newEvent.playerId) : undefined,
        minute: newEvent.minute ? Number(newEvent.minute) : undefined,
      });
      setNewEvent({ teamId: '', playerId: '', eventType: 'Goal', minute: '' });
      await load();
      onSaved();
    } finally { setSaving(false); }
  };

  const handleDeleteEvent = async (eventId: number) => {
    await deleteMatchEvent(matchId, eventId);
    await load();
    onSaved();
  };

  if (!match) return null;

  const allPlayers = [...homePlayers, ...awayPlayers];
  const selectedTeamPlayers = newEvent.teamId
    ? (Number(newEvent.teamId) === match.homeTeamId ? homePlayers : awayPlayers)
    : allPlayers;

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="bg-wc-navy border border-wc-blue rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-wc-navy border-b border-wc-blue px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-wc-gold font-bold text-sm uppercase tracking-wider">Edição Rápida</div>
            <div className="text-white font-semibold text-sm mt-0.5">
              {match.homeTeam?.name} vs {match.awayTeam?.name}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score + Status */}
          <div className="bg-wc-blue/20 rounded-xl p-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <img src={match.homeTeam?.flagUrl} className="w-6 h-4 object-cover rounded" />
                <span className="text-white/70 text-sm font-medium">{match.homeTeam?.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setHomeScore(Math.max(0, homeScore - 1))} className="w-7 h-7 rounded-full bg-wc-blue hover:bg-wc-blue/70 text-white font-bold transition-colors">−</button>
                <span className="text-3xl font-extrabold text-white w-8 text-center">{homeScore}</span>
                <button onClick={() => setHomeScore(homeScore + 1)} className="w-7 h-7 rounded-full bg-wc-gold hover:bg-wc-gold-light text-wc-dark font-bold transition-colors">+</button>
              </div>
              <span className="text-white/30 font-bold">:</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setAwayScore(Math.max(0, awayScore - 1))} className="w-7 h-7 rounded-full bg-wc-blue hover:bg-wc-blue/70 text-white font-bold transition-colors">−</button>
                <span className="text-3xl font-extrabold text-white w-8 text-center">{awayScore}</span>
                <button onClick={() => setAwayScore(awayScore + 1)} className="w-7 h-7 rounded-full bg-wc-gold hover:bg-wc-gold-light text-wc-dark font-bold transition-colors">+</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm font-medium">{match.awayTeam?.code}</span>
                <img src={match.awayTeam?.flagUrl} className="w-6 h-4 object-cover rounded" />
              </div>
            </div>

            <div className="flex gap-2 justify-center mb-3">
              {(['Scheduled', 'Live', 'Finished'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    status === s
                      ? s === 'Live' ? 'bg-green-500 text-white' : s === 'Finished' ? 'bg-blue-500 text-white' : 'bg-wc-gold text-wc-dark'
                      : 'bg-wc-blue text-white/50 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={handleSaveResult}
              disabled={saving}
              className="w-full bg-wc-gold text-wc-dark font-bold py-2 rounded-lg hover:bg-wc-gold-light disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'A guardar...' : 'Guardar Resultado'}
            </button>
          </div>

          {/* Add Event */}
          <div className="bg-wc-blue/10 rounded-xl p-4">
            <h3 className="text-white/70 text-xs uppercase tracking-wider font-bold mb-3">Adicionar Evento</h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={newEvent.eventType}
                onChange={e => setNewEvent(p => ({ ...p, eventType: e.target.value }))}
                className="col-span-2 bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold"
              >
                {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_ICONS[t]} {t}</option>)}
              </select>
              <select
                value={newEvent.teamId}
                onChange={e => setNewEvent(p => ({ ...p, teamId: e.target.value, playerId: '' }))}
                className="bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold"
              >
                <option value="">Equipa</option>
                <option value={match.homeTeamId}>{match.homeTeam?.code}</option>
                <option value={match.awayTeamId}>{match.awayTeam?.code}</option>
              </select>
              <input
                type="number"
                placeholder="Minuto"
                min="1" max="120"
                value={newEvent.minute}
                onChange={e => setNewEvent(p => ({ ...p, minute: e.target.value }))}
                className="bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold"
              />
              <select
                value={newEvent.playerId}
                onChange={e => setNewEvent(p => ({ ...p, playerId: e.target.value }))}
                className="col-span-2 bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold"
              >
                <option value="">Jogador (opcional)</option>
                {selectedTeamPlayers.map(p => (
                  <option key={p.id} value={p.id}>#{p.shirtNumber} {p.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddEvent}
              disabled={saving}
              className="w-full bg-wc-blue border border-wc-gold/40 text-wc-gold font-bold py-2 rounded-lg hover:bg-wc-gold hover:text-wc-dark disabled:opacity-50 transition-colors text-sm"
            >
              + Adicionar Evento
            </button>
          </div>

          {/* Events timeline */}
          {match.events && match.events.length > 0 && (
            <div>
              <h3 className="text-white/70 text-xs uppercase tracking-wider font-bold mb-2">Eventos ({match.events.length})</h3>
              <div className="space-y-1">
                {match.events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)).map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 bg-wc-blue/10 rounded-lg px-3 py-2 group">
                    <span className="text-xs w-8 text-white/40 font-mono text-right">{ev.minute ?? '–'}'</span>
                    <span className="text-sm">{EVENT_ICONS[ev.eventType] || ev.eventType}</span>
                    <span className="flex-1 text-white/70 text-sm">
                      {ev.player ? ev.player.name : ev.eventType}
                      {ev.team && <span className="text-white/30 ml-1">({ev.team.code})</span>}
                    </span>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-opacity px-1"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
