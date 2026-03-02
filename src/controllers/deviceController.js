const Device = require('../models/Device');
const Location = require('../models/Location');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { getTodayStr } = require('../utils/distanceCalculator');

// @desc    Get all devices
// @route   GET /api/devices
// @access  Private
exports.getDevices = async (req, res) => {
    const { status, search, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
        query.$or = [
            { device_name: { $regex: search, $options: 'i' } },
            { vehicle_id: { $regex: search, $options: 'i' } },
            { imei: { $regex: search, $options: 'i' } },
        ];
    }

    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    return sendPaginated(res, devices, total, page, limit, 'Devices fetched');
};

// @desc    Get single device
// @route   GET /api/devices/:id
// @access  Private
exports.getDevice = async (req, res) => {
    const device = await Device.findById(req.params.id);
    if (!device) return sendError(res, 'Device not found', 404);
    return sendSuccess(res, { data: device }, 'Device fetched');
};

// @desc    Create device
// @route   POST /api/devices
// @access  Private
exports.createDevice = async (req, res) => {
    const deviceData = { ...req.body, createdBy: req.user?.id };

    // Auto-generate scatter lat/lng around Bhopal if not provided
    if (!deviceData.lat || !deviceData.lng) {
        const count = await Device.countDocuments();
        deviceData.lat = parseFloat((23.2599 + (count % 5) * 0.025 + (Math.random() - 0.5) * 0.01).toFixed(6));
        deviceData.lng = parseFloat((77.4126 + (count % 5) * 0.025 + (Math.random() - 0.5) * 0.01).toFixed(6));
    }

    const device = await Device.create(deviceData);
    return sendSuccess(res, { data: device }, 'Device registered successfully', 201);
};

// @desc    Update device
// @route   PUT /api/devices/:id
// @access  Private
exports.updateDevice = async (req, res) => {
    let device = await Device.findById(req.params.id);
    if (!device) return sendError(res, 'Device not found', 404);

    // Prevent changing immutable IMEI after creation
    if (req.body.imei && req.body.imei !== device.imei) {
        return sendError(res, 'IMEI cannot be changed after registration', 400);
    }

    device = await Device.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    return sendSuccess(res, { data: device }, 'Device updated');
};

// @desc    Delete device
// @route   DELETE /api/devices/:id
// @access  Private
exports.deleteDevice = async (req, res) => {
    const device = await Device.findById(req.params.id);
    if (!device) return sendError(res, 'Device not found', 404);

    await device.deleteOne();
    // Optionally delete location history too
    await Location.deleteMany({ device: req.params.id });

    return sendSuccess(res, {}, 'Device deleted successfully');
};

// @desc    Toggle device status (Active/Disabled)
// @route   PATCH /api/devices/:id/status
// @access  Private
exports.toggleStatus = async (req, res) => {
    const { status } = req.body;
    const allowed = ['Active', 'Inactive', 'Disabled'];
    if (!allowed.includes(status)) {
        return sendError(res, `Status must be one of: ${allowed.join(', ')}`, 400);
    }

    const device = await Device.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
    );
    if (!device) return sendError(res, 'Device not found', 404);

    return sendSuccess(res, { data: device }, `Device status changed to ${status}`);
};

// @desc    Remote power off command
// @route   POST /api/devices/:id/power-off
// @access  Private
exports.powerOff = async (req, res) => {
    const device = await Device.findById(req.params.id);
    if (!device) return sendError(res, 'Device not found', 404);

    // In real world: send SMS/TCP command to device
    // Here we just mark it as disabled
    device.status = 'Disabled';
    await device.save();

    return sendSuccess(res, { data: device }, 'Remote power off command sent');
};

// @desc    Get dashboard stats
// @route   GET /api/devices/stats/overview
// @access  Private
exports.getDashboardStats = async (req, res) => {
    const total = await Device.countDocuments();
    const active = await Device.countDocuments({ status: 'Active' });
    const inactive = await Device.countDocuments({ status: 'Inactive' });
    const disabled = await Device.countDocuments({ status: 'Disabled' });
    const lowBattery = await Device.countDocuments({ battery: { $lte: 25 } });

    const today = getTodayStr();
    const expiringSoon = await Device.countDocuments({
        plan_validity: {
            $gte: new Date(),
            $lte: new Date(Date.now() + 60 * 86400000)
        }
    });

    return sendSuccess(res, {
        data: { total, active, inactive, disabled, lowBattery, expiringSoon }
    }, 'Stats fetched');
};
