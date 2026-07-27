import cveService from '../services/cveService.js';

export const getDeviceCves = async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cves = await cveService.fetchDeviceCves(keyword);
    res.json({ success: true, data: cves });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
