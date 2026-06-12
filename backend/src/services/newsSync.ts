import { eq } from 'drizzle-orm';
import db from '../db/index';
import { news } from '../db/schema';
import { sendNotification } from './pushService';

const ESPN_NEWS = 'https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.World/news?limit=20';

type ESPNArticle = {
  id: number | string;
  headline?: string;
  description?: string;
  published?: string;
  images?: Array<{ url: string }>;
  links?: { web?: { href: string } };
};

export async function syncNews(): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = [];
  let added = 0;

  try {
    const res = await fetch(ESPN_NEWS, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);

    const data = await res.json() as { articles?: ESPNArticle[] };
    const articles = data.articles || [];

    // Buscar IDs já guardados
    const existing = await db.select({ espnId: news.espnId }).from(news);
    const existingIds = new Set(existing.map(n => n.espnId));

    for (const article of articles) {
      const espnId = String(article.id);
      if (existingIds.has(espnId)) continue;

      const headline = article.headline || '';
      const description = article.description || '';
      const imageUrl = article.images?.[0]?.url || '';
      const link = article.links?.web?.href || '';
      const publishedAt = article.published || new Date().toISOString();

      try {
        await db.insert(news).values({ espnId, headline, description, imageUrl, link, publishedAt, notified: 0 });
        added++;

        // Enviar notificação push
        await sendNotification(
          `📰 ${headline}`,
          description.slice(0, 100) + (description.length > 100 ? '…' : ''),
          '/news'
        ).catch(() => {});

        // Marcar como notificado
        await db.update(news).set({ notified: 1 }).where(eq(news.espnId, espnId));
      } catch (e: any) {
        errors.push(`${espnId}: ${e.message}`);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  if (added > 0) console.log(`[NewsSync] ${added} notícia(s) nova(s)`);
  return { added, errors };
}
