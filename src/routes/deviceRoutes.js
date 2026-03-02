const express = require('express');
const router = express.Router();
const {
    getDevices, getDevice, createDevice, updateDevice,
    deleteDevice, toggleStatus, powerOff, getDashboardStats
} = require('../controllers/deviceController');
const { protect } = require('../middleware/auth');

// All device routes are protected
router.use(protect);

router.get('/stats/overview', getDashboardStats);
router.route('/')
    .get(getDevices)
    .post(createDevice);

router.route('/:id')
    .get(getDevice)
    .put(updateDevice)
    .delete(deleteDevice);

router.patch('/:id/status', toggleStatus);
router.post('/:id/power-off', powerOff);

module.exports = router;
