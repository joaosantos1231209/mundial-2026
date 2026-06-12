import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import Bracket from './pages/Bracket';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Stats from './pages/Stats';
import Admin from './pages/Admin';
import WhatIf from './pages/WhatIf';
import PlayerDetail from './pages/PlayerDetail';
import News from './pages/News';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="groups" element={<Groups />} />
          <Route path="bracket" element={<Bracket />} />
          <Route path="matches" element={<Matches />} />
          <Route path="matches/:id" element={<MatchDetail />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:id" element={<TeamDetail />} />
          <Route path="players/:id" element={<PlayerDetail />} />
          <Route path="stats" element={<Stats />} />
          <Route path="news" element={<News />} />
          <Route path="what-if" element={<WhatIf />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={
            <div className="text-center py-20 text-white/30">
              <div className="text-5xl mb-4">404</div>
              <p>Página não encontrada</p>
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
