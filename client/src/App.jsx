import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, ReceiptText, History, Wallet, Sun, Moon, LogOut, Gem } from 'lucide-react';
import { Toaster } from './ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Movements from './pages/Movements';
import Expenses from './pages/Expenses';

const nav = [
  ['/', 'Dashboard', LayoutDashboard], ['/inventory', 'Inventory', Package], ['/sales', 'Sales & Payments', ReceiptText],
  ['/history', 'Stock History', History], ['/expenses', 'Expenses', Wallet],
];

function Shell({ theme, setTheme }) {
  const logout = () => { localStorage.removeItem('token'); location.href = '/login'; };
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Gem size={22} /><span>SAM<b>STWR</b></span></div>
        <nav>{nav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}><Icon size={18} /><span>{label}</span></NavLink>))}</nav>
        <div className="side-foot">
          <button className="nav" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
          <button className="nav" onClick={logout}><LogOut size={18} /><span>Logout</span></button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} /><Route path="/inventory" element={<Inventory />} />
          <Route path="/sales" element={<Sales />} /><Route path="/history" element={<Movements />} />
          <Route path="/expenses" element={<Expenses />} /><Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={localStorage.getItem('token') ? <Shell theme={theme} setTheme={setTheme} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
