import express from 'express';
import cors from 'cors';
import { eq, or } from 'drizzle-orm';
import teamsRouter from './routes/teams';
import playersRouter from './routes/players';
import matchesRouter from './routes/matches';
import statsRouter from './routes/stats';
import syncRouter from './routes/sync';
import lineupsRouter from './routes/lineups';
import simulateRouter from './routes/simulate';
import healthRouter from './routes/health';
import pushRouter from './routes/push';
import { sendNotification } from './services/pushService';
import { syncLiveScores, syncUpcomingIds, syncKnockoutTeams } from './services/espnSync';
import db from './db/index';
import { matches } from './db/schema';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = ['http://localhost:5173', 'http://localhost:5174'];
    // Permite IPs de rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocal = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);
    // Permite qualquer subdomínio do Vercel
    const isVercel = /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
    callback(null, allowed.includes(origin) || isLocal || isVercel);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/teams', teamsRouter);
app.use('/api/players', playersRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/lineups', lineupsRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/health', healthRouter);
app.use('/api/push', pushRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Mundial 2026 API' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 API Mundial 2026 a correr em http://localhost:${PORT}`);
  startAutoSync();
});

async function startAutoSync() {
  let timer: ReturnType<typeof setTimeout>;
  let lastIdSync = 0;
  const notifiedGames = new Set<number>(); // IDs de jogos cujo "10 min" já foi enviado

  async function tick() {
    const now = new Date();
    const nowMs = now.getTime();

    const allMatches = await db.select({ id: matches.id, status: matches.status, date: matches.date })
      .from(matches)
      .where(or(eq(matches.status, 'Live'), eq(matches.status, 'Scheduled')));

    const hasLive = allMatches.some(m => m.status === 'Live');
    const soonMatches = allMatches.filter(m => {
      const diff = new Date(m.date).getTime() - nowMs;
      return m.status === 'Scheduled' && diff >= 0 && diff <= 15 * 60 * 1000;
    });
    const hasSoon = soonMatches.length > 0;

    // Jogos que começaram enquanto o servidor estava inativo (até 4h no passado)
    const hasMissed = allMatches.some(m => {
      if (m.status !== 'Scheduled') return false;
      const diff = new Date(m.date).getTime() - nowMs;
      return diff < 0 && diff > -4 * 60 * 60 * 1000;
    });

    // Notificação "10 minutos" — uma vez por jogo (deduplicada)
    for (const m of soonMatches) {
      const diff = new Date(m.date).getTime() - nowMs;
      if (diff >= 8 * 60 * 1000 && diff <= 12 * 60 * 1000 && !notifiedGames.has(m.id)) {
        notifiedGames.add(m.id);
        sendNotification('⏰ Jogo em 10 minutos!', `${m.date.substring(11, 16)} — A começar em breve`, '/matches').catch(() => {});
      }
    }

    // Sync de resultados: quando há atividade ou jogos perdidos
    if (hasLive || hasSoon || hasMissed) {
      try {
        const result = await syncLiveScores();
        if (result.updated > 0) console.log(`[AutoSync] ${result.updated} jogo(s) actualizados`);
      } catch (err) {
        console.error('[AutoSync] Erro scores:', err);
      }
    }

    // ESPN ID sync + knockout team propagation — every 15 minutes
    if (nowMs - lastIdSync >= 15 * 60_000) {
      try {
        const idResult = await syncUpcomingIds();
        if (idResult.filled > 0) console.log(`[AutoSync] ${idResult.filled} ESPN ID(s) preenchidos`);
        if (idResult.errors.length > 0) console.warn('[AutoSync] ID sync erros:', idResult.errors);
      } catch (err) {
        console.error('[AutoSync] Erro IDs:', err);
      }
      try {
        const koResult = await syncKnockoutTeams();
        if (koResult.updated > 0) console.log(`[AutoSync] ${koResult.updated} jogo(s) de knockout preenchidos`);
        if (koResult.errors.length > 0) console.warn('[AutoSync] Knockout sync erros:', koResult.errors);
      } catch (err) {
        console.error('[AutoSync] Erro knockout teams:', err);
      }
      lastIdSync = nowMs;
    }

    const interval = (hasLive || hasSoon || hasMissed) ? 30_000 : 5 * 60_000;
    timer = setTimeout(tick, interval);
  }

  // Primeira execução 10 segundos após arranque
  timer = setTimeout(tick, 10_000);
  console.log('⚡ Auto-sync de resultados activo');
}
