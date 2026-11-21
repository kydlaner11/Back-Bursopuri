const svc = require('../services/obligationService');
const { getDashboard } = require('../services/dashboardService');
const { schemas, validate } = require('../validations/financeValidation');
const { wrap } = require('../../utils/financeUtils');

const getObligations = wrap(async (req, res) => {
  const q = validate(schemas.obligationQuery, req.query);
  res.json({ ok: true, data: await svc.listObligations(q) });
});

const createObligation = wrap(async (req, res) => {
  const input = validate(schemas.createObligation, req.body);
  res.status(201).json({ ok: true, data: await svc.createObligation(input, req.user.id) });
});

const updateObligation = wrap(async (req, res) => {
  const { id } = validate(schemas.idParam, req.params);
  const input = validate(schemas.updateObligation, req.body);
  res.json({ ok: true, data: await svc.updateObligation(id, input, req.user.id) });
});

const dashboard = wrap(async (req, res) => {
  const q = validate(schemas.dashboardQuery, req.query);
  res.json({ ok: true, data: await getDashboard(q) });
});

module.exports = { getObligations, createObligation, updateObligation, dashboard };