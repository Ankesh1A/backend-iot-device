const Location = require('../models/Location');
const Device = require('../models/Device');
const { sendSuccess, sendError, sendPaginated } = require('../utils/apiResponse');
const { haversineDistance, calculateTripStats, getTodayStr } = require('../utils/distanceCalculator');

// @desc    Push new location for a device (called by GPS hardware / simulator)
// @route   POST /api/locations/:deviceId/push
// @access  Private
exports.pushLocation = async (req, res) => {
    const { lat, lng, speed = 0, battery, signal, address = '' } = req.body;

    if (!lat || !lng) return sendError(res, 'lat and lng are required', 400);

    const device = await Device.findOne({
        $or: [
            { _id: req.params.deviceId.match(/^[0-9a-fA-F]{24}$/) ? req.params.deviceId : null },
            { device_id: req.params.deviceId },
            { imei: req.params.deviceId },
        ].filter(Boolean)
    });

    if (!device) return sendError(res, 'Device not found', 404);

    // Calculate distance from last known position
    let distanceFromPrev = 0;
    if (device.lat && device.lng) {
        distanceFromPrev = haversineDistance(device.lat, device.lng, lat, lng);
    }

    // Create location entry
    const location = await Location.create({
        device: device._id,
        device_id: device.device_id,
        lat, lng, speed,
        address,
        distance_from_prev: distanceFromPrev,
        battery: battery ?? device.battery,
        signal: signal || device.signal,
        time: new Date(),
    });

    // Update device current position
    const today = getTodayStr();
    const updateData = {
        lat, lng, speed, address,
        last_seen: new Date(),
        $inc: { total_distance: distanceFromPrev },
    };
    if (battery !== undefined) updateData.battery = battery;
    if (signal) updateData.signal = signal;

    // Reset distance_today if date changed
    if (device.distance_today_date !== today) {
        updateData.distance_today = distanceFromPrev;
        updateData.distance_today_date = today;
    } else {
        updateData.$inc.distance_today = distanceFromPrev;
    }

    // Update status based on speed
    if (speed > 2) updateData.status = 'Active';

    await Device.findByIdAndUpdate(device._id, updateData);

    return sendSuccess(res, { data: location }, 'Location recorded', 201);
};

// @desc    Get current/latest location of a device
// @route   GET /api/locations/:deviceId/current
// @access  Private
exports.getCurrentLocation = async (req, res) => {
    const device = await Device.findById(req.params.deviceId);
    if (!device) return sendError(res, 'Device not found', 404);

    const latest = await Location.findOne({ device: req.params.deviceId })
        .sort({ time: -1 });

    return sendSuccess(res, {
        data: {
            device_id: device.device_id,
            device_name: device.device_name,
            lat: device.lat,
            lng: device.lng,
            speed: device.speed,
            address: device.address,
            last_seen: device.last_seen,
            battery: device.battery,
            signal: device.signal,
            latest_log: latest,
        }
    }, 'Current location fetched');
};

// @desc    Get location history for a device
// @route   GET /api/locations/:deviceId/history
// @access  Private
exports.getHistory = async (req, res) => {
    const { from, to, limit = 500, page = 1 } = req.query;

    const filter = { device: req.params.deviceId };

    if (from || to) {
        filter.time = {};
        if (from) filter.time.$gte = new Date(from + 'T00:00:00');
        if (to) filter.time.$lte = new Date(to + 'T23:59:59');
    }

    const total = await Location.countDocuments(filter);
    const history = await Location.find(filter)
        .sort({ time: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    // Calculate trip stats using Haversine
    const stats = calculateTripStats(history);

    return sendPaginated(res, history, total, page, limit, 'History fetched');
};

// @desc    Get location history WITH distance stats
// @route   GET /api/locations/:deviceId/history/stats
// @access  Private
exports.getHistoryWithStats = async (req, res) => {
    const { from, to } = req.query;

    const filter = { device: req.params.deviceId };
    if (from || to) {
        filter.time = {};
        if (from) filter.time.$gte = new Date(from + 'T00:00:00');
        if (to) filter.time.$lte = new Date(to + 'T23:59:59');
    }

    const history = await Location.find(filter).sort({ time: 1 }).limit(1000);

    if (history.length === 0) {
        return sendSuccess(res, {
            data: [],
            stats: { distance: 0, duration: 0, maxSpeed: 0, avgSpeed: 0, pointCount: 0 }
        }, 'No history found for this period');
    }

    // Distance calculated server-side via Haversine
    const stats = calculateTripStats(history);

    return sendSuccess(res, {
        data: history,
        stats: { ...stats, pointCount: history.length }
    }, 'History with stats fetched');
};

// @desc    Get all devices live locations
// @route   GET /api/locations/live
// @access  Private
exports.getAllLive = async (req, res) => {
    const devices = await Device.find({ status: { $ne: 'Disabled' } })
        .select('device_id device_name vehicle_id lat lng speed status battery signal last_seen address distance_today');

    return sendSuccess(res, { data: devices, count: devices.length }, 'Live locations fetched');
};

// @desc    Calculate distance between two points (utility endpoint)
// @route   POST /api/locations/distance/calculate
// @access  Private
exports.calculateDistance = async (req, res) => {
    const { lat1, lng1, lat2, lng2 } = req.body;

    if (!lat1 || !lng1 || !lat2 || !lng2) {
        return sendError(res, 'lat1, lng1, lat2, lng2 are all required', 400);
    }

    const distance = haversineDistance(
        parseFloat(lat1), parseFloat(lng1),
        parseFloat(lat2), parseFloat(lng2)
    );

    return sendSuccess(res, {
        data: {
            from: { lat: parseFloat(lat1), lng: parseFloat(lng1) },
            to: { lat: parseFloat(lat2), lng: parseFloat(lng2) },
            distance_km: distance,
            distance_m: parseFloat((distance * 1000).toFixed(1)),
        }
    }, 'Distance calculated');
};

// @desc    Calculate distance for an array of waypoints
// @route   POST /api/locations/distance/route
// @access  Private
exports.calculateRouteDistance = async (req, res) => {
    const { waypoints } = req.body; // Array of { lat, lng }

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
        return sendError(res, 'waypoints must be an array with at least 2 points', 400);
    }

    let totalDistance = 0;
    const segments = [];

    for (let i = 1; i < waypoints.length; i++) {
        const segDist = haversineDistance(
            waypoints[i - 1].lat, waypoints[i - 1].lng,
            waypoints[i].lat, waypoints[i].lng
        );
        totalDistance += segDist;
        segments.push({
            from: waypoints[i - 1],
            to: waypoints[i],
            distance_km: segDist,
        });
    }

    return sendSuccess(res, {
        data: {
            waypoints,
            segments,
            total_distance_km: parseFloat(totalDistance.toFixed(2)),
            total_distance_m: parseFloat((totalDistance * 1000).toFixed(1)),
            waypoint_count: waypoints.length,
        }
    }, 'Route distance calculated');
};
