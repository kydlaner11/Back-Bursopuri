const service = require('../services/financeService');
const { schemas, validate } = require('../validations/financeValidation');

// Controller tipis: validasi -> service -> response.
// createdById selalu dari req.user.id (token), TIDAK pernah dari body.
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const getChannels = wrap(async (req, res) => {
  res.json({ ok: true, data: await service.listChannels() });
});

const updateChannel = wrap(async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const input = validate(schemas.updateChannel, req.body);
  res.json({ ok: true, data: await service.updateChannel(id, input, req.user.id) });
});

const getAccounts = wrap(async (req, res) => {
  res.json({ ok: true, data: await service.listAccounts() });
});

const createAccount = wrap(async (req, res) => {
  const input = validate(schemas.createAccount, req.body);
  res.status(201).json({ ok: true, data: await service.createAccount(input, req.user.id) });
});

const createSale = wrap(async (req, res) => {
  const input = validate(schemas.createSale, req.body);
  const data = await service.createSale(input, req.user.id);
  res.status(201).json({ ok: true, message: 'Rekap penjualan tersimpan', data });
});

const getSales = wrap(async (req, res) => {
  const range = validate(schemas.dateRange, req.query);
  res.json({ ok: true, data: await service.listSales(range) });
});

const getSalesSummary = wrap(async (req, res) => {
  const range = validate(schemas.dateRange, req.query);
  res.json({ ok: true, data: await service.salesSummary(range) });
});

const updateSale = wrap(async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const input = validate(schemas.updateSale, req.body);
  res.json({ ok: true, data: await service.updateSale(id, input, req.user.id) });
});

const voidSale = wrap(async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const input = validate(schemas.voidSale, req.body);
  res.json({ ok: true, data: await service.voidSale(id, input, req.user.id) });
});

module.exports = {
  getChannels, updateChannel,
  getAccounts, createAccount,
  createSale, getSales, getSalesSummary, updateSale, voidSale,
};