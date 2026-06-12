import { useEffect, useState } from 'react';
import { getNews } from '../lib/api';
import type { NewsArticle } from '../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

export default function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    getNews().then(setArticles).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20 text-wc-gold animate-pulse text-xl">A carregar notícias...</div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white">Notícias</h1>
        <span className="text-white/40 text-sm">Fonte: ESPN</span>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-5xl mb-4">📰</div>
          <p>Ainda sem notícias — o sync corre a cada 15 minutos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map(article => (
            <div
              key={article.id}
              className="bg-wc-navy border border-wc-blue rounded-xl overflow-hidden"
            >
              {/* Imagem + header clicável */}
              <button
                className="w-full text-left focus:outline-none"
                onClick={() => setExpanded(expanded === article.id ? null : article.id)}
              >
                <div className="flex gap-4 p-4">
                  {article.imageUrl && (
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-snug line-clamp-2">
                      {article.headline}
                    </p>
                    <p className="text-white/40 text-xs mt-1">{timeAgo(article.publishedAt)}</p>
                  </div>
                  <span className="text-white/30 text-lg flex-shrink-0 self-center">
                    {expanded === article.id ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {/* Descrição expandida */}
              {expanded === article.id && (
                <div className="px-4 pb-4 border-t border-wc-blue/30">
                  <p className="text-white/70 text-sm leading-relaxed mt-3">
                    {article.description || 'Sem resumo disponível.'}
                  </p>
                  {article.link && (
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-wc-blue border border-wc-gold/30 text-wc-gold text-sm font-semibold rounded-lg hover:bg-wc-gold hover:text-wc-dark transition-colors"
                    >
                      Ler artigo completo →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
