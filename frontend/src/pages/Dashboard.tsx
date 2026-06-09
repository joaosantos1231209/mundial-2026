import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MatchCard from '../components/ui/MatchCard';
import StatCard from '../components/ui/StatCard';
import { getMatches, getStatsOverview } from '../lib/api';
import type { Match, StatsOverview } from '../types';

function isToday(dateStr: string) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

export default function Dashboard() {
  const [todayMatches, setTodayMatches] = useState<Match[]>([]);
  const [recentResults, setRecentResults] = useState<Match[]>([]);
  const [upcoming, setUpcoming] = useState<Match[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMatches(), getStatsOverview()])
      .then(([allMatches, overview]) => {
        const today = allMatches.filter(m => isToday(m.date));
        const finished = allMatches.filter(m => m.status === 'Finished').slice(-6).reverse();
        const sched = allMatches.filter(m => m.status === 'Scheduled').slice(0, 6);
        setTodayMatches(today);
        setRecentResults(finished);
        setUpcoming(sched);
        setStats(overview);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gradient-gold text-xl animate-pulse font-bold">A carregar...</div>
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative text-center py-12 overflow-hidden rounded-2xl"
        style={{
          border: '1px solid rgba(124,58,237,0.2)',
        }}
      >
        {/* Stadium background */}
        <div className="absolute inset-0 rounded-2xl"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1920)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Dark overlay with gradient */}
        <div className="absolute inset-0 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(7,9,26,0.82) 0%, rgba(13,17,48,0.75) 50%, rgba(7,9,26,0.85) 100%)',
          }}
        />
        {/* Purple/gold glow orbs */}
        <div className="absolute top-0 left-1/4 w-48 h-48 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />

        <div className="relative">
          <img
            src="https://assets.football-logos.cc/logos/tournaments/1500x1500/fifa-world-cup-2026.31d2489d.png"
            alt="FIFA World Cup 2026"
            className="w-40 h-40 object-contain mx-auto mb-4 drop-shadow-2xl"
          />
          <h1 className="text-5xl font-extrabold text-white mb-3">
            FIFA World Cup{' '}
            <span className="text-gradient-gold">2026</span>
          </h1>
          <p className="text-white/50 text-lg">EUA · México · Canadá</p>
          <p className="text-white/30 text-sm mt-1">11 Jun – 19 Jul 2026</p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <Link to="/matches"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-wc-dark shadow-glow-gold transition-all hover:shadow-glow-gold hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' }}
            >
              Ver Calendário
            </Link>
            <Link to="/groups"
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white border border-white/10 hover:border-wc-purple/50 transition-all hover:bg-wc-purple/10"
            >
              Classificações
            </Link>
          </div>
        </div>
      </div>

      {/* Today's Matches */}
      {todayMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Jogos de Hoje
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {todayMatches.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      )}

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Últimos Resultados</h2>
            <Link to="/matches?status=Finished" className="text-wc-gold text-sm hover:underline">Ver todos →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recentResults.map(m => <MatchCard key={m.id} match={m} compact />)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Próximos Jogos</h2>
            <Link to="/matches" className="text-wc-gold text-sm hover:underline">Calendário completo →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map(m => <MatchCard key={m.id} match={m} compact showDate />)}
          </div>
        </section>
      )}

      {/* Stats */}
      {stats && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Estatísticas</h2>
            <Link to="/stats" className="text-wc-gold text-sm hover:underline">Ver completo →</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <StatCard title="Melhores Marcadores" icon="⚽" players={stats.topScorers} statKey="goals" statLabel="golos" limit={5} />
            <StatCard title="Melhores Assistentes" icon="🎯" players={stats.topAssists} statKey="assists" statLabel="assistências" limit={5} />
            <StatCard title="Mais Jogos a Zero" icon="🧤" players={stats.cleanSheets} statKey="cleanSheets" statLabel="clean sheets" limit={5} />
          </div>
        </section>
      )}

      {todayMatches.length === 0 && recentResults.length === 0 && upcoming.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <div className="text-5xl mb-4">⚽</div>
          <p className="text-sm mt-2">Vai a <Link to="/matches" className="text-wc-gold underline">Jogos</Link> para ver o calendário completo</p>
        </div>
      )}
    </div>
  );
}
