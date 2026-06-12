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

const PAGE_SIZE = 15;

export default function News() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    getNews().then(setArticles).finally(() => setLoading(false));
  }, []);

  const totalPages = Math.ceil(articles.length / PAGE_SIZE);
  const pageArticles = articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          {pageArticles.map(article => (
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => { setPage(p => p - 1); setExpanded(null); }}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-wc-navy border border-wc-blue text-white/60 hover:text-white hover:border-wc-gold/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => { setPage(p); setExpanded(null); }}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                  p === page
                    ? 'text-wc-dark font-bold'
                    : 'text-white/50 hover:text-white hover:bg-white/6'
                }`}
                style={p === page ? { background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' } : {}}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setPage(p => p + 1); setExpanded(null); }}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-wc-navy border border-wc-blue text-white/60 hover:text-white hover:border-wc-gold/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  );
}
