const router = require('express').Router();
const {create, verify } = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');

router.post('/register', verifyToken, requireRole('admin'), create);
router.post('/login', verify);
// router.route('/verify-token').get(verifyToken);
// router.route('/check-role').get(verifyToken, checkRole); // Middleware to check role


module.exports = router;