import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, Line, ComposedChart } from 'recharts';
import { api, inr } from '../api';
import { Empty } from '../ui';

const COLORS = ['#c9a24b', '#4f8cff', '#2fb67c', '#e0653f', '#9b6bd6', '#e2b93b', '#3bb8c9'];
const from = k => { const d = new Date(); if (k === 'month') return new Date(d.getFullYear(), d.getMonth(), 1); if (k === '3m') return new Date(d.getFullYear(), d.getMonth() - 2, 1); if (k === 'year') return new Date(d.getFullYear(), 0, 1); return null; };
const S = ({ label, value, tone, sub }) => <div className={'stat ' + (tone || '')}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>;
const fmt = v => inr(v);

export default function Dashboard() {
  const [range, setRange] = useState('month'), [a, setA] = useState(null);
  useEffect(() => { const f = from(range); api.get('/analytics', { params: f ? { from: f.toISOString() } : {} }).then(r => setA(r.data)); }, [range]);
  if (!a) return <p className="muted">Loading...</p>;
  const margin = a.revenue ? ((a.grossProfit / a.revenue) * 100).toFixed(1) : 0;
  return (
    <>
      <div className="page-h"><div><h1>Dashboard</h1><p className="muted">How your shop is performing</p></div>
        <select value={range} onChange={e => setRange(e.target.value)}><option value="month">This month</option><option value="3m">Last 3 months</option><option value="year">This year</option><option value="all">All time</option></select></div>
      <div className="stats">
        <S label="Net profit" value={inr(a.netProfit)} tone={a.netProfit >= 0 ? 'good' : 'bad'} sub="Sales profit minus expenses" />
        <S label="Sales revenue" value={inr(a.revenue)} sub={`${a.salesCount} bills · ${a.units} pieces sold`} />
        <S label="Gross profit" value={inr(a.grossProfit)} sub={`${margin}% margin`} />
        <S label="Other expenses" value={inr(a.expenses)} tone="bad" />
        <S label="Stock bought" value={inr(a.bought)} sub={`${a.boughtUnits} pieces`} />
        <S label="Stock in hand (cost)" value={inr(a.stock.costValue)} sub={`${a.stock.units} pieces`} />
        <S label="Stock in hand (selling)" value={inr(a.stock.sellValue)} sub={`Potential profit ${inr(a.stock.sellValue - a.stock.costValue)}`} />
        <S label="Customer dues" value={inr(a.dues)} tone={a.dues > 0 ? 'bad' : ''} sub="Pending payments" />
      </div>
      <div className="grid-charts">
        <div className="card pad span-2"><h3>Monthly revenue, profit & expenses</h3>
          {a.monthly.length ? <ResponsiveContainer height={280}><ComposedChart data={a.monthly}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)" /><XAxis dataKey="month" stroke="var(--muted)" fontSize={12} /><YAxis stroke="var(--muted)" fontSize={12} />
            <Tooltip formatter={fmt} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }} /><Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#c9a24b" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#e0653f" radius={[4, 4, 0, 0]} /><Line dataKey="profit" name="Gross profit" stroke="#2fb67c" strokeWidth={2} /></ComposedChart></ResponsiveContainer> : <Empty text="No data in this period" />}</div>
        <div className="card pad"><h3>Sales by category</h3>{a.byCategory.length ? <ResponsiveContainer height={280}><PieChart><Pie data={a.byCategory} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>{a.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={fmt} /><Legend /></PieChart></ResponsiveContainer> : <Empty text="No sales yet" />}</div>
        <div className="card pad"><h3>Payment methods</h3>{a.byPayment.length ? <ResponsiveContainer height={260}><PieChart><Pie data={a.byPayment} dataKey="value" outerRadius={90}>{a.byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={fmt} /><Legend /></PieChart></ResponsiveContainer> : <Empty text="No sales yet" />}</div>
        <div className="card pad"><h3>Best sellers by profit</h3>{a.topProducts.length ? <table className="inner"><thead><tr><th>Product</th><th className="r">Sold</th><th className="r">Profit</th></tr></thead><tbody>{a.topProducts.map(p => <tr key={p.name}><td>{p.name}</td><td className="r">{p.qty}</td><td className="r pos">{inr(p.profit)}</td></tr>)}</tbody></table> : <Empty text="No sales yet" />}</div>
        <div className="card pad"><h3>Low stock alerts</h3>{a.lowStock.length ? <table className="inner"><tbody>{a.lowStock.map(p => <tr key={p._id}><td>{p.name}</td><td className="r"><span className={'badge ' + (p.quantity === 0 ? 'red' : 'amber')}>{p.quantity === 0 ? 'Out of stock' : p.quantity + ' left'}</span></td></tr>)}</tbody></table> : <Empty text="All products are well stocked" />}</div>
      </div>
    </>
  );
}
