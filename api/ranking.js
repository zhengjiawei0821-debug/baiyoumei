module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { genreId = '0', applicationId, accessKey, maxReviews } = req.query;
  const reviewLimit = maxReviews ? parseInt(maxReviews, 10) : 50;

  // 使用你提供的有效乐天凭证 (或从请求中传入)
  const appId = applicationId || '36fd7fcb-f8db-4ac1-b1b9-8d79a45f325b';
  const aKey = accessKey || 'pk_vknKzIE1OlIFPENSxBUXzipyEhSWPHZcRwb2bOGH7mx';

  let allItems = [];

  try {
    // 乐天官方标准端点：一次可取多页数据
    const pageList = [1, 2, 3];
    for (const p of pageList) {
      let url = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&formatVersion=2&applicationId=${encodeURIComponent(appId)}&accessKey=${encodeURIComponent(aKey)}&page=${p}`;
      if (genreId && genreId !== '0') {
        url += `&genreId=${encodeURIComponent(genreId)}`;
      }

      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.ok) {
        const json = await r.json();
        const rawItems = json.Items || [];
        rawItems.forEach((it, idx) => {
          const item = it.Item || it;
          const reviews = item.reviewCount || 0;
          let img = '';
          if (Array.isArray(item.mediumImageUrls) && item.mediumImageUrls.length > 0) {
            img = typeof item.mediumImageUrls[0] === 'string' ? item.mediumImageUrls[0] : (item.mediumImageUrls[0].imageUrl || '');
          }

          allItems.push({
            rank: item.rank || (allItems.length + 1),
            title: item.itemName,
            price: item.itemPrice,
            url: item.itemUrl || item.affiliateUrl || 'https://ranking.rakuten.co.jp/',
            shop: item.shopName || '楽天市場店',
            reviews: reviews,
            score: item.reviewAverage || 4.8,
            img: img
          });
        });
      }
    }

    if (allItems.length > 0) {
      // 按照评论数进行黑马过滤 (默认评论 <= 50)
      let filtered = allItems;
      if (reviewLimit < 99999) {
        filtered = allItems.filter(item => item.reviews <= reviewLimit);
      }
      return res.status(200).json({ status: 'ok', source: 'rakuten_official_api', total: allItems.length, count: filtered.length, Items: filtered });
    }
  } catch (err) {
    console.error('API call failed:', err);
  }

  return res.status(500).json({ error: 'Failed to fetch from Rakuten official API' });
};
