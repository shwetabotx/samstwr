require('dotenv').config();
const express = require('express'), cors = require('cors'), helmet = require('helmet');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), multer = require('multer');
const XLSX = require('xlsx'), cloudinary = require('cloudinary').v2, mongoose = require('mongoose');
const { User, Product, Sale, Expense, Move } = require('./models');

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }), cors(), express.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const err = (m, s = 400) => Object.assign(new Error(m), { status: s });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => res.status(e.status || 500).json({ message: e.message }));
const num = v => Number(v) || 0;
const sign = u => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const toCloud = buf => new Promise((ok, no) => cloudinary.uploader.upload_stream({ folder: 'jewellery-shop' },
  (e, r) => e ? no(e) : ok({ url: r.secure_url, publicId: r.public_id })).end(buf));

// ---------- Auth (first user becomes the owner; registration then closes) ----------
app.get('/api/auth/status', wrap(async (q, r) => r.json({ setupNeeded: !(await User.countDocuments()) })));
app.post('/api/auth/register', wrap(async (q, r) => {
  if (await User.countDocuments()) throw err('Owner account already exists', 403);
  const { name, email, password } = q.body;
  if (!email || !password || password.length < 6) throw err('Email and a password of 6+ characters required');
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  r.json({ token: sign(u), user: { name: u.name, email: u.email } });
}));
app.post('/api/auth/login', wrap(async (q, r) => {
  const u = await User.findOne({ email: (q.body.email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(q.body.password || '', u.password))) throw err('Invalid email or password', 401);
  r.json({ token: sign(u), user: { name: u.name, email: u.email } });
}));
app.use('/api', wrap((q, r, next) => {
  try { q.user = jwt.verify((q.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); }
  catch { throw err('Unauthorized', 401); }
  next();
}));

// ---------- Products ----------
app.get('/api/products', wrap(async (q, r) => r.json(await Product.find().sort('-createdAt'))));

app.post('/api/products', upload.single('image'), wrap(async (q, r) => {
  const b = q.body, qty = num(b.quantity), cost = num(b.costPerUnit);
  if (!b.name) throw err('Name is required');
  const p = new Product({ name: b.name, sku: b.sku || undefined, category: b.category, material: b.material, description: b.description,
    quantity: qty, costPerUnit: cost, sellPerUnit: num(b.sellPerUnit), lowStockAt: num(b.lowStockAt) || 2, totalBoughtQty: qty, totalBoughtCost: qty * cost });
  if (q.file) p.image = await toCloud(q.file.buffer);
  await p.save();
  if (qty > 0) await Move.create({ product: p._id, productName: p.name, type: 'purchase', qty, unitCost: cost, unitPrice: p.sellPerUnit, note: 'Opening stock' });
  r.json(p);
}));

app.put('/api/products/:id', upload.single('image'), wrap(async (q, r) => {
  const p = await Product.findById(q.params.id); if (!p) throw err('Not found', 404);
  const b = q.body;
  ['name', 'category', 'material', 'description'].forEach(k => { if (b[k] !== undefined) p[k] = b[k]; });
  p.sku = b.sku || undefined;
  if (b.costPerUnit !== undefined) p.costPerUnit = num(b.costPerUnit);
  if (b.sellPerUnit !== undefined) p.sellPerUnit = num(b.sellPerUnit);
  if (b.lowStockAt !== undefined) p.lowStockAt = num(b.lowStockAt);
  if (q.file) { if (p.image?.publicId) cloudinary.uploader.destroy(p.image.publicId).catch(() => {}); p.image = await toCloud(q.file.buffer); }
  await p.save(); r.json(p);
}));

app.delete('/api/products/:id', wrap(async (q, r) => {
  const p = await Product.findByIdAndDelete(q.params.id);
  if (p?.image?.publicId) cloudinary.uploader.destroy(p.image.publicId).catch(() => {});
  r.json({ ok: true });
}));

const restock = async (p, qty, unitCost, note, date, sell) => {
  const total = p.quantity + qty;
  p.costPerUnit = total ? (p.quantity * p.costPerUnit + qty * unitCost) / total : unitCost; // weighted average
  p.quantity = total; p.totalBoughtQty += qty; p.totalBoughtCost += qty * unitCost;
  if (sell) p.sellPerUnit = sell;
  await p.save();
  await Move.create({ product: p._id, productName: p.name, type: 'purchase', qty, unitCost, unitPrice: p.sellPerUnit, note, date: date || new Date() });
};
app.post('/api/products/:id/restock', wrap(async (q, r) => {
  const p = await Product.findById(q.params.id); if (!p) throw err('Not found', 404);
  const qty = num(q.body.qty); if (qty <= 0) throw err('Quantity must be above 0');
  await restock(p, qty, num(q.body.unitCost), q.body.note || 'Restock', q.body.date, num(q.body.sellPerUnit));
  r.json(p);
}));

// Manual stock deduction (damage, loss, gift, return to supplier...)
app.post('/api/products/:id/adjust', wrap(async (q, r) => {
  const n = num(q.body.qty); if (n <= 0) throw err('Quantity must be above 0');
  const p = await Product.findOneAndUpdate({ _id: q.params.id, quantity: { $gte: n } }, { $inc: { quantity: -n } }, { new: true });
  if (!p) throw err('Not enough stock');
  await Move.create({ product: p._id, productName: p.name, type: 'adjustment', qty: -n, unitCost: p.costPerUnit, reason: q.body.reason, note: q.body.note });
  r.json(p);
}));

// ---------- Sales ----------
app.get('/api/sales', wrap(async (q, r) => r.json(await Sale.find().sort('-date'))));

app.post('/api/sales', wrap(async (q, r) => {
  const b = q.body; if (!b.items?.length) throw err('Add at least one item');
  const items = [];
  for (const it of b.items) {
    const p = await Product.findById(it.product), n = num(it.qty);
    if (!p || n <= 0) throw err('Invalid item');
    items.push({ product: p._id, name: p.name, category: p.category, qty: n, costPrice: p.costPerUnit,
      sellPrice: it.sellPrice !== undefined && it.sellPrice !== '' ? num(it.sellPrice) : p.sellPerUnit });
  }
  const done = [];
  try {
    for (const i of items) {
      const x = await Product.updateOne({ _id: i.product, quantity: { $gte: i.qty } }, { $inc: { quantity: -i.qty } });
      if (!x.modifiedCount) throw err(`Not enough stock for ${i.name}`);
      done.push(i);
    }
  } catch (e) { for (const i of done) await Product.updateOne({ _id: i.product }, { $inc: { quantity: i.qty } }); throw e; }
  const subtotal = items.reduce((a, i) => a + i.sellPrice * i.qty, 0), discount = num(b.discount), total = Math.max(0, subtotal - discount);
  const s = await Sale.create({ invoiceNo: `INV-${String((await Sale.countDocuments()) + 1).padStart(4, '0')}`,
    customer: b.customer, items, subtotal, discount, total, paymentMethod: b.paymentMethod || 'Cash',
    amountPaid: b.amountPaid === undefined || b.amountPaid === '' ? total : num(b.amountPaid), note: b.note, date: b.date || new Date() });
  await Move.insertMany(items.map(i => ({ product: i.product, productName: i.name, type: 'sale', qty: -i.qty, unitCost: i.costPrice,
    unitPrice: i.sellPrice, ref: s._id, note: `${s.invoiceNo}${b.customer?.name ? ' - ' + b.customer.name : ''}`, date: s.date })));
  r.json(s);
}));

app.patch('/api/sales/:id/payment', wrap(async (q, r) => {
  const s = await Sale.findByIdAndUpdate(q.params.id, { amountPaid: num(q.body.amountPaid) }, { new: true }); r.json(s);
}));

app.post('/api/sales/:id/cancel', wrap(async (q, r) => {
  const s = await Sale.findById(q.params.id); if (!s || s.status === 'cancelled') throw err('Sale not found or already cancelled');
  for (const i of s.items) {
    await Product.updateOne({ _id: i.product }, { $inc: { quantity: i.qty } });
    await Move.create({ product: i.product, productName: i.name, type: 'sale_cancel', qty: i.qty, unitCost: i.costPrice, unitPrice: i.sellPrice, ref: s._id, note: `${s.invoiceNo} cancelled` });
  }
  s.status = 'cancelled'; await s.save(); r.json(s);
}));

// ---------- Expenses ----------
app.get('/api/expenses', wrap(async (q, r) => r.json(await Expense.find().sort('-date'))));
app.post('/api/expenses', wrap(async (q, r) => r.json(await Expense.create({ ...q.body, amount: num(q.body.amount) }))));
app.put('/api/expenses/:id', wrap(async (q, r) => r.json(await Expense.findByIdAndUpdate(q.params.id, { ...q.body, amount: num(q.body.amount) }, { new: true }))));
app.delete('/api/expenses/:id', wrap(async (q, r) => { await Expense.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));

// ---------- Stock history ----------
app.get('/api/movements', wrap(async (q, r) => {
  const f = {}; if (q.query.type) f.type = q.query.type; if (q.query.product) f.product = q.query.product;
  r.json(await Move.find(f).sort('-date -createdAt').limit(1000));
}));

// ---------- Analytics ----------
app.get('/api/analytics', wrap(async (req, res) => {
  const range = () => { const d = {}; if (req.query.from) d.$gte = new Date(req.query.from); if (req.query.to) d.$lte = new Date(req.query.to); return Object.keys(d).length ? { date: d } : {}; };
  const [products, sales, expenses, buys] = await Promise.all([Product.find(), Sale.find({ status: 'completed', ...range() }), Expense.find(range()), Move.find({ type: 'purchase', ...range() })]);
  const mk = d => new Date(d).toISOString().slice(0, 7), month = {};
  const m = k => (month[k] ??= { month: k, revenue: 0, profit: 0, expenses: 0, bought: 0 });
  const top = {}, cat = {}, pay = {}, expCat = {};
  let revenue = 0, cogs = 0, discount = 0, units = 0, received = 0;
  for (const s of sales) {
    const c = s.items.reduce((a, i) => a + i.costPrice * i.qty, 0);
    revenue += s.total; cogs += c; discount += s.discount; received += s.amountPaid;
    pay[s.paymentMethod] = (pay[s.paymentMethod] || 0) + s.total;
    m(mk(s.date)).revenue += s.total; m(mk(s.date)).profit += s.total - c;
    for (const i of s.items) {
      units += i.qty;
      const t = (top[i.name] ??= { name: i.name, qty: 0, revenue: 0, profit: 0 });
      t.qty += i.qty; t.revenue += i.sellPrice * i.qty; t.profit += (i.sellPrice - i.costPrice) * i.qty;
      cat[i.category || 'Other'] = (cat[i.category || 'Other'] || 0) + i.sellPrice * i.qty;
    }
  }
  let totalExpenses = 0; for (const e of expenses) { totalExpenses += e.amount; m(mk(e.date)).expenses += e.amount; expCat[e.category || 'Other'] = (expCat[e.category || 'Other'] || 0) + e.amount; }
  let bought = 0, boughtUnits = 0; for (const b of buys) { bought += b.qty * b.unitCost; boughtUnits += b.qty; m(mk(b.date)).bought += b.qty * b.unitCost; }
  const arr = o => Object.entries(o).map(([name, value]) => ({ name, value }));
  res.json({
    revenue, cogs, discount, units, grossProfit: revenue - cogs, expenses: totalExpenses, netProfit: revenue - cogs - totalExpenses,
    bought, boughtUnits, dues: revenue - received, salesCount: sales.length,
    stock: { units: products.reduce((a, p) => a + p.quantity, 0), costValue: products.reduce((a, p) => a + p.quantity * p.costPerUnit, 0), sellValue: products.reduce((a, p) => a + p.quantity * p.sellPerUnit, 0) },
    monthly: Object.values(month).sort((a, b) => a.month.localeCompare(b.month)),
    topProducts: Object.values(top).sort((a, b) => b.profit - a.profit).slice(0, 8),
    byCategory: arr(cat), byPayment: arr(pay), expenseByCategory: arr(expCat),
    lowStock: products.filter(p => p.quantity <= p.lowStockAt).map(p => ({ _id: p._id, name: p.name, quantity: p.quantity, lowStockAt: p.lowStockAt })),
  });
}));

// ---------- Excel export / import ----------
const sendXlsx = (res, name, rows) => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sheet1');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};
const d = x => new Date(x).toLocaleDateString('en-IN');
app.get('/api/export/products', wrap(async (q, r) => sendXlsx(r, 'products', (await Product.find()).map(p => ({
  Name: p.name, SKU: p.sku || '', Category: p.category || '', Material: p.material || '', Quantity: p.quantity,
  'Buying Price (Each)': p.costPerUnit, 'Buying Total': p.quantity * p.costPerUnit,
  'Selling Price (Each)': p.sellPerUnit, 'Selling Total': p.quantity * p.sellPerUnit,
  'Expected Profit': p.quantity * (p.sellPerUnit - p.costPerUnit), 'Low Stock Alert': p.lowStockAt, Description: p.description || '' })))));
app.get('/api/export/sales', wrap(async (q, r) => sendXlsx(r, 'sales', (await Sale.find().sort('-date')).flatMap(s => s.items.map(i => ({
  Invoice: s.invoiceNo, Date: d(s.date), Customer: s.customer?.name || '', Phone: s.customer?.phone || '', Product: i.name, Quantity: i.qty,
  'Buying Price (Each)': i.costPrice, 'Selling Price (Each)': i.sellPrice, 'Line Total': i.sellPrice * i.qty, 'Line Profit': (i.sellPrice - i.costPrice) * i.qty,
  'Bill Discount': s.discount, 'Bill Total': s.total, 'Payment Method': s.paymentMethod, 'Amount Paid': s.amountPaid, Status: s.status }))))));
app.get('/api/export/expenses', wrap(async (q, r) => sendXlsx(r, 'expenses', (await Expense.find().sort('-date')).map(e => ({
  Date: d(e.date), Title: e.title, Category: e.category || '', Amount: e.amount, 'Payment Method': e.paymentMethod || '', Note: e.note || '' })))));
app.get('/api/export/movements', wrap(async (q, r) => sendXlsx(r, 'stock-history', (await Move.find().sort('-date')).map(m => ({
  Date: d(m.date), Product: m.productName, Type: m.type, Quantity: m.qty, 'Unit Cost': m.unitCost, 'Unit Price': m.unitPrice, Reason: m.reason || '', Note: m.note || '' })))));
app.get('/api/export/template', (q, r) => sendXlsx(r, 'import-template', [{ Name: 'Dragonfly Pendant', SKU: 'PND-001', Category: 'Pendant', Material: 'Silver',
  Quantity: 10, 'Buying Price (Each)': 100, 'Selling Price (Each)': 180, 'Low Stock Alert': 2, 'Add Quantity': '', Description: 'Use Quantity for NEW products, Add Quantity to restock existing ones' }]));

app.post('/api/import/products', upload.single('file'), wrap(async (q, r) => {
  if (!q.file) throw err('Choose an Excel file');
  const rows = XLSX.utils.sheet_to_json(XLSX.read(q.file.buffer).Sheets[XLSX.read(q.file.buffer).SheetNames[0]]);
  let created = 0, updated = 0, skipped = 0;
  for (const x of rows) {
    const name = String(x.Name || '').trim(); if (!name) { skipped++; continue; }
    const sku = String(x.SKU || '').trim();
    let p = await Product.findOne(sku ? { sku } : { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    const cost = num(x['Buying Price (Each)']), sell = num(x['Selling Price (Each)']);
    if (p) {
      ['Category', 'Material', 'Description'].forEach(k => { if (x[k]) p[k.toLowerCase()] = x[k]; });
      if (cost) p.costPerUnit = cost; if (sell) p.sellPerUnit = sell; if (x['Low Stock Alert']) p.lowStockAt = num(x['Low Stock Alert']);
      const add = num(x['Add Quantity']);
      if (add > 0) await restock(p, add, cost || p.costPerUnit, 'Excel import restock'); else await p.save();
      updated++;
    } else {
      const qty = num(x.Quantity);
      p = await Product.create({ name, sku: sku || undefined, category: x.Category, material: x.Material, description: x.Description, quantity: qty,
        costPerUnit: cost, sellPerUnit: sell, lowStockAt: num(x['Low Stock Alert']) || 2, totalBoughtQty: qty, totalBoughtCost: qty * cost });
      if (qty > 0) await Move.create({ product: p._id, productName: name, type: 'purchase', qty, unitCost: cost, unitPrice: sell, note: 'Excel import' });
      created++;
    }
  }
  r.json({ created, updated, skipped });
}));

mongoose.connect(process.env.MONGO_URI).then(() => app.listen(process.env.PORT || 5000, () => console.log('API running'))).catch(e => { console.error(e); process.exit(1); });
