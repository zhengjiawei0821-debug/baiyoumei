module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { genreId = '0', maxReviews = '100', applicationId, accessKey } = req.query;
  const reviewLimit = parseInt(maxReviews, 10) || 100;

  // 使用你的乐天官方开发者凭证
  const appId = applicationId || '36fd7fcb-f8db-4ac1-b1b9-8d79a45f325b';
  const aKey = accessKey || 'pk_vknKzIE1OlIFPENSxBUXzipyEhSWPHZcRwb2bOGH7mx';

  let allLiveItems = [];

  try {
    // 乐天官方实时榜 (period=realtime) 多页并发请求 (抓取实时榜前90名)
    const pages = [1, 2, 3];
    const fetchPromises = pages.map(async (page) => {
      let url = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&formatVersion=2&period=realtime&applicationId=${encodeURIComponent(appId)}&accessKey=${encodeURIComponent(aKey)}&page=${page}`;
      if (genreId && genreId !== '0') {
        url += `&genreId=${encodeURIComponent(genreId)}`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error_description || errorJson.error || `HTTP ${response.status}`);
      }

      const json = await response.json();
      const rawItems = json.Items || [];

      return rawItems.map((raw) => {
        const item = raw.Item || raw;
        let img = '';
        if (Array.isArray(item.mediumImageUrls) && item.mediumImageUrls.length > 0) {
          img = typeof item.mediumImageUrls[0] === 'string' ? item.mediumImageUrls[0] : (item.mediumImageUrls[0].imageUrl || '');
        } else if (Array.isArray(item.smallImageUrls) && item.smallImageUrls.length > 0) {
          img = typeof item.smallImageUrls[0] === 'string' ? item.smallImageUrls[0] : (item.smallImageUrls[0].imageUrl || '');
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
      // 严格按照评论数过滤
      let filtered = allLiveItems;
      if (reviewLimit < 99999) {
        filtered = allLiveItems.filter(item => item.reviews <= reviewLimit);
      }
      filtered.sort((a, b) => a.rank - b.rank);

      return res.status(200).json({
        status: 'ok',
        source: 'rakuten_official_realtime_api',
        total_scanned: allLiveItems.length,
        count: filtered.length,
        Items: filtered
      });
    } else {
      return res.status(200).json({
        status: 'empty',
        total_scanned: 0,
        count: 0,
        Items: []
      });
    }
  } catch (err) {
    console.error('Rakuten API fetch error:', err);
    return res.status(500).json({
      error: 'Rakuten API Error',
      message: err.message
    });
  }
};
