import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Download, Upload, FileSpreadsheet, Pencil, PackagePlus, PackageMinus, Trash2, ImagePlus } from 'lucide-react';
import { api, errMsg, inr, toast, download, r4, today } from '../api';
import { Modal, Field, Empty } from '../ui';

const CATS = ['Pendant', 'Ring', 'Earrings', 'Necklace', 'Bracelet', 'Bangle', 'Chain', 'Anklet', 'Set'];
const MATS = ['Gold', 'Silver', 'Artificial', 'Oxidised', 'Diamond', 'Pearl'];

function ProductForm({ p, onClose, onSaved }) {
  const [f, setF] = useState(() => p ? { name: p.name, sku: p.sku || '', category: p.category || '', material: p.material || '', description: p.description || '',
    quantity: p.quantity, buyUnit: r4(p.costPerUnit), buyTotal: r4(p.quantity * p.costPerUnit), sellUnit: r4(p.sellPerUnit), sellTotal: r4(p.quantity * p.sellPerUnit), lowStockAt: p.lowStockAt }
    : { name: '', sku: '', category: '', material: '', description: '', quantity: '', buyUnit: '', buyTotal: '', sellUnit: '', sellTotal: '', lowStockAt: 2 });
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false);
  const qty = Number(f.quantity) || 0;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const setQty = v => setF({ ...f, quantity: v, buyTotal: f.buyUnit === '' ? '' : r4(f.buyUnit * v), sellTotal: f.sellUnit === '' ? '' : r4(f.sellUnit * v) });
  const unit = (k, v) => setF({ ...f, [k + 'Unit']: v, [k + 'Total']: v === '' ? '' : r4(v * qty) });
  const total = (k, v) => setF({ ...f, [k + 'Total']: v, [k + 'Unit']: v === '' || !qty ? '' : r4(v / qty) });
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData();
    Object.entries({ name: f.name, sku: f.sku, category: f.category, material: f.material, description: f.description, lowStockAt: f.lowStockAt,
      costPerUnit: f.buyUnit || 0, sellPerUnit: f.sellUnit || 0, ...(p ? {} : { quantity: f.quantity || 0 }) }).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('image', file);
    try { await (p ? api.put('/products/' + p._id, fd) : api.post('/products', fd)); toast('Product saved'); onSaved(); }
    catch (x) { toast(errMsg(x), 'err'); setBusy(false); }
  };
  const preview = file ? URL.createObjectURL(file) : p?.image?.url;
  return (
    <Modal title={p ? 'Edit product' : 'Add product'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid2">
        <div className="span2 img-pick">
          <label className="img-drop">{preview ? <img src={preview} alt="" /> : <><ImagePlus size={26} /><span>Upload image</span></>}
            <input hidden type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} /></label>
          <div className="grow grid2">
            <Field label="Product name *"><input required value={f.name} onChange={set('name')} placeholder="e.g. Dragonfly pendant" /></Field>
            <Field label="SKU / Code"><input value={f.sku} onChange={set('sku')} placeholder="PND-001" /></Field>
            <Field label="Category"><input list="cats" value={f.category} onChange={set('category')} /></Field>
            <Field label="Material"><input list="mats" value={f.material} onChange={set('material')} /></Field>
          </div>
        </div>
        <datalist id="cats">{CATS.map(c => <option key={c} value={c} />)}</datalist><datalist id="mats">{MATS.map(c => <option key={c} value={c} />)}</datalist>
        <Field label="Quantity" hint={p ? 'Use Restock / Deduct to change stock so it is logged' : ''}>
          <input type="number" min="0" value={f.quantity} disabled={!!p} onChange={e => setQty(e.target.value)} /></Field>
        <Field label="Low stock alert at"><input type="number" min="0" value={f.lowStockAt} onChange={set('lowStockAt')} /></Field>
        <Field label="Buying price - each (₹)"><input type="number" step="any" min="0" value={f.buyUnit} onChange={e => unit('buy', e.target.value)} /></Field>
        <Field label="Buying price - total (₹)"><input type="number" step="any" min="0" value={f.buyTotal} disabled={!!p} onChange={e => total('buy', e.target.value)} /></Field>
        <Field label="Selling price - each (₹)"><input type="number" step="any" min="0" value={f.sellUnit} onChange={e => unit('sell', e.target.value)} /></Field>
        <Field label="Selling price - total (₹)"><input type="number" step="any" min="0" value={f.sellTotal} disabled={!!p} onChange={e => total('sell', e.target.value)} /></Field>
        <div className="span2 info">Expected profit on this stock: <b>{inr((f.sellUnit - f.buyUnit) * qty)}</b> ({inr(f.sellUnit - f.buyUnit)} per piece)</div>
        <div className="span2"><Field label="Description"><textarea rows="2" value={f.description} onChange={set('description')} /></Field></div>
        <div className="span2 actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving...' : 'Save product'}</button></div>
      </form>
    </Modal>
  );
}

function Restock({ p, onClose, onSaved }) {
  const [f, setF] = useState({ qty: '', unitCost: p.costPerUnit, sellPerUnit: p.sellPerUnit, note: '', date: today() });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); try { await api.post(`/products/${p._id}/restock`, f); toast('Stock added'); onSaved(); } catch (x) { toast(errMsg(x), 'err'); } };
  return (
    <Modal title={`Restock - ${p.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid2">
        <Field label="Quantity bought"><input required type="number" min="1" value={f.qty} onChange={set('qty')} /></Field>
        <Field label="Buying price each (₹)"><input required type="number" step="any" value={f.unitCost} onChange={set('unitCost')} /></Field>
        <Field label="Selling price each (₹)"><input type="number" step="any" value={f.sellPerUnit} onChange={set('sellPerUnit')} /></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <div className="span2 info">Total cost of this purchase: <b>{inr(f.qty * f.unitCost)}</b>. Average buying price updates automatically.</div>
        <div className="span2"><Field label="Note / supplier"><input value={f.note} onChange={set('note')} /></Field></div>
        <div className="span2 actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Add stock</button></div>
      </form>
    </Modal>
  );
}

function Deduct({ p, onClose, onSaved }) {
  const [f, setF] = useState({ qty: '', reason: 'Damaged', note: '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); try { await api.post(`/products/${p._id}/adjust`, f); toast('Stock deducted'); onSaved(); } catch (x) { toast(errMsg(x), 'err'); } };
  return (
    <Modal title={`Deduct stock - ${p.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid2">
        <Field label={`Quantity (in stock: ${p.quantity})`}><input required type="number" min="1" max={p.quantity} value={f.qty} onChange={set('qty')} /></Field>
        <Field label="Reason"><select value={f.reason} onChange={set('reason')}>{['Damaged', 'Lost / stolen', 'Gift / sample', 'Returned to supplier', 'Count correction', 'Other'].map(x => <option key={x}>{x}</option>)}</select></Field>
        <div className="span2"><Field label="Note"><input value={f.note} onChange={set('note')} /></Field></div>
        <div className="span2 actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn danger">Deduct</button></div>
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const [items, setItems] = useState([]), [q, setQ] = useState(''), [cat, setCat] = useState(''), [modal, setModal] = useState(null), fileRef = useRef();
  const load = () => api.get('/products').then(r => setItems(r.data));
  useEffect(() => { load(); }, []);
  const done = () => { setModal(null); load(); };
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
  const list = useMemo(() => items.filter(i => (!cat || i.category === cat) && (i.name + (i.sku || '')).toLowerCase().includes(q.toLowerCase())), [items, q, cat]);
  const sum = list.reduce((a, i) => ({ u: a.u + i.quantity, b: a.b + i.quantity * i.costPerUnit, s: a.s + i.quantity * i.sellPerUnit }), { u: 0, b: 0, s: 0 });
  const del = async p => { if (confirm(`Delete "${p.name}"? Its history stays in the logs.`)) { await api.delete('/products/' + p._id); load(); } };
  const importFile = async e => {
    const file = e.target.files[0]; if (!file) return; const fd = new FormData(); fd.append('file', file);
    try { const { data } = await api.post('/import/products', fd); toast(`Imported: ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`); load(); } catch (x) { toast(errMsg(x), 'err'); }
    e.target.value = '';
  };
  return (
    <>
      <div className="page-h"><div><h1>Inventory</h1><p className="muted">Every product with per-piece and total buying / selling price</p></div>
        <div className="row">
          <button className="btn" onClick={() => download('/export/template', 'import-template.xlsx')}><FileSpreadsheet size={16} />Template</button>
          <button className="btn" onClick={() => fileRef.current.click()}><Upload size={16} />Import Excel</button>
          <input hidden ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importFile} />
          <button className="btn" onClick={() => download('/export/products', 'products.xlsx')}><Download size={16} />Export</button>
          <button className="btn primary" onClick={() => setModal({ t: 'form' })}><Plus size={16} />Add product</button></div></div>
      <div className="stats s4">
        <div className="stat"><span>Units in stock</span><b>{sum.u}</b></div><div className="stat"><span>Total buying value</span><b>{inr(sum.b)}</b></div>
        <div className="stat"><span>Total selling value</span><b>{inr(sum.s)}</b></div><div className="stat good"><span>Expected profit</span><b>{inr(sum.s - sum.b)}</b></div></div>
      <div className="card">
        <div className="toolbar"><div className="search"><Search size={16} /><input placeholder="Search name or SKU" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select></div>
        {!list.length ? <Empty text="No products yet. Add one or import from Excel." /> :
          <div className="table-wrap"><table><thead><tr><th></th><th>Product</th><th>Category</th><th className="r">Qty</th><th className="r">Buy each</th><th className="r">Buy total</th><th className="r">Sell each</th><th className="r">Sell total</th><th className="r">Profit</th><th></th></tr></thead>
            <tbody>{list.map(p => { const pr = p.quantity * (p.sellPerUnit - p.costPerUnit); return (
              <tr key={p._id}><td>{p.image?.url ? <img className="thumb" src={p.image.url} alt="" /> : <div className="thumb ph" />}</td>
                <td><b>{p.name}</b><div className="muted sm">{[p.sku, p.material].filter(Boolean).join(' · ')}</div></td><td>{p.category || '-'}</td>
                <td className="r">{p.quantity === 0 ? <span className="badge red">Out</span> : p.quantity <= p.lowStockAt ? <span className="badge amber">{p.quantity} low</span> : p.quantity}</td>
                <td className="r">{inr(p.costPerUnit)}</td><td className="r">{inr(p.quantity * p.costPerUnit)}</td><td className="r">{inr(p.sellPerUnit)}</td><td className="r">{inr(p.quantity * p.sellPerUnit)}</td>
                <td className={'r ' + (pr >= 0 ? 'pos' : 'neg')}>{inr(pr)}</td>
                <td className="acts"><button title="Restock" className="icon-btn" onClick={() => setModal({ t: 'restock', p })}><PackagePlus size={16} /></button>
                  <button title="Deduct" className="icon-btn" onClick={() => setModal({ t: 'deduct', p })}><PackageMinus size={16} /></button>
                  <button title="Edit" className="icon-btn" onClick={() => setModal({ t: 'form', p })}><Pencil size={16} /></button>
                  <button title="Delete" className="icon-btn" onClick={() => del(p)}><Trash2 size={16} /></button></td></tr>); })}</tbody></table></div>}
      </div>
      {modal?.t === 'form' && <ProductForm p={modal.p} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.t === 'restock' && <Restock p={modal.p} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.t === 'deduct' && <Deduct p={modal.p} onClose={() => setModal(null)} onSaved={done} />}
    </>
  );
}
