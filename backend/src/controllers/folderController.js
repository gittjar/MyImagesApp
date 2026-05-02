const Folder = require('../models/Folder');
const Image = require('../models/Image');

const getFolders = async (req, res) => {
  try {
    const folders = await Folder.find({ user: req.user._id }).sort({ name: 1 });
    const ids = folders.map((f) => f._id);
    const counts = await Image.aggregate([
      { $match: { user: req.user._id, folder: { $in: ids } } },
      { $group: { _id: '$folder', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    const result = folders.map((f) => ({ ...f.toObject(), count: countMap[f._id.toString()] || 0 }));
    res.json({ folders: result });
  } catch (err) {
    console.error('getFolders error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Folder name is required' });
    const folder = await Folder.create({ user: req.user._id, name: name.trim() });
    res.status(201).json({ folder: { ...folder.toObject(), count: 0 } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A folder with that name already exists' });
    console.error('createFolder error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const renameFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Folder name is required' });
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { name: name.trim() },
      { new: true }
    );
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json({ folder });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A folder with that name already exists' });
    console.error('renameFolder error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, user: req.user._id });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    // Move images back to root rather than deleting them
    await Image.updateMany({ user: req.user._id, folder: folder._id }, { $set: { folder: null } });
    await folder.deleteOne();
    res.json({ message: 'Folder deleted, images moved to root' });
  } catch (err) {
    console.error('deleteFolder error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFolders, createFolder, renameFolder, deleteFolder };
