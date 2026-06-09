import { useState, useRef, useCallback } from 'react';
import type { Player, LineupPlayer } from '../types';

interface PlacedPlayer {
  playerId: number;
  player: Player;
  posX: number; // 0-100
  posY: number; // 0-100
  isStarter: boolean;
}

interface Props {
  players: Player[];
  matchId?: number;
  teamId: number;
  formation: string;
  initialLineup?: LineupPlayer[];
  onSave?: (lineup: PlacedPlayer[]) => void;
  readOnly?: boolean;
}

const posColors: Record<string, string> = {
  GK: 'bg-yellow-500 border-yellow-300 text-yellow-900',
  DEF: 'bg-blue-500 border-blue-300 text-blue-900',
  MID: 'bg-green-500 border-green-300 text-green-900',
  FWD: 'bg-red-500 border-red-300 text-red-900',
};

function getFormationSlots(formation: string): Array<{ x: number; y: number; pos: string }> {
  const parts = formation.split('-').map(Number);
  const slots: Array<{ x: number; y: number; pos: string }> = [];
  const posLabels = ['DEF', 'MID', 'FWD'];

  // GK
  slots.push({ x: 50, y: 90, pos: 'GK' });

  // Outfield rows from bottom (defense) to top (attack)
  parts.forEach((count, rowIdx) => {
    const y = 70 - rowIdx * (55 / parts.length);
    for (let i = 0; i < count; i++) {
      const x = (100 / (count + 1)) * (i + 1);
      slots.push({ x, y, pos: posLabels[Math.min(rowIdx, 2)] });
    }
  });

  return slots;
}

export default function TacticalBoard({ players, matchId, teamId, formation, initialLineup, onSave, readOnly }: Props) {
  const pitchRef = useRef<HTMLDivElement>(null);

  const [placed, setPlaced] = useState<PlacedPlayer[]>(() => {
    if (initialLineup && initialLineup.length > 0) {
      return initialLineup.map(lp => ({
        playerId: lp.playerId,
        player: players.find(p => p.id === lp.playerId) || { id: lp.playerId, name: '?', position: 'MID' } as Player,
        posX: lp.posX,
        posY: lp.posY,
        isStarter: lp.isStarter === 1,
      }));
    }
    return [];
  });

  const [dragging, setDragging] = useState<number | null>(null); // playerId being dragged
  const [dragSource, setDragSource] = useState<'bench' | 'pitch'>('bench');
  const [saving, setSaving] = useState(false);

  const formationSlots = getFormationSlots(formation);
  const placedPlayerIds = new Set(placed.map(p => p.playerId));
  const bench = players.filter(p => !placedPlayerIds.has(p.id));

  const handlePitchDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragging === null || !pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const posX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const posY = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const clamped = { posX: Math.max(2, Math.min(98, posX)), posY: Math.max(2, Math.min(98, posY)) };

    const player = players.find(p => p.id === dragging);
    if (!player) return;

    setPlaced(prev => {
      const without = prev.filter(p => p.playerId !== dragging);
      return [...without, { playerId: dragging, player, posX: clamped.posX, posY: clamped.posY, isStarter: true }];
    });
    setDragging(null);
  }, [dragging, players]);

  const removeFromPitch = (playerId: number) => {
    setPlaced(prev => prev.filter(p => p.playerId !== playerId));
  };

  const applyFormation = () => {
    const starters = placed.filter(p => p.isStarter).length;
    const toBePlaced = players.slice(0, 11);
    const newPlaced = formationSlots.map((slot, i) => {
      const player = toBePlaced[i];
      if (!player) return null;
      return { playerId: player.id, player, posX: slot.x, posY: slot.y, isStarter: true };
    }).filter(Boolean) as PlacedPlayer[];
    setPlaced(newPlaced);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(placed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={applyFormation} className="text-xs bg-wc-blue border border-wc-blue/60 text-white/70 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            Auto {formation}
          </button>
          <button onClick={() => setPlaced([])} className="text-xs bg-wc-blue border border-wc-blue/60 text-red-400/70 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">
            Limpar
          </button>
          <span className="text-white/30 text-xs flex-1">{placed.filter(p => p.isStarter).length}/11 titulares</span>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-wc-gold text-wc-dark font-bold px-4 py-1.5 rounded-lg hover:bg-wc-gold-light disabled:opacity-50 transition-colors"
            >
              {saving ? 'A guardar...' : 'Guardar Onze'}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {/* Pitch */}
        <div
          ref={pitchRef}
          onDragOver={e => e.preventDefault()}
          onDrop={handlePitchDrop}
          className="relative flex-1 rounded-xl overflow-hidden select-none"
          style={{ aspectRatio: '0.68', minHeight: 360 }}
        >
          {/* Field background */}
          <div className="absolute inset-0 bg-gradient-to-b from-green-800 to-green-700" />
          {/* Field lines */}
          <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 147" preserveAspectRatio="none">
            <rect x="2" y="2" width="96" height="143" fill="none" stroke="white" strokeWidth="1" />
            <line x1="2" y1="73.5" x2="98" y2="73.5" stroke="white" strokeWidth="0.8" />
            <circle cx="50" cy="73.5" r="10" fill="none" stroke="white" strokeWidth="0.8" />
            <rect x="22" y="2" width="56" height="22" fill="none" stroke="white" strokeWidth="0.7" />
            <rect x="36" y="2" width="28" height="10" fill="none" stroke="white" strokeWidth="0.7" />
            <rect x="22" y="123" width="56" height="22" fill="none" stroke="white" strokeWidth="0.7" />
            <rect x="36" y="135" width="28" height="10" fill="none" stroke="white" strokeWidth="0.7" />
          </svg>

          {/* Formation slots (when empty) */}
          {!readOnly && placed.length === 0 && formationSlots.map((slot, i) => (
            <div
              key={i}
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%,-50%)' }}
              className="absolute w-8 h-8 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/20 text-xs"
            >
              {slot.pos[0]}
            </div>
          ))}

          {/* Placed players */}
          {placed.map(pp => (
            <div
              key={pp.playerId}
              style={{ left: `${pp.posX}%`, top: `${pp.posY}%`, transform: 'translate(-50%,-50%)' }}
              className="absolute group cursor-grab active:cursor-grabbing"
              draggable={!readOnly}
              onDragStart={() => { setDragging(pp.playerId); setDragSource('pitch'); }}
            >
              <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-lg ${posColors[pp.player.position] || 'bg-gray-500 border-gray-300 text-white'}`}>
                {pp.player.shirtNumber ?? pp.player.position[0]}
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold whitespace-nowrap drop-shadow-md bg-black/50 px-1 rounded">
                {pp.player.name.split(' ').pop()}
                {pp.player.isCaptain ? ' (C)' : ''}
              </div>
              {/* Role badges */}
              <div className="absolute -top-1 -right-1 flex gap-0.5">
                {pp.player.isCaptain ? <span className="w-3 h-3 rounded-full bg-wc-gold text-wc-dark text-xs font-extrabold flex items-center justify-center leading-none" title="Capitão">C</span> : null}
                {pp.player.isPenaltyTaker ? <span className="w-3 h-3 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center leading-none" title="Marcador de penáltis">P</span> : null}
              </div>
              {!readOnly && (
                <button
                  onClick={() => removeFromPitch(pp.playerId)}
                  className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center text-xs leading-none transition-opacity"
                >×</button>
              )}
            </div>
          ))}
        </div>

        {/* Bench */}
        {!readOnly && (
          <div className="w-32 bg-wc-navy border border-wc-blue rounded-xl overflow-hidden flex flex-col">
            <div className="px-2 py-2 bg-wc-blue/30 border-b border-wc-blue text-xs text-white/40 font-bold uppercase tracking-wider text-center">
              Suplentes
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-wc-blue/10">
              {bench.length === 0 ? (
                <div className="py-4 text-center text-white/20 text-xs">Sem jogadores</div>
              ) : (
                bench.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => { setDragging(p.id); setDragSource('bench'); }}
                    className="flex items-center gap-1.5 px-2 py-2 cursor-grab hover:bg-wc-blue/20 transition-colors group"
                  >
                    <span className={`text-xs font-bold px-1 py-0.5 rounded ${
                      p.position === 'GK' ? 'bg-yellow-500/30 text-yellow-300' :
                      p.position === 'DEF' ? 'bg-blue-500/30 text-blue-300' :
                      p.position === 'MID' ? 'bg-green-500/30 text-green-300' :
                      'bg-red-500/30 text-red-300'
                    }`}>{p.position[0]}</span>
                    <span className="text-white/70 text-xs truncate flex-1">{p.name.split(' ').pop()}</span>
                    {p.isCaptain ? <span className="text-wc-gold text-xs font-bold">C</span> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-white/20 text-xs text-center">
        {readOnly ? 'Arrasta para mover os jogadores.' : 'Arrasta jogadores da lista para o campo · Clica em × para remover'}
      </div>
    </div>
  );
}
