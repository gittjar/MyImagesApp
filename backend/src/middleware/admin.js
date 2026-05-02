// Allows both superadmin and subadmin
const requireAdmin = (req, res, next) => {
  if (!['admin', 'subadmin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Only superadmin
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Superadmin access required' });
  }
  next();
};

module.exports = { requireAdmin, requireSuperAdmin };
