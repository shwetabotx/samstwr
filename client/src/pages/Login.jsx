import { useEffect, useState } from 'react';
import { Gem } from 'lucide-react';
import { api, errMsg } from '../api';

export default function Login() {
  const [setup, setSetup] = useState(false), [f, setF] = useState({ name: '', email: '', password: '' }), [error, setError] = useState('');
  useEffect(() => { api.get('/auth/status').then(r => setSetup(r.data.setupNeeded)).catch(() => {}); }, []);
  const submit = async e => {
    e.preventDefault(); setError('');
    try { const { data } = await api.post(setup ? '/auth/register' : '/auth/login', f); localStorage.setItem('token', data.token); location.href = '/'; }
    catch (x) { setError(errMsg(x)); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand big"><Gem size={30} /><span>Jewel<b>Ledger</b></span></div>
        <p className="muted">{setup ? 'Create your owner account to get started' : 'Sign in to manage your shop'}</p>
        {setup && <input placeholder="Your name" value={f.name} onChange={set('name')} />}
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <input type="password" placeholder="Password (6+ characters)" value={f.password} onChange={set('password')} required />
        {error && <div className="err">{error}</div>}
        <button className="btn primary full">{setup ? 'Create account' : 'Sign in'}</button>
      </form>
    </div>
  );
}
