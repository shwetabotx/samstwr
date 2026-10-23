import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, dstr, download } from '../api';
import { Empty } from '../ui';

const label = { purchase: ['Stock added', 'green'], sale: ['Sold', 'blue'], sale_cancel: ['Sale cancelled', 'amber'], adjustment: ['Deducted', 'red'] };

export default function Movements() {
  const [rows, setRows] = useState([]), [type, setType] = useState('');
  useEffect(() => { api.get('/movements', { params: { type } }).then(r => setRows(r.data)); }, [type]);
  return (
    <>
      <div className="page-h"><div><h1>Stock history</h1><p className="muted">Every addition and deduction, with the reason behind it</p></div>
        <div className="row"><select value={type} onChange={e => setType(e.target.value)}><option value="">All movements</option>
          {Object.entries(label).map(([k, [v]]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn" onClick={() => download('/export/movements', 'stock-history.xlsx')}><Download size={16} />Export</button></div></div>
      <div className="card">{!rows.length ? <Empty text="No stock movements yet." /> :
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="r">Qty</th><th className="r">Unit cost</th><th className="r">Unit price</th><th>Reason / note</th></tr></thead>
          <tbody>{rows.map(m => <tr key={m._id}><td>{dstr(m.date)}</td><td><b>{m.productName}</b></td><td><span className={'badge ' + label[m.type]?.[1]}>{label[m.type]?.[0] || m.type}</span></td>
            <td className={'r ' + (m.qty > 0 ? 'pos' : 'neg')}>{m.qty > 0 ? '+' : ''}{m.qty}</td><td className="r">{m.unitCost ? '₹' + m.unitCost.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}</td>
            <td className="r">{m.unitPrice ? '₹' + m.unitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}</td><td>{[m.reason, m.note].filter(Boolean).join(' - ')}</td></tr>)}</tbody></table></div>}</div>
    </>
  );
}
