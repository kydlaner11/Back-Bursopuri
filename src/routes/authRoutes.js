const router = require('express').Router();
const {create, verify, changePassword } = require('../controllers/authController');

router.route('/register').post(create);
router.route('/login').post(verify);
// router.route('/verify-token').get(verifyToken);
// router.route('/check-role').get(verifyToken, checkRole); // Middleware to check role


module.exports = router;