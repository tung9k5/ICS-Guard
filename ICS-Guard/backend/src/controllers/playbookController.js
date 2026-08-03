import { Playbook } from '../models/index.js';

export const getPlaybooks = async (req, res) => {
  try {
    const playbooks = await Playbook.find().sort({ createdAt: -1 });
    res.json(playbooks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPlaybook = async (req, res) => {
  try {
    const pb = new Playbook({ ...req.body, createdBy: req.user.id });
    await pb.save();
    res.status(201).json(pb);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePlaybook = async (req, res) => {
  try {
    await Playbook.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
