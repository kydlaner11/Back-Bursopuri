const router = require('express').Router();
const { ro } = require('date-fns/locale');
const { getMenus, getMenuById, createMenu, updateMenu, deleteMenu, getCategories, getCategoryById, createCategory, updateCategory, deleteCategory, stockMenu, restockMenu, reduceStockMenu  } = require('../controllers/menuController');
const { createMenuOption, getMenuOptions, editMenuOption, getOptionsById, deleteMenuOption } = require('../controllers/optionsController');
const upload = require('../middleware/multer');

router.get('/menus', getMenus);
router.post('/menus', upload.single("image"), createMenu);
router.get('/menus/:id', getMenuById);
router.put('/menus/:id', upload.single("image"), updateMenu);
router.delete('/menus/:id', deleteMenu);
router.put('/menus/:id/stock', stockMenu);
router.put('/menus/:id/restock', restockMenu);
router.put('/menus/:id/reduce-stock', reduceStockMenu);
router.get('/categories', getCategories);
router.post('/categories', upload.single("image"), createCategory);
router.get('/categories/:id', getCategoryById);
router.put('/categories/:id', upload.single("image"), updateCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/menu-option', createMenuOption);
router.get('/menu-option', getMenuOptions);
router.put('/menu-option/:id', editMenuOption);
router.get('/menu-option/:id', getOptionsById);
router.delete('/menu-option/:id', deleteMenuOption);

module.exports = router;