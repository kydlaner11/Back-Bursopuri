const router = require('express').Router();
const { postLogin, postRegister, verifyToken, checkRole } = require('../controllers/authController');

router.route('/register').post(postRegister);
router.route('/login').post(postLogin);
router.route('/verify-token').get(verifyToken);
router.route('/check-role').get(verifyToken, checkRole); // Middleware to check role


module.exports = router;