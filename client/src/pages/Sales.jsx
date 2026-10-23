import { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Download, Trash2, ChevronDown, ChevronRight, Ban, Search } from 'lucide-react';
import { api, errMsg, inr, dstr, today, toast, download } from '../api';
import { Modal, Field, Empty, PAYMENT_METHODS } from '../ui';

function NewSale({ products, onClose, onSaved }) {
  const [rows, setRows] = useState([{ product: '', qty: 1, sellPrice: '' }]);
  const [f, setF] = useState({ name: '', phone: '', discount: '', paymentMethod: 'Cash', amountPaid: '', date: today(), note: '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const prod = id => products.find(p => p._id === id);
  const upd = (i, k, v) => setRows(rows.map((r, j) => j !== i ? r : k === 'product' ? { ...r, product: v, sellPrice: prod(v)?.sellPerUnit ?? '' } : { ...r, [k]: v }));
  const t = rows.reduce((a, r) => { const p = prod(r.product); if (!p) return a; a.sub += r.sellPrice * r.qty; a.cost += p.costPerUnit * r.qty; return a; }, { sub: 0, cost: 0 });
  const total = Math.max(0, t.sub - (Number(f.discount) || 0));
  const submit = async e => {
    e.preventDefault();
    try { await api.post('/sales', { customer: { name: f.name, phone: f.phone }, items: rows.filter(r => r.product), discount: f.discount, paymentMethod: f.paymentMethod, amountPaid: f.amountPaid, date: f.date, note: f.note }); toast('Sale recorded'); onSaved(); }
    catch (x) { toast(errMsg(x), 'err'); }
  };
  return (
    <Modal title="New sale" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid2"><Field label="Customer name"><input value={f.name} onChange={set('name')} /></Field><Field label="Phone"><input value={f.phone} onChange={set('phone')} /></Field></div>
        <div className="lines">{rows.map((r, i) => { const p = prod(r.product); return (
          <div className="line" key={i}>
            <select required value={r.product} onChange={e => upd(i, 'product', e.target.value)}><option value="">Select product</option>
              {products.filter(x => x.quantity > 0 || x._id === r.product).map(x => <option key={x._id} value={x._id}>{x.name} ({x.quantity} in stock)</option>)}</select>
            <input type="number" min="1" max={p?.quantity} placeholder="Qty" value={r.qty} onChange={e => upd(i, 'qty', e.target.value)} />
            <input type="number" step="any" placeholder="Sell price each" value={r.sellPrice} onChange={e => upd(i, 'sellPrice', e.target.value)} />
            <div className="muted sm nowrap">{p ? <>Cost {inr(p.costPerUnit)} · <b>{inr(r.sellPrice * r.qty)}</b></> : ''}</div>
            <button type="button" className="icon-btn" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : rows)}><Trash2 size={16} /></button></div>); })}
          <button type="button" className="btn sm" onClick={() => setRows([...rows, { product: '', qty: 1, sellPrice: '' }])}><Plus size={14} />Add item</button></div>
        <div className="grid2">
          <Field label="Discount (₹)"><input type="number" min="0" value={f.discount} onChange={set('discount')} /></Field>
          <Field label="Payment method"><select value={f.paymentMethod} onChange={set('paymentMethod')}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Amount received (₹)" hint="Leave empty if fully paid"><input type="number" min="0" value={f.amountPaid} onChange={set('amountPaid')} placeholder={String(total)} /></Field>
          <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field></div>
        <div className="info">Bill total <b>{inr(total)}</b> · Cost <b>{inr(t.cost)}</b> · Profit <b>{inr(total - t.cost)}</b></div>
        <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save sale</button></div>
      </form>
    </Modal>
  );
}

export default function Sales() {
  const [sales, setSales] = useState([]), [products, setProducts] = useState([]), [open, setOpen] = useState(null), [modal, setModal] = useState(false), [q, setQ] = useState(''), [method, setMethod] = useState('');
  const load = () => { api.get('/sales').then(r => setSales(r.data)); api.get('/products').then(r => setProducts(r.data)); };
  useEffect(load, []);
  const list = useMemo(() => sales.filter(s => (!method || s.paymentMethod === method) && (s.invoiceNo + (s.customer?.name || '') + (s.customer?.phone || '') + s.items.map(i => i.name).join()).toLowerCase().includes(q.toLowerCase())), [sales, q, method]);
  const cancel = async s => { if (confirm(`Cancel ${s.invoiceNo}? Items go back into stock.`)) { await api.post(`/sales/${s._id}/cancel`); load(); } };
  const receive = async s => {
    const v = prompt(`Total amount received so far for ${s.invoiceNo} (bill ${inr(s.total)})`, s.amountPaid);
    if (v !== null) { await api.patch(`/sales/${s._id}/payment`, { amountPaid: v }); load(); }
  };
  return (
    <>
      <div className="page-h"><div><h1>Sales & payments</h1><p className="muted">Full record of what each customer bought, at what price and how they paid</p></div>
        <div className="row"><button className="btn" onClick={() => download('/export/sales', 'sales.xlsx')}><Download size={16} />Export</button>
          <button className="btn primary" onClick={() => setModal(true)}><Plus size={16} />New sale</button></div></div>
      <div className="card">
        <div className="toolbar"><div className="search"><Search size={16} /><input placeholder="Search invoice, customer, product" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select value={method} onChange={e => setMethod(e.target.value)}><option value="">All payment methods</option>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
        {!list.length ? <Empty text="No sales yet." /> :
          <div className="table-wrap"><table><thead><tr><th></th><th>Invoice</th><th>Date</th><th>Customer</th><th className="r">Items</th><th className="r">Total</th><th className="r">Profit</th><th>Method</th><th>Payment</th><th></th></tr></thead>
            <tbody>{list.map(s => { const cost = s.items.reduce((a, i) => a + i.costPrice * i.qty, 0), due = s.total - s.amountPaid, x = open === s._id, c = s.status === 'cancelled'; return (
              <Fragment key={s._id}>
                <tr className={c ? 'faded' : ''}><td><button className="icon-btn" onClick={() => setOpen(x ? null : s._id)}>{x ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
                  <td><b>{s.invoiceNo}</b></td><td>{dstr(s.date)}</td><td>{s.customer?.name || 'Walk-in'}<div className="muted sm">{s.customer?.phone}</div></td>
                  <td className="r">{s.items.reduce((a, i) => a + i.qty, 0)}</td><td className="r">{inr(s.total)}</td><td className={'r ' + (s.total - cost >= 0 ? 'pos' : 'neg')}>{inr(s.total - cost)}</td>
                  <td>{s.paymentMethod}</td>
                  <td>{c ? <span className="badge red">Cancelled</span> : due > 0 ? <span className="badge amber">Due {inr(due)}</span> : <span className="badge green">Paid</span>}</td>
                  <td className="acts">{!c && due > 0 && <button className="btn sm" onClick={() => receive(s)}>Receive</button>}{!c && <button title="Cancel sale" className="icon-btn" onClick={() => cancel(s)}><Ban size={16} /></button>}</td></tr>
                {x && <tr className="detail"><td></td><td colSpan="9"><table className="inner"><thead><tr><th>Product</th><th className="r">Qty</th><th className="r">Base price</th><th className="r">Selling price</th><th className="r">Line total</th><th className="r">Profit</th></tr></thead>
                  <tbody>{s.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="r">{i.qty}</td><td className="r">{inr(i.costPrice)}</td><td className="r">{inr(i.sellPrice)}</td><td className="r">{inr(i.sellPrice * i.qty)}</td><td className="r">{inr((i.sellPrice - i.costPrice) * i.qty)}</td></tr>)}</tbody></table>
                  <div className="muted sm">Subtotal {inr(s.subtotal)} · Discount {inr(s.discount)} · Received {inr(s.amountPaid)}{s.note ? ' · ' + s.note : ''}</div></td></tr>}
              </Fragment>); })}</tbody></table></div>}
      </div>
      {modal && <NewSale products={products} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </>
  );
}
