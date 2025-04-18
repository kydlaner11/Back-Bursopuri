const router = require('express').Router();
const { getMenus, getMenuById, createMenu, updateMenu, deleteMenu} = require('../controllers/menuController');
const upload = require('../middleware/multer');


router.get('/menus', getMenus);
router.post('/menus', upload.single("image"), createMenu);
router.get('/menus/:id', getMenuById);
router.put('/menus/:id', upload.single("image"), updateMenu);
router.delete('/menus/:id', deleteMenu);

module.exports = router;