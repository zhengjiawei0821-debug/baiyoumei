export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { applicationId, accessKey, genreId } = req.query;

  if (!applicationId) {
    return res.status(400).json({ error: 'Missing applicationId' });
  }

  try {
    let url = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&formatVersion=2&applicationId=${encodeURIComponent(applicationId)}`;
    if (accessKey) url += `&accessKey=${encodeURIComponent(accessKey)}`;
    if (genreId && genreId !== '0') url += `&genreId=${encodeURIComponent(genreId)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch from Rakuten', message: error.message });
  }
}
