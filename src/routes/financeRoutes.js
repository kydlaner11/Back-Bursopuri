const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const c = require('../controllers/financeController');
const t = require('../controllers/transactionController');
const o = require('../controllers/obligationController');

// Semua endpoint finance otomatis terlindungi (tidak ada yang terlewat)
router.use(verifyToken, requireRole('admin'));

router.get('/dashboard', o.dashboard);

router.get('/channels', c.getChannels);
router.patch('/channels/:id', c.updateChannel);

router.get('/accounts', c.getAccounts);
router.post('/accounts', c.createAccount);

router.get('/categories', t.getCategories);
router.post('/categories', t.createCategory);

// /sales/summary harus didaftarkan SEBELUM /sales/:id
router.get('/sales/summary', c.getSalesSummary);
router.get('/sales', c.getSales);
router.post('/sales', c.createSale);
router.patch('/sales/:id', c.updateSale);
router.post('/sales/:id/void', c.voidSale);

router.get('/expenses', t.getExpenses);
router.post('/expenses', t.createExpense);
router.get('/incomes', t.getIncomes);
router.post('/incomes', t.createIncome);
router.post('/transactions/:id/void', t.voidTransaction);

router.get('/transfers', t.getTransfers);
router.post('/transfers', t.createTransfer);
router.post('/transfers/:groupId/void', t.voidTransfer);

router.get('/obligations', o.getObligations);
router.post('/obligations', o.createObligation);
router.patch('/obligations/:id', o.updateObligation);

module.exports = router;