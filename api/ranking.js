module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({ status: 'ok', message: 'Use browser client-side JSONP for direct Rakuten connection' });
};
