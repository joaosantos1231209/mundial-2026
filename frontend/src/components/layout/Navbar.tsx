import { NavLink } from 'react-router-dom';
import NotificationToggle from '../NotificationToggle';

const links = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/groups', label: 'Grupos', icon: '📊' },
  { to: '/bracket', label: 'Eliminatórias', icon: '🏆' },
  { to: '/matches', label: 'Jogos', icon: '⚽' },
  { to: '/teams', label: 'Equipas', icon: '🌍' },
  { to: '/stats', label: 'Estatísticas', icon: '📈' },
  { to: '/what-if', label: 'What-If', icon: '⚡' },
  { to: '/admin', label: 'Admin', icon: '⚙️' },
];

export default function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 border-b border-white/8"
      style={{
        background: 'linear-gradient(180deg, rgba(13,17,48,0.98) 0%, rgba(7,9,26,0.95) 100%)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 1px 0 rgba(124,58,237,0.15), 0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 h-14 md:h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group flex-shrink-0">
            <img
              src="https://assets.football-logos.cc/logos/tournaments/1500x1500/fifa-world-cup-2026.31d2489d.png"
              alt="FIFA World Cup 2026"
              className="w-8 h-8 md:w-9 md:h-9 object-contain rounded-xl shadow-glow-purple"
            />
            <div className="hidden sm:block">
              <div className="text-gradient-gold font-extrabold text-base leading-none tracking-wider">MUNDIAL</div>
              <div className="text-white/40 text-xs font-medium tracking-widest">FIFA 2026</div>
            </div>
          </NavLink>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-white/10 flex-shrink-0" />

          {/* Links — scrollable horizontal em mobile */}
          <div className="flex items-center gap-0.5 overflow-x-auto flex-1 scrollbar-none min-w-0">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1 px-2.5 py-2 md:px-3 rounded-lg text-sm font-medium transition-all duration-150 flex-shrink-0 ${
                    isActive
                      ? 'text-wc-dark font-bold shadow-glow-gold'
                      : 'text-white/60 hover:text-white hover:bg-white/6'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
                } : {}}
              >
                <span className="text-base leading-none">{link.icon}</span>
                <span className="hidden md:inline whitespace-nowrap">{link.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Notification bell */}
          <NotificationToggle />
        </div>
      </div>
    </nav>
  );
}
