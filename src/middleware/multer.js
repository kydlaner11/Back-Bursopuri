const multer = require('multer');
const fileSizeLimit = 1024 * 1024 * 10
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ 
  storage: storage, // Use memory storage
  limits: fileSizeLimit
});

module.exports = upload
