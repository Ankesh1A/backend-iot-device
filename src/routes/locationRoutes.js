const express = require('express');
const router = express.Router();
const {
    pushLocation,
    getCurrentLocation,
    getHistory,
    getHistoryWithStats,
    getAllLive,
    calculateDistance,
    calculateRouteDistance,
} = require('../controllers/locationController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Utility distance endpoints (no device ID needed)
router.post('/distance/calculate', calculateDistance);
router.post('/distance/route', calculateRouteDistance);

// All live locations
router.get('/live', getAllLive);

// Device-specific
router.post('/:deviceId/push', pushLocation);
router.get('/:deviceId/current', getCurrentLocation);
router.get('/:deviceId/history', getHistory);
router.get('/:deviceId/history/stats', getHistoryWithStats);

module.exports = router;
