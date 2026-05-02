const User = require('../models/User');
const Image = require('../models/Image');

const MAX_SUBADMINS = 5;

const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments()
    ]);

    const userIds = users.map((u) => u._id);
    const imageCounts = await Image.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(imageCounts.map((r) => [r._id.toString(), r.count]));

    const result = users.map((u) => ({
      ...u.toObject(),
      imageCount: countMap[u._id.toString()] || 0
    }));

    const subadminCount = await User.countDocuments({ role: 'subadmin' });

    res.json({ users: result, total, page, pages: Math.ceil(total / limit), subadminCount });
  } catch (err) {
    console.error('Admin getUsers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const requesterRole = req.user.role;
    const { storageQuota, isActive, role } = req.body;
    const targetId = req.params.id;

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    // Subadmins can only change quota and isActive on regular users
    if (requesterRole === 'subadmin') {
      if (role !== undefined) {
        return res.status(403).json({ message: 'Subadmins cannot change roles' });
      }
      if (['admin', 'subadmin'].includes(target.role)) {
        return res.status(403).json({ message: 'Cannot modify admin or subadmin accounts' });
      }
    }

    const updates = {};

    if (storageQuota !== undefined) {
      const bytes = parseInt(storageQuota, 10);
      if (isNaN(bytes) || bytes < 0) return res.status(400).json({ message: 'Invalid quota value' });
      updates.storageQuota = bytes;
    }

    if (isActive !== undefined) updates.isActive = isActive;

    // Only superadmin can change roles
    if (role !== undefined && requesterRole === 'admin') {
      if (!['user', 'subadmin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Use "user" or "subadmin"' });
      }
      if (targetId === req.user._id.toString()) {
        return res.status(400).json({ message: 'Cannot change your own role' });
      }
      if (target.role === 'admin') {
        return res.status(403).json({ message: 'Superadmin role can only be changed via MongoDB' });
      }
      if (role === 'subadmin') {
        const count = await User.countDocuments({ role: 'subadmin' });
        if (count >= MAX_SUBADMINS) {
          return res.status(400).json({ message: `Maximum ${MAX_SUBADMINS} subadmins allowed` });
        }
      }
      updates.role = role;
    }

    const user = await User.findByIdAndUpdate(targetId, updates, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    console.error('Admin updateUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only superadmin can delete users' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (target.role === 'admin') {
      return res.status(403).json({ message: 'Superadmin accounts can only be removed via MongoDB' });
    }

    await User.findByIdAndDelete(targetId);
    await Image.deleteMany({ user: targetId });

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Admin deleteUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getStats = async (req, res) => {
  try {
    const [totalUsers, totalImages, storageAgg, subadminCount] = await Promise.all([
      User.countDocuments(),
      Image.countDocuments(),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$storageUsed' } } }]),
      User.countDocuments({ role: 'subadmin' })
    ]);

    res.json({
      totalUsers,
      totalImages,
      totalStorageUsed: storageAgg[0]?.total || 0,
      subadminCount,
      maxSubadmins: MAX_SUBADMINS
    });
  } catch (err) {
    console.error('Admin getStats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getUsers, updateUser, deleteUser, getStats };
