import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  const location = useLocation();
  const isMatchDetail = /^\/matches\/\d+/.test(location.pathname);

  return (
    <div className="min-h-screen text-white">
      {/* FIFA 2026 watermark — todas as páginas excepto detalhe de jogo */}
      {!isMatchDetail && (
        <div className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none select-none">
          <img
            src="/favicon.png"
            alt=""
            className="w-[600px] h-[600px] object-contain opacity-[0.04]"
            style={{ filter: 'grayscale(100%)' }}
          />
        </div>
      )}
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/5 mt-16 py-6 text-center text-white/20 text-sm">
        <span className="text-gradient-gold font-semibold">MUNDIAL FIFA 2026</span>
        <span className="mx-2 text-white/10">·</span>
        Tracker Local
      </footer>
    </div>
  );
}
