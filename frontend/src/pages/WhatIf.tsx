import { useEffect, useState, useCallback, useMemo } from 'react';
import { getMatches, simulateGroup, getBestThirds } from '../lib/api';
import type { Match, TeamStat } from '../types';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

type QualStatus = 'direct' | 'third' | 'out';

function getQualStatus(pos: number): QualStatus {
  if (pos <= 2) return 'direct';
  if (pos === 3) return 'third';
  return 'out';
}

function QualBadge({ pos }: { pos: number }) {
  const status = getQualStatus(pos);
  if (status === 'direct') return (
    <span className="w-5 h-5 rounded-full text-xs font-extrabold flex items-center justify-center text-wc-dark"
      style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}>{pos}</span>
  );
  if (status === 'third') return (
    <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
      style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>3</span>
  );
  return (
    <span className="w-5 h-5 rounded-full bg-wc-blue/40 text-white/30 text-xs flex items-center justify-center">{pos}</span>
  );
}

function sortByPoints(teams: (TeamStat & { group?: string })[]): (TeamStat & { group?: string })[] {
  return [...teams].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}

const LS_INPUTS = 'whatif_simInputs';
const LS_STANDINGS = 'whatif_simulatedStandings';

function loadLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

export default function WhatIf() {
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [realBestThirds, setRealBestThirds] = useState<(TeamStat & { group: string })[]>([]);

  const [simInputs, setSimInputs] = useState<Record<string, Record<number, { home: string; away: string }>>>(
    () => loadLS(LS_INPUTS, {})
  );
  const [simulatedStandings, setSimulatedStandings] = useState<Record<string, TeamStat[]>>(
    () => loadLS(LS_STANDINGS, {})
  );
  const [loading, setLoading] = useState(false);

  // Persiste no localStorage sempre que muda
  useEffect(() => {
    localStorage.setItem(LS_INPUTS, JSON.stringify(simInputs));
  }, [simInputs]);

  useEffect(() => {
    localStorage.setItem(LS_STANDINGS, JSON.stringify(simulatedStandings));
  }, [simulatedStandings]);

  useEffect(() => {
    getMatches({ stage: 'Group' }).then(setAllMatches);
    getBestThirds().then(d => setRealBestThirds(d as any));
  }, []);

  const groupMatches = allMatches.filter(m => m.groupName === selectedGroup);
  const pendingMatches = groupMatches.filter(m => m.status !== 'Finished');
  const currentInputs = simInputs[selectedGroup] ?? {};
  const currentStandings = simulatedStandings[selectedGroup] ?? [];
  const hasSimulated = !!simulatedStandings[selectedGroup];

  // Grupos que têm pelo menos um input preenchido
  const groupsWithInputs = Object.keys(simInputs).filter(g =>
    Object.keys(simInputs[g] ?? {}).length > 0
  );
  const groupsSimulated = Object.keys(simulatedStandings).sort();
  const anyActivity = groupsWithInputs.length > 0 || groupsSimulated.length > 0;

  // Melhores 3ºs: substitui os 3ºs reais pelos simulados de TODOS os grupos simulados
  const mergedBestThirds = useMemo(() => {
    let result = [...realBestThirds] as (TeamStat & { group: string })[];
    for (const [group, standings] of Object.entries(simulatedStandings)) {
      if (standings.length < 3) continue;
      const simThird = standings[2];
      result = result.filter(t => t.group !== group);
      result.push({ ...simThird, group: group + '*' });
    }
    return sortByPoints(result);
  }, [simulatedStandings, realBestThirds]);

  const setScore = (matchId: number, side: 'home' | 'away', val: string) => {
    setSimInputs(prev => ({
      ...prev,
      [selectedGroup]: {
        ...prev[selectedGroup],
        [matchId]: {
          home: prev[selectedGroup]?.[matchId]?.home ?? '0',
          away: prev[selectedGroup]?.[matchId]?.away ?? '0',
          [side]: val,
        },
      },
    }));
  };

  const handleSimulate = useCallback(async () => {
    setLoading(true);
    const inputs = simInputs[selectedGroup] ?? {};
    const simResults = pendingMatches
      .filter(m => inputs[m.id]?.home !== undefined)
      .map(m => ({
        matchId: m.id,
        homeScore: Number(inputs[m.id]?.home ?? 0),
        awayScore: Number(inputs[m.id]?.away ?? 0),
      }));

    try {
      const result = await simulateGroup(selectedGroup, simResults);
      setSimulatedStandings(prev => ({ ...prev, [selectedGroup]: result.standings }));
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, pendingMatches, simInputs]);

  const handleResetAll = () => {
    setSimInputs({});
    setSimulatedStandings({});
  };

  const handleResetGroup = () => {
    setSimInputs(prev => { const n = { ...prev }; delete n[selectedGroup]; return n; });
    setSimulatedStandings(prev => { const n = { ...prev }; delete n[selectedGroup]; return n; });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-1">Calculadora de Cenários</h1>
          <p className="text-white/40 text-sm">
            Simula resultados hipotéticos em vários grupos e vê como afetam a classificação
          </p>
        </div>
        {anyActivity && (
          <button
            onClick={handleResetAll}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
          >
            🗑 Limpar tudo
          </button>
        )}
      </div>

      {/* Legenda */}
      <div className="flex gap-4 text-xs flex-wrap">
        <span className="flex items-center gap-1.5 text-wc-gold/80">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'linear-gradient(135deg,#F59E0B,#FCD34D)' }} />
          1º e 2º — apuram-se directamente
        </span>
        <span className="flex items-center gap-1.5 text-wc-violet">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }} />
          3º — disputam os 8 lugares de melhor 3º
        </span>
        <span className="flex items-center gap-1.5 text-white/30">
          <span className="w-2 h-2 rounded-full bg-wc-blue/40 inline-block" />
          4º — eliminado
        </span>
      </div>

      {/* Group selector — com indicadores de estado */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map(g => {
          const isSel = selectedGroup === g;
          const isSimd = !!simulatedStandings[g];
          const hasInput = Object.keys(simInputs[g] ?? {}).length > 0;
          return (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`relative w-10 h-10 rounded-lg font-bold text-sm transition-colors ${
                isSel ? 'text-wc-dark' : 'bg-wc-blue text-white/70 hover:text-white hover:bg-wc-blue/70'
              }`}
              style={isSel ? { background: 'linear-gradient(135deg,#F59E0B,#FCD34D)' } : {}}
            >
              {g}
              {/* Indicador: simulado = ponto verde, tem input = ponto amarelo */}
              {(isSimd || hasInput) && (
                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-wc-dark ${
                  isSimd ? 'bg-green-400' : 'bg-wc-gold'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: jogos do grupo */}
        <div className="space-y-4">
          <h2 className="text-white font-bold text-lg">Grupo {selectedGroup} — Jogos</h2>

          {/* Resultados reais */}
          {groupMatches.filter(m => m.status === 'Finished').map(m => (
            <div key={m.id} className="bg-wc-navy border border-wc-blue/40 rounded-xl p-4 opacity-60">
              <div className="text-xs text-white/30 mb-2 uppercase tracking-wider">Resultado Real</div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-white text-sm font-medium">{m.homeTeam?.name}</span>
                  <img src={m.homeTeam?.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                </div>
                <div className="bg-wc-blue px-3 py-1 rounded-lg text-white font-bold">
                  {m.homeScore} — {m.awayScore}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <img src={m.awayTeam?.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                  <span className="text-white text-sm font-medium">{m.awayTeam?.name}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Jogos a simular */}
          {pendingMatches.length === 0 ? (
            <div className="bg-wc-navy border border-green-500/20 rounded-xl p-5 text-center">
              <div className="text-green-400 font-bold mb-1">✓ Grupo Completo</div>
              <div className="text-white/40 text-sm">Todos os jogos deste grupo já terminaram</div>
            </div>
          ) : (
            pendingMatches.map(m => (
              <div key={m.id} className="bg-wc-navy border border-wc-gold/20 rounded-xl p-4">
                <div className="text-xs text-wc-gold/70 mb-3 uppercase tracking-wider font-bold">Simular resultado</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-white text-sm font-medium text-right">{m.homeTeam?.name}</span>
                    <img src={m.homeTeam?.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="20"
                      value={currentInputs[m.id]?.home ?? ''}
                      onChange={e => setScore(m.id, 'home', e.target.value)}
                      placeholder="0"
                      className="w-12 bg-wc-blue border border-wc-gold/30 text-white text-center font-bold text-lg rounded-lg py-1.5 focus:outline-none focus:border-wc-gold"
                    />
                    <span className="text-white/30 font-bold px-1">–</span>
                    <input
                      type="number" min="0" max="20"
                      value={currentInputs[m.id]?.away ?? ''}
                      onChange={e => setScore(m.id, 'away', e.target.value)}
                      placeholder="0"
                      className="w-12 bg-wc-blue border border-wc-gold/30 text-white text-center font-bold text-lg rounded-lg py-1.5 focus:outline-none focus:border-wc-gold"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <img src={m.awayTeam?.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                    <span className="text-white text-sm font-medium">{m.awayTeam?.name}</span>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSimulate}
              disabled={loading}
              className="flex-1 text-wc-dark font-bold py-3 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}
            >
              {loading ? 'A calcular...' : `⚡ Simular Grupo ${selectedGroup}`}
            </button>
            {(hasSimulated || Object.keys(currentInputs).length > 0) && (
              <button
                onClick={handleResetGroup}
                className="px-4 bg-wc-blue text-white/60 hover:text-white font-medium py-3 rounded-xl transition-colors"
                title={`Limpar simulação do Grupo ${selectedGroup}`}
              >
                ✕
              </button>
            )}
          </div>

          {/* Indicador de grupos já simulados */}
          {groupsSimulated.length > 0 && (
            <div className="text-xs text-white/30 flex flex-wrap gap-1.5 items-center">
              <span>Grupos simulados:</span>
              {groupsSimulated.map(g => (
                <span key={g} className="px-2 py-0.5 rounded-full text-green-400 bg-green-400/10 font-bold">{g}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right: classificação simulada + melhores 3ºs */}
        <div className="space-y-4">
          <h2 className="text-white font-bold text-lg">
            {hasSimulated ? `Classificação — Grupo ${selectedGroup}` : 'Aguarda simulação'}
          </h2>

          {hasSimulated && currentStandings.length > 0 ? (
            <div className="rounded-xl overflow-hidden border border-wc-blue/50"
              style={{ background: 'linear-gradient(160deg, rgba(26,34,80,0.6), rgba(13,17,48,0.9))' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-3 py-2.5 text-white/40 font-medium">#</th>
                    <th className="text-left px-3 py-2.5 text-white/40 font-medium">Equipa</th>
                    <th className="text-right px-2 py-2.5 text-white/40 font-medium">J</th>
                    <th className="text-right px-2 py-2.5 text-white/40 font-medium">V</th>
                    <th className="text-right px-2 py-2.5 text-white/40 font-medium">E</th>
                    <th className="text-right px-2 py-2.5 text-white/40 font-medium">D</th>
                    <th className="text-right px-2 py-2.5 text-white/40 font-medium">DG</th>
                    <th className="text-right px-3 py-2.5 text-white/40 font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {currentStandings.map((t, i) => {
                    const status = getQualStatus(i + 1);
                    return (
                      <tr key={t.id} className={
                        status === 'direct' ? 'bg-wc-gold/5 border-l-2 border-wc-gold/40' :
                        status === 'third'  ? 'bg-wc-purple/5 border-l-2 border-wc-purple/40' :
                        'opacity-50'
                      }>
                        <td className="px-3 py-3"><QualBadge pos={i + 1} /></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <img src={t.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                            <span className={`font-medium ${status !== 'out' ? 'text-white' : 'text-white/50'}`}>{t.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-2 py-3 text-white/50">{t.played}</td>
                        <td className="text-right px-2 py-3 text-white/70">{t.w}</td>
                        <td className="text-right px-2 py-3 text-white/70">{t.d}</td>
                        <td className="text-right px-2 py-3 text-white/70">{t.l}</td>
                        <td className="text-right px-2 py-3 text-white/50">{t.gf - t.ga > 0 ? '+' : ''}{t.gf - t.ga}</td>
                        <td className={`text-right px-3 py-3 font-extrabold ${
                          status === 'direct' ? 'text-wc-gold' :
                          status === 'third'  ? 'text-wc-violet' : 'text-white/40'
                        }`}>{t.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl p-8 text-center text-white/30 border border-wc-blue/30"
              style={{ background: 'linear-gradient(160deg, rgba(26,34,80,0.3), rgba(13,17,48,0.5))' }}
            >
              <div className="text-4xl mb-3">⚡</div>
              <p className="text-sm">Insere resultados hipotéticos e clica em "Simular"</p>
              <p className="text-xs mt-1 text-white/20">Podes simular vários grupos — muda de grupo sem perder os dados</p>
            </div>
          )}

          {/* Melhores 3ºs — todos os grupos simulados incorporados */}
          {mergedBestThirds.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-wc-blue/50"
              style={{ background: 'linear-gradient(160deg, rgba(26,34,80,0.5), rgba(13,17,48,0.8))' }}
            >
              <div className="px-4 py-3 border-b border-white/5"
                style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.15), transparent)' }}
              >
                <h3 className="text-white/80 text-xs font-bold uppercase tracking-wider">
                  Melhores 3ºs Classificados
                  {groupsSimulated.length > 0 && (
                    <span className="ml-2 text-wc-violet normal-case font-normal">
                      (com Gr.{groupsSimulated.join(', ')} simulado{groupsSimulated.length > 1 ? 's' : ''})
                    </span>
                  )}
                </h3>
                <p className="text-white/30 text-xs mt-0.5">Top 8 avançam para os oitavos de final</p>
              </div>
              <div className="divide-y divide-white/4">
                {mergedBestThirds.map((t, i) => {
                  const isSimulatedRow = (t as any).group?.includes('*');
                  const qualifies = i < 8;
                  return (
                    <div key={`${t.id}-${i}`} className={`flex items-center gap-3 px-4 py-2.5 ${
                      !qualifies ? 'opacity-35' : isSimulatedRow ? 'bg-wc-purple/8' : ''
                    }`}>
                      <span className={`text-xs font-bold w-5 text-center ${
                        qualifies ? (isSimulatedRow ? 'text-wc-violet' : 'text-wc-gold') : 'text-white/30'
                      }`}>{i + 1}</span>
                      <img src={t.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                      <span className={`text-sm flex-1 ${isSimulatedRow ? 'text-wc-violet font-semibold' : 'text-white/80'}`}>
                        {t.name}
                        {isSimulatedRow && <span className="text-wc-violet/60 text-xs ml-1">(sim.)</span>}
                      </span>
                      <span className="text-white/30 text-xs">Gr.{(t as any).group?.replace('*', '')}</span>
                      <div className="text-right">
                        <span className={`font-bold text-sm ${isSimulatedRow ? 'text-wc-violet' : 'text-wc-gold'}`}>{t.pts}</span>
                        <span className="text-white/25 text-xs ml-1">pts</span>
                      </div>
                      {qualifies && (
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-wc-dark"
                          style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)', fontSize: 9, fontWeight: 900 }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
