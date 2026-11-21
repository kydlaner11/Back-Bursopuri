const tx = require('../services/transactionService');
const { schemas, validate } = require('../validations/financeValidation');
const { wrap } = require('../../utils/financeUtils');

const getCategories = wrap(async (req, res) => {
  const q = validate(schemas.listCategories, req.query);
  res.json({ ok: true, data: await tx.listCategories(q) });
});

const createCategory = wrap(async (req, res) => {
  const input = validate(schemas.createCategory, req.body);
  res.status(201).json({ ok: true, data: await tx.createCategory(input, req.user.id) });
});

const createExpense = wrap(async (req, res) => {
  const input = validate(schemas.createTransaction, req.body);
  const data = await tx.createExpense(input, req.user.id);
  res.status(data.replayed ? 200 : 201).json({ ok: true, data });
});

const getExpenses = wrap(async (req, res) => {
  const q = validate(schemas.listTransactions, req.query);
  res.json({ ok: true, data: await tx.listExpenses(q) });
});

const createIncome = wrap(async (req, res) => {
  const input = validate(schemas.createTransaction, req.body);
  const data = await tx.createIncome(input, req.user.id);
  res.status(data.replayed ? 200 : 201).json({ ok: true, data });
});

const getIncomes = wrap(async (req, res) => {
  const q = validate(schemas.listTransactions, req.query);
  res.json({ ok: true, data: await tx.listIncomes(q) });
});

const voidTransaction = wrap(async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const input = validate(schemas.voidSale, req.body); // skema alasan yang sama
  res.json({ ok: true, data: await tx.voidTransaction(id, input, req.user.id) });
});

const createTransfer = wrap(async (req, res) => {
  const input = validate(schemas.createTransfer, req.body);
  const data = await tx.createTransfer(input, req.user.id);
  res.status(data.replayed ? 200 : 201).json({ ok: true, data });
});

const getTransfers = wrap(async (req, res) => {
  const q = validate(schemas.dateRange, req.query);
  res.json({ ok: true, data: await tx.listTransfers(q) });
});

const voidTransfer = wrap(async (req, res) => {
  const { groupId } = validate(schemas.groupParam, req.params);
  const input = validate(schemas.voidSale, req.body);
  res.json({ ok: true, data: await tx.voidTransfer(groupId, input, req.user.id) });
});

module.exports = {
  getCategories, createCategory,
  createExpense, getExpenses, createIncome, getIncomes, voidTransaction,
  createTransfer, getTransfers, voidTransfer,
};