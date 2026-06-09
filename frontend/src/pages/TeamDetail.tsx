import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTeam, createPlayer, deletePlayer, updateTeam, updatePlayer } from '../lib/api';
import TacticalBoard from '../components/TacticalBoard';
import type { Team, Player } from '../types';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-4-1', '5-3-2', '4-1-4-1'];

const posColors: Record<string, string> = {
  GK: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DEF: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MID: 'bg-green-500/20 text-green-300 border-green-500/30',
  FWD: 'bg-red-500/20 text-red-300 border-red-500/30',
};

type ActiveTab = 'squad' | 'tactical';

function RoleBadges({ player, onToggle }: { player: Player; onToggle?: (field: string, val: boolean) => void }) {
  const badges = [
    { key: 'isCaptain', label: 'C', title: 'Capitão', active: !!player.isCaptain, color: 'bg-wc-gold text-wc-dark' },
    { key: 'isPenaltyTaker', label: 'PK', title: 'Marcador de penáltis', active: !!player.isPenaltyTaker, color: 'bg-purple-500 text-white' },
    { key: 'isFreekickTaker', label: 'FK', title: 'Marcador de livres', active: !!player.isFreekickTaker, color: 'bg-orange-500 text-white' },
    { key: 'isCornerKicker', label: 'CK', title: 'Cobrador de cantos', active: !!player.isCornerKicker, color: 'bg-cyan-500 text-white' },
  ];

  return (
    <div className="flex gap-1 flex-wrap">
      {badges.map(b => (
        <button
          key={b.key}
          title={b.title}
          onClick={() => onToggle?.(b.key, !b.active)}
          className={`text-xs font-bold px-1.5 py-0.5 rounded transition-all ${
            b.active ? b.color : 'bg-wc-blue/40 text-white/30 hover:text-white/60'
          } ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('squad');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editFormation, setEditFormation] = useState(false);
  const [newFormation, setNewFormation] = useState('');
  const [newPlayer, setNewPlayer] = useState({ name: '', position: 'FWD', shirtNumber: '' });
  const [saving, setSaving] = useState(false);

  const load = () => getTeam(Number(id)).then(t => { setTeam(t); setNewFormation(t.defaultFormation); }).finally(() => setLoading(false));

  useEffect(() => { if (id) load(); }, [id]);

  const handleAddPlayer = async () => {
    if (!team || !newPlayer.name) return;
    setSaving(true);
    try {
      await createPlayer({ ...newPlayer, position: newPlayer.position as any, teamId: team.id, shirtNumber: newPlayer.shirtNumber ? Number(newPlayer.shirtNumber) : undefined });
      setNewPlayer({ name: '', position: 'FWD', shirtNumber: '' });
      setShowAddPlayer(false);
      await load();
    } finally { setSaving(false); }
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (!confirm('Remover jogador?')) return;
    await deletePlayer(playerId);
    await load();
  };

  const handleSaveFormation = async () => {
    if (!team) return;
    await updateTeam(team.id, { defaultFormation: newFormation });
    setEditFormation(false);
    await load();
  };

  const handleToggleRole = async (player: Player, field: string, value: boolean) => {
    await updatePlayer(player.id, { [field]: value } as any);
    await load();
  };

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;
  if (!team) return <div className="text-center py-20 text-red-400">Equipa não encontrada</div>;

  const playersByPos = POSITIONS.map(pos => ({
    pos, players: (team.players || []).filter(p => p.position === pos).sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to="/teams" className="text-wc-gold hover:underline text-sm">← Voltar às equipas</Link>

      {/* Header */}
      <div className="bg-wc-navy border border-wc-blue rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <img src={team.flagUrl} alt={team.code} className="w-24 h-16 object-cover rounded-lg shadow-xl" />
          <div className="flex-1">
            <div className="text-white/40 text-sm uppercase tracking-wider mb-1">Grupo {team.group}</div>
            <h1 className="text-3xl font-extrabold text-white">{team.name}</h1>
            <div className="text-wc-gold text-lg font-bold">{team.code}</div>
          </div>
          <div className="text-right">
            <div className="text-wc-gold text-3xl font-extrabold">{team.points}</div>
            <div className="text-white/40 text-sm">pontos</div>
            <div className="text-white/60 text-sm mt-1">{team.wins}V {team.draws}E {team.losses}D</div>
            <div className="text-white/40 text-xs">{team.goalsFor} GF · {team.goalsAgainst} GS</div>
          </div>
        </div>
      </div>

      {/* Formation selector */}
      <div className="bg-wc-navy border border-wc-blue rounded-xl p-4 flex items-center gap-4">
        <span className="text-white/50 text-sm font-medium">Formação:</span>
        {editFormation ? (
          <>
            <select value={newFormation} onChange={e => setNewFormation(e.target.value)}
              className="bg-wc-blue border border-wc-blue/50 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-wc-gold">
              {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={handleSaveFormation} className="bg-wc-gold text-wc-dark font-bold px-3 py-1.5 rounded-lg hover:bg-wc-gold-light text-sm">Guardar</button>
            <button onClick={() => setEditFormation(false)} className="text-white/40 hover:text-white text-sm">Cancelar</button>
          </>
        ) : (
          <>
            <span className="text-wc-gold font-extrabold text-xl">{team.defaultFormation}</span>
            <button onClick={() => setEditFormation(true)} className="text-white/30 hover:text-white text-xs">✏️ Editar</button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-wc-blue/20 p-1 rounded-xl">
        {([
          { id: 'squad', label: '👥 Plantel' },
          { id: 'tactical', label: '⚽ Prancheta Tática' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-wc-navy text-wc-gold shadow' : 'text-white/50 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Squad */}
      {activeTab === 'squad' && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-wc-blue/40 border-b border-wc-blue flex items-center justify-between">
            <span className="text-wc-gold font-bold uppercase tracking-wider text-sm">
              Plantel ({team.players?.length ?? 0})
            </span>
            <button onClick={() => setShowAddPlayer(!showAddPlayer)}
              className="text-xs bg-wc-gold text-wc-dark font-bold px-3 py-1 rounded-lg hover:bg-wc-gold-light transition-colors">
              {showAddPlayer ? 'Cancelar' : '+ Jogador'}
            </button>
          </div>

          {showAddPlayer && (
            <div className="p-4 border-b border-wc-blue/30 bg-wc-blue/20">
              <div className="flex gap-2 flex-wrap">
                <input type="text" placeholder="Nome do jogador" value={newPlayer.name} onChange={e => setNewPlayer(p => ({ ...p, name: e.target.value }))}
                  className="flex-1 min-w-32 bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold placeholder-white/30" />
                <select value={newPlayer.position} onChange={e => setNewPlayer(p => ({ ...p, position: e.target.value }))}
                  className="bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold">
                  {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
                <input type="number" placeholder="#" min="1" max="99" value={newPlayer.shirtNumber} onChange={e => setNewPlayer(p => ({ ...p, shirtNumber: e.target.value }))}
                  className="w-16 bg-wc-blue border border-wc-blue/50 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold" />
                <button onClick={handleAddPlayer} disabled={saving || !newPlayer.name}
                  className="bg-wc-gold text-wc-dark font-bold px-4 py-2 rounded-lg hover:bg-wc-gold-light disabled:opacity-50 text-sm">
                  Adicionar
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-wc-blue/20">
            {playersByPos.map(({ pos, players: posPlayers }) => posPlayers.length > 0 && (
              <div key={pos}>
                <div className="px-5 py-2 bg-wc-blue/20">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${posColors[pos]}`}>{pos}</span>
                </div>
                {posPlayers.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-wc-blue/20 transition-colors group">
                    <span className="text-white/30 text-sm font-mono w-6 text-right">{p.shirtNumber ?? '–'}</span>
                    <Link to={`/players/${p.id}`} className="flex-1 text-white font-medium text-sm hover:text-wc-gold transition-colors">
                      {p.name}
                    </Link>
                    <RoleBadges player={p} onToggle={(field, val) => handleToggleRole(p, field, val)} />
                    <div className="flex gap-3 text-xs text-white/40">
                      {p.goals > 0 && <span>⚽ {p.goals}</span>}
                      {p.assists > 0 && <span>🎯 {p.assists}</span>}
                      {p.minutesPlayed > 0 && <span>⏱ {p.minutesPlayed}'</span>}
                      {p.yellowCards > 0 && <span>🟨 {p.yellowCards}</span>}
                      {p.redCards > 0 && <span>🟥 {p.redCards}</span>}
                      {p.cleanSheets > 0 && <span>🧤 {p.cleanSheets}</span>}
                    </div>
                    <button onClick={() => handleDeletePlayer(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            ))}
            {(team.players?.length ?? 0) === 0 && (
              <div className="py-12 text-center text-white/30 text-sm">
                Plantel vazio. Clica em "+ Jogador" para adicionar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Tactical Board */}
      {activeTab === 'tactical' && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-wc-gold font-bold uppercase tracking-wider text-sm">Prancheta Tática — {team.defaultFormation}</h3>
            <div className="flex gap-2 text-xs text-white/40">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-wc-gold inline-block"></span> Capitão</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span> PK</span>
            </div>
          </div>
          {(team.players?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              Sem jogadores no plantel. Sincroniza ou adiciona jogadores primeiro.
            </div>
          ) : (
            <TacticalBoard
              players={team.players || []}
              teamId={team.id}
              formation={team.defaultFormation}
            />
          )}
        </div>
      )}
    </div>
  );
}
