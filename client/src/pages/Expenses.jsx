import { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Pencil, Trash2 } from 'lucide-react';
import { api, errMsg, inr, dstr, today, toast, download } from '../api';
import { Modal, Field, Empty, PAYMENT_METHODS } from '../ui';

const CATS = ['Decoration', 'Packaging / Parcel', 'Rent', 'Salary', 'Electricity', 'Transport', 'Marketing', 'Repairs', 'Other'];

function Form({ e, onClose, onSaved }) {
  const [f, setF] = useState(e ? { ...e, date: e.date.slice(0, 10) } : { title: '', category: 'Decoration', amount: '', paymentMethod: 'Cash', date: today(), note: '' });
  const set = k => ev => setF({ ...f, [k]: ev.target.value });
  const submit = async ev => { ev.preventDefault(); try { await (e ? api.put('/expenses/' + e._id, f) : api.post('/expenses', f)); toast('Expense saved'); onSaved(); } catch (x) { toast(errMsg(x), 'err'); } };
  return (
    <Modal title={e ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={submit} className="grid2">
        <div className="span2"><Field label="What was it for? *"><input required value={f.title} onChange={set('title')} placeholder="e.g. Diwali window decoration" /></Field></div>
        <Field label="Category"><select value={f.category} onChange={set('category')}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Amount (₹) *"><input required type="number" min="0" step="any" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Paid via"><select value={f.paymentMethod} onChange={set('paymentMethod')}>{PAYMENT_METHODS.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <div className="span2"><Field label="Note"><input value={f.note || ''} onChange={set('note')} /></Field></div>
        <div className="span2 actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

export default function Expenses() {
  const [rows, setRows] = useState([]), [modal, setModal] = useState(null), [cat, setCat] = useState('');
  const load = () => api.get('/expenses').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);
  const list = rows.filter(r => !cat || r.category === cat);
  const byCat = useMemo(() => Object.entries(rows.reduce((a, r) => ({ ...a, [r.category || 'Other']: (a[r.category || 'Other'] || 0) + r.amount }), {})), [rows]);
  const del = async r => { if (confirm('Delete this expense?')) { await api.delete('/expenses/' + r._id); load(); } };
  return (
    <>
      <div className="page-h"><div><h1>Other expenses</h1><p className="muted">Decoration, parcels, rent and everything else that is not stock</p></div>
        <div className="row"><button className="btn" onClick={() => download('/export/expenses', 'expenses.xlsx')}><Download size={16} />Export</button>
          <button className="btn primary" onClick={() => setModal({})}><Plus size={16} />Add expense</button></div></div>
      <div className="stats s4"><div className="stat bad"><span>Total expenses</span><b>{inr(rows.reduce((a, r) => a + r.amount, 0))}</b></div>
        {byCat.slice(0, 3).map(([k, v]) => <div className="stat" key={k}><span>{k}</span><b>{inr(v)}</b></div>)}</div>
      <div className="card"><div className="toolbar"><select value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
        {!list.length ? <Empty text="No expenses recorded." /> :
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Paid via</th><th className="r">Amount</th><th></th></tr></thead>
            <tbody>{list.map(r => <tr key={r._id}><td>{dstr(r.date)}</td><td><b>{r.title}</b><div className="muted sm">{r.note}</div></td><td><span className="badge blue">{r.category}</span></td><td>{r.paymentMethod}</td><td className="r">{inr(r.amount)}</td>
              <td className="acts"><button className="icon-btn" onClick={() => setModal(r)}><Pencil size={16} /></button><button className="icon-btn" onClick={() => del(r)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}</div>
      {modal && <Form e={modal._id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </>
  );
}
