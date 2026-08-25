module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { genreId = '0', applicationId, accessKey } = req.query;

  const appId = applicationId || '36fd7fcb-f8db-4ac1-b1b9-8d79a45f325b';
  const aKey = accessKey || 'pk_vknKzIE1OlIFPENSxBUXzipyEhSWPHZcRwb2bOGH7mx';

  let allLiveItems = [];

  try {
    // 并发请求乐天官方实时榜 (period=realtime) 前 90 名
    const pages = [1, 2, 3];
    const fetchPromises = pages.map(async (page) => {
      let url = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&formatVersion=2&period=realtime&applicationId=${encodeURIComponent(appId)}&accessKey=${encodeURIComponent(aKey)}&page=${page}`;
      if (genreId && genreId !== '0') {
        url += `&genreId=${encodeURIComponent(genreId)}`;
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (!response.ok) return [];
      const json = await response.json();
      const rawItems = json.Items || [];

      return rawItems.map((raw) => {
        const item = raw.Item || raw;
        let img = '';
        if (Array.isArray(item.mediumImageUrls) && item.mediumImageUrls.length > 0) {
          img = typeof item.mediumImageUrls[0] === 'string' ? item.mediumImageUrls[0] : (item.mediumImageUrls[0].imageUrl || '');
        }

        return {
          rank: Number(item.rank || 0),
          title: String(item.itemName || ''),
          price: Number(item.itemPrice || 0),
          url: String(item.itemUrl || item.affiliateUrl || 'https://ranking.rakuten.co.jp/realtime/'),
          shop: String(item.shopName || '楽天市場店'),
          reviews: Number(item.reviewCount || 0),
          score: Number(item.reviewAverage || 0),
          img: img
        };
      });
    });

    const pageResults = await Promise.all(fetchPromises);
    allLiveItems = pageResults.flat();

    if (allLiveItems.length > 0) {
      allLiveItems.sort((a, b) => a.rank - b.rank);
      return res.status(200).json({
        status: 'ok',
        source: 'rakuten_official_realtime_api',
        count: allLiveItems.length,
        Items: allLiveItems
      });
    }
  } catch (err) {
    console.error('Rakuten API fetch error:', err);
  }

  // 网页直抓兜底
  return res.status(200).json({ status: 'empty', Items: [] });
};
