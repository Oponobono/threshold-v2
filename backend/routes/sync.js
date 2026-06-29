const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

router.get('/sync/initial', syncController.initialSync);
router.get('/sync', syncController.deltaSync);

module.exports = router;
