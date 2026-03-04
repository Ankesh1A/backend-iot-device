const express = require('express');
const router = express.Router();
const {
    getDevices, getDevice, createDevice, updateDevice,
    deleteDevice, toggleStatus, powerOff, powerOn, getDashboardStats
} = require('../controllers/deviceController');
const { protect } = require('../middleware/auth');

// 🔒 Saare device routes protected hain
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
router.post('/:id/power-on', powerOn);

module.exports = router;