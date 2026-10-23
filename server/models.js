const { Schema, model, Types } = require('mongoose');
const T = { timestamps: true };

const User = model('User', new Schema({
  name: String, email: { type: String, unique: true, lowercase: true }, password: String }, T));

const Product = model('Product', new Schema({
  name: { type: String, required: true }, sku: { type: String, unique: true, sparse: true },
  category: String, material: String, description: String,
  image: { url: String, publicId: String },
  quantity: { type: Number, default: 0 },
  costPerUnit: { type: Number, default: 0 },   // buying price of ONE piece (weighted average after restocks)
  sellPerUnit: { type: Number, default: 0 },   // selling price of ONE piece
  lowStockAt: { type: Number, default: 2 },
  totalBoughtQty: { type: Number, default: 0 }, totalBoughtCost: { type: Number, default: 0 },
}, T));

// Every stock change is logged here: purchase | sale | sale_cancel | adjustment
const Move = model('Move', new Schema({
  product: { type: Types.ObjectId, ref: 'Product' }, productName: String,
  type: String, qty: Number, unitCost: Number, unitPrice: Number,
  reason: String, note: String, ref: String, date: { type: Date, default: Date.now },
}, T));

const Sale = model('Sale', new Schema({
  invoiceNo: String, customer: { name: String, phone: String },
  items: [{ product: Types.ObjectId, name: String, category: String, qty: Number, costPrice: Number, sellPrice: Number }],
  subtotal: Number, discount: { type: Number, default: 0 }, total: Number,
  paymentMethod: { type: String, default: 'Cash' }, amountPaid: { type: Number, default: 0 },
  status: { type: String, default: 'completed' }, note: String, date: { type: Date, default: Date.now },
}, T));

const Expense = model('Expense', new Schema({
  title: String, category: String, amount: Number, paymentMethod: String, note: String,
  date: { type: Date, default: Date.now },
}, T));

module.exports = { User, Product, Move, Sale, Expense };
