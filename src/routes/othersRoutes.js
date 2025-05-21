const router = require('express').Router();
const {getOrders,getOrderHistory, getOrderProgress, getOrderStatusById, updateOrderStatus, getOrderHistorybySession, createOrder, getOnboarding, createOnboarding, getCarousel, createCarousel, getMenus, deleteCarousel } = require('../controllers/othersController');
const { getCategories } = require('../controllers/menuController');
const upload = require('../middleware/multer');


router.get('/onboarding', getOnboarding);
router.post('/onboarding', upload.single("image"), createOnboarding);
router.get('/carousel', getCarousel);
router.post('/carousel', upload.single("image"), createCarousel);
router.delete('/carousel/:id', deleteCarousel);
router.get('/categories', getCategories);
router.get('/menus', getMenus);
router.post('/order', createOrder); 
router.get('/order', getOrders); 
router.get('/order-history', getOrderHistory);
router.get('/order-progress', getOrderProgress);
router.put('/order-status/:id', updateOrderStatus); 
router.get('/order/:id/status', getOrderStatusById);
router.get('/order-history/:sessionId', getOrderHistorybySession);

module.exports = router;
