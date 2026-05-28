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
    const { name, parentId } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Folder name is required' });

    let parentObjId = null;
    if (parentId) {
      const parent = await Folder.findOne({ _id: parentId, user: req.user._id });
      if (!parent) return res.status(404).json({ message: 'Parent folder not found' });
      parentObjId = parent._id;
    }

    // Manual uniqueness check (name unique within same parent)
    const existing = await Folder.findOne({ user: req.user._id, parent: parentObjId, name: name.trim() });
    if (existing) return res.status(409).json({ message: 'A folder with that name already exists here' });

    const folder = await Folder.create({ user: req.user._id, name: name.trim(), parent: parentObjId });
    res.status(201).json({ folder: { ...folder.toObject(), count: 0 } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'A folder with that name already exists here' });
    console.error('createFolder error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const renameFolder = async (req, res) => {
  try {
    const { name, description } = req.body;
    const update = {};
    if (name !== undefined) {
      if (!name?.trim()) return res.status(400).json({ message: 'Folder name is required' });
      update.name = name.trim();
    }
    if (description !== undefined) {
      update.description = description.trim();
    }
    if (!Object.keys(update).length) return res.status(400).json({ message: 'Nothing to update' });
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
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

    // Collect all descendant folder IDs (BFS)
    const allIds = [folder._id];
    const queue = [folder._id];
    while (queue.length) {
      const id = queue.shift();
      const children = await Folder.find({ user: req.user._id, parent: id }, '_id');
      children.forEach((c) => { allIds.push(c._id); queue.push(c._id); });
    }

    // Move all images from deleted folders to root
    await Image.updateMany({ user: req.user._id, folder: { $in: allIds } }, { $set: { folder: null } });
    await Folder.deleteMany({ _id: { $in: allIds } });
    res.json({ message: 'Folder and subfolders deleted, images moved to root' });
  } catch (err) {
    console.error('deleteFolder error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFolders, createFolder, renameFolder, deleteFolder };
