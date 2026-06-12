import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import {
  getTopScorers, getTopAssists,
  getGoalsByMinute, getTeamRadar, getTeams, getEfficiencyStats,
} from '../lib/api';
import type { Player, Team, EfficiencyTeam } from '../types';

type TabId = 'leaderboards' | 'charts' | 'radar' | 'efficiency';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'leaderboards', label: 'Classificações', icon: '🏆' },
  { id: 'charts', label: 'Golos/Minuto', icon: '📊' },
  { id: 'radar', label: 'Comparador', icon: '🔬' },
  { id: 'efficiency', label: 'Eficiência', icon: '📈' },
];

type SortKey = 'avgGoalsPerGame' | 'totalYellow' | 'goalsAgainst';

export default function Stats() {
  const [tab, setTab] = useState<TabId>('leaderboards');
  const [scorers, setScorers] = useState<Player[]>([]);
  const [assists, setAssists] = useState<Player[]>([]);
  const [goalsByMin, setGoalsByMin] = useState<Array<{ period: string; goals: number }>>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [radarTeam1, setRadarTeam1] = useState('');
  const [radarTeam2, setRadarTeam2] = useState('');
  const [radarData1, setRadarData1] = useState<any>(null);
  const [radarData2, setRadarData2] = useState<any>(null);
  const [efficiency, setEfficiency] = useState<EfficiencyTeam[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('avgGoalsPerGame');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTopScorers(50), getTopAssists(50),
      getGoalsByMinute(), getTeams(), getEfficiencyStats(),
    ]).then(([s, a, gm, t, eff]) => {
      setScorers(s); setAssists(a);
      setGoalsByMin(gm); setTeams(t); setEfficiency(eff);
    }).finally(() => setLoading(false));
  }, []);

  const loadRadar = async (t1: string, t2: string) => {
    if (t1) getTeamRadar(Number(t1)).then(setRadarData1).catch(() => setRadarData1(null));
    else setRadarData1(null);
    if (t2) getTeamRadar(Number(t2)).then(setRadarData2).catch(() => setRadarData2(null));
    else setRadarData2(null);
  };

  const sortedEfficiency = [...efficiency].sort((a, b) => {
    if (sortKey === 'avgGoalsPerGame') return b.avgGoalsPerGame - a.avgGoalsPerGame;
    if (sortKey === 'totalYellow') return b.totalYellow - a.totalYellow;
    if (sortKey === 'goalsAgainst') return a.goalsAgainst - b.goalsAgainst;
    return 0;
  });

  const mergedRadarData = (() => {
    if (!radarData1) return [];
    const base = radarData1.metrics.map((m: any) => ({ subject: m.subject, [radarData1.code]: m.value }));
    if (radarData2) {
      radarData2.metrics.forEach((m: any, i: number) => { if (base[i]) base[i][radarData2.code] = m.value; });
    }
    return base;
  })();

  if (loading) return <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white">Estatísticas</h1>
        <span className="text-white/40 text-sm">Dados em tempo real</span>
      </div>

      {/* Awards Banner */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: '🥾', label: 'Chuteira de Ouro', value: scorers[0]?.name || '—', sub: scorers[0] ? `${scorers[0].goals} golos` : 'Sem dados', flag: scorers[0]?.team?.flagUrl },
          { icon: '🎯', label: 'Assistente de Ouro', value: assists[0]?.name || '—', sub: assists[0] ? `${assists[0].assists} assist.` : 'Sem dados', flag: assists[0]?.team?.flagUrl },
        ].map(award => (
          <div key={award.label} className="bg-wc-navy border border-wc-gold/20 rounded-xl p-5 text-center">
            <div className="text-4xl mb-2">{award.icon}</div>
            <div className="text-wc-gold text-xs font-bold uppercase tracking-wider mb-1">{award.label}</div>
            {award.flag && <img src={award.flag} className="w-8 h-5 object-cover rounded mx-auto mb-1" />}
            <div className="text-white font-bold text-base truncate">{award.value}</div>
            <div className="text-white/40 text-sm">{award.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-wc-blue/20 p-1 rounded-xl">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-wc-navy text-wc-gold shadow' : 'text-white/50 hover:text-white'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Leaderboards */}
      {tab === 'leaderboards' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <StatCard title="Melhores Marcadores" icon="⚽" players={scorers} statKey="goals" statLabel="golos" limit={20} />
          <StatCard title="Melhores Assistentes" icon="🎯" players={assists} statKey="assists" statLabel="assistências" limit={20} />
          {scorers.length === 0 && assists.length === 0 && (
            <div className="col-span-2 text-center py-12 text-white/30">
              <div className="text-5xl mb-4">📊</div>
              <p>Ainda sem estatísticas — adiciona eventos nos jogos</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Goals by minute chart */}
      {tab === 'charts' && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl p-6">
          <h2 className="text-white font-bold text-lg mb-1">Distribuição de Golos por Período</h2>
          <p className="text-white/40 text-sm mb-6">Em que partes do jogo se marcam mais golos</p>
          {goalsByMin.every(g => g.goals === 0) ? (
            <div className="text-center py-16 text-white/30">
              <div className="text-4xl mb-3">⚽</div>
              <p>Ainda não há golos registados</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={goalsByMin} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1B3A5C" />
                <XAxis dataKey="period" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                <YAxis tick={{ fill: '#ffffff60', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D2137', border: '1px solid #1B3A5C', borderRadius: 8 }}
                  labelStyle={{ color: '#C9A84C', fontWeight: 'bold' }}
                  itemStyle={{ color: '#ffffff99' }}
                  formatter={(v: any) => [`${v} golos`, 'Total']}
                />
                <Bar dataKey="goals" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab: Radar comparator */}
      {tab === 'radar' && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl p-6">
          <h2 className="text-white font-bold text-lg mb-1">Comparador de Equipas</h2>
          <p className="text-white/40 text-sm mb-5">Seleciona duas equipas para comparar as suas métricas</p>
          <div className="flex gap-3 mb-6">
            <select
              value={radarTeam1}
              onChange={e => { setRadarTeam1(e.target.value); loadRadar(e.target.value, radarTeam2); }}
              className="flex-1 bg-wc-blue border border-wc-blue/50 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold"
            >
              <option value="">Equipa 1...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="text-white/30 self-center font-bold">vs</span>
            <select
              value={radarTeam2}
              onChange={e => { setRadarTeam2(e.target.value); loadRadar(radarTeam1, e.target.value); }}
              className="flex-1 bg-wc-blue border border-wc-blue/50 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-wc-gold"
            >
              <option value="">Equipa 2...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {(!radarTeam1 && !radarTeam2) ? (
            <div className="text-center py-16 text-white/30">
              <div className="text-4xl mb-3">🔬</div>
              <p>Seleciona pelo menos uma equipa acima</p>
            </div>
          ) : mergedRadarData.length === 0 ? (
            <div className="text-center py-16 text-white/40 text-sm">A carregar dados...</div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart data={mergedRadarData}>
                <PolarGrid stroke="#1B3A5C" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff80', fontSize: 12 }} />
                {radarData1 && <Radar name={radarData1.code} dataKey={radarData1.code} stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.25} />}
                {radarData2 && <Radar name={radarData2.code} dataKey={radarData2.code} stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} />}
                <Legend wrapperStyle={{ color: '#ffffff80' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D2137', border: '1px solid #1B3A5C', borderRadius: 8 }}
                  labelStyle={{ color: '#C9A84C', fontWeight: 'bold' }}
                  itemStyle={{ color: '#ffffff99' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab: Efficiency */}
      {tab === 'efficiency' && (
        <div className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-wc-blue/30 border-b border-wc-blue flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-white font-bold">Ranking de Eficiência</h2>
            <div className="flex gap-1 flex-wrap">
              {([
                { key: 'avgGoalsPerGame', label: 'Golos/Jogo' },
                { key: 'goalsAgainst', label: 'Defesa' },
                { key: 'totalYellow', label: 'Disciplina' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    sortKey === key ? 'bg-wc-gold text-wc-dark' : 'bg-wc-blue text-white/50 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {efficiency.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              Ainda sem jogos terminados para calcular eficiência
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wc-blue/30">
                    <th className="text-left px-4 py-3 text-white/40 font-medium">#</th>
                    <th className="text-left px-4 py-3 text-white/40 font-medium">Equipa</th>
                    <th className="text-right px-4 py-3 text-white/40 font-medium">JG</th>
                    <th className={`text-right px-4 py-3 font-medium ${sortKey === 'avgGoalsPerGame' ? 'text-wc-gold' : 'text-white/40'}`}>GM/J</th>
                    <th className={`text-right px-4 py-3 font-medium ${sortKey === 'goalsAgainst' ? 'text-wc-gold' : 'text-white/40'}`}>GS</th>
                    <th className={`text-right px-4 py-3 font-medium ${sortKey === 'totalYellow' ? 'text-wc-gold' : 'text-white/40'}`}>🟨</th>
                    <th className="text-right px-4 py-3 text-white/40 font-medium">🟥</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wc-blue/10">
                  {sortedEfficiency.map((t, i) => (
                    <tr key={t.id} className="hover:bg-wc-blue/10 transition-colors">
                      <td className="px-4 py-3 text-white/30 font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img src={t.flagUrl} className="w-6 h-4 object-cover rounded-sm" />
                          <span className="text-white font-medium">{t.name}</span>
                          <span className="text-white/30 text-xs">Gr.{t.group}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white/50">{t.gamesPlayed}</td>
                      <td className={`px-4 py-3 text-right font-bold ${sortKey === 'avgGoalsPerGame' ? 'text-wc-gold' : 'text-white/70'}`}>{t.avgGoalsPerGame}</td>
                      <td className={`px-4 py-3 text-right font-bold ${sortKey === 'goalsAgainst' ? 'text-wc-gold' : 'text-white/70'}`}>{t.goalsAgainst}</td>
                      <td className={`px-4 py-3 text-right ${sortKey === 'totalYellow' ? 'text-yellow-400 font-bold' : 'text-white/50'}`}>{t.totalYellow}</td>
                      <td className="px-4 py-3 text-right text-white/50">{t.totalRed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
