const router = require('express').Router();
const { postLogin, postRegister } = require('../controllers/authController');

router.route('/register').post(postRegister);
router.route('/login').post(postLogin);


module.exports = router;