module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { genreId = '0', applicationId, accessKey } = req.query;
  let allItems = [];

  // 1. 优先使用乐天官方 OpenAPI 并发拉取第 1~4 页 (共 Top 100 名)
  if (applicationId && accessKey) {
    try {
      const pagePromises = [1, 2, 3, 4].map(async (page) => {
        let apiUrl = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&formatVersion=2&applicationId=${encodeURIComponent(applicationId)}&accessKey=${encodeURIComponent(accessKey)}&page=${page}`;
        if (genreId && genreId !== '0') apiUrl += `&genreId=${encodeURIComponent(genreId)}`;
        const r = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        if (!r.ok) return [];
        const json = await r.json();
        const rawItems = json.Items || [];
        return rawItems.map((raw) => {
          const it = raw.Item || raw;
          let img = '';
          if (Array.isArray(it.mediumImageUrls) && it.mediumImageUrls.length > 0) {
            img = typeof it.mediumImageUrls[0] === 'string' ? it.mediumImageUrls[0] : (it.mediumImageUrls[0].imageUrl || '');
          }
          return {
            rank: it.rank,
            itemName: it.itemName,
            itemPrice: it.itemPrice,
            itemUrl: it.itemUrl || it.affiliateUrl || 'https://ranking.rakuten.co.jp/',
            shopName: it.shopName || '楽天市場優良店舗',
            reviewCount: it.reviewCount || 0,
            reviewAverage: it.reviewAverage || 0,
            imageUrl: img
          };
        });
      });

      const pagesResults = await Promise.all(pagePromises);
      allItems = pagesResults.flat();

      if (allItems.length > 0) {
        allItems.sort((a, b) => a.rank - b.rank);
        return res.status(200).json({ status: 'ok', source: 'rakuten_official_api', count: allItems.length, Items: allItems.slice(0, 100) });
      }
    } catch (e) {
      console.log('OpenAPI fetch error:', e);
    }
  }

  // 2. 备用引擎：直接抓取日本乐天前台排行榜第 1 页与第 2 页 (获取 Top 100)
  try {
    const isAll = (!genreId || genreId === '0');
    const urls = isAll 
      ? ['https://ranking.rakuten.co.jp/daily/', 'https://ranking.rakuten.co.jp/daily/?p=2']
      : [`https://ranking.rakuten.co.jp/daily/${encodeURIComponent(genreId)}/`, `https://ranking.rakuten.co.jp/daily/${encodeURIComponent(genreId)}/?p=2`];

    const htmlPromises = urls.map(async (u) => {
      const resp = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        }
      });
      if (!resp.ok) return '';
      return await resp.text();
    });

    const htmls = await Promise.all(htmlPromises);
    const combinedHtml = htmls.join('\n');

    const titles = [...combinedHtml.matchAll(/class="rnkRanking_itemName"[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const prices = [...combinedHtml.matchAll(/class="rnkRanking_price"[^>]*>[\s\S]*?([0-9,]+)\s*円/gi)];
    const shops = [...combinedHtml.matchAll(/class="rnkRanking_shop"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)];
    const reviews = [...combinedHtml.matchAll(/class="rnkRanking_reviewCount"[^>]*>[\s\S]*?([0-9,]+)\s*件/gi)];
    const scores = [...combinedHtml.matchAll(/class="rnkRanking_reviewScore"[^>]*>[\s\S]*?([0-9.]+)/gi)];
    const images = [...combinedHtml.matchAll(/class="rnkRanking_image"[\s\S]*?<img[^>]*src="([^"]+)"/gi)];

    for (let i = 0; i < titles.length && i < 100; i++) {
      allItems.push({
        rank: i + 1,
        itemName: titles[i][2].replace(/<[^>]+>/g, '').replace(/[\r\n\t]/g, '').trim(),
        itemPrice: prices[i] ? parseInt(prices[i][1].replace(/,/g, ''), 10) : 0,
        itemUrl: titles[i][1],
        shopName: shops[i] ? shops[i][1].replace(/<[^>]+>/g, '').trim() : '楽天市場店',
        reviewCount: reviews[i] ? parseInt(reviews[i][1].replace(/,/g, ''), 10) : 0,
        reviewAverage: scores[i] ? parseFloat(scores[i][1]) : 4.8,
        imageUrl: images[i] ? images[i][1] : ''
      });
    }

    if (allItems.length > 0) {
      return res.status(200).json({ status: 'ok', source: 'rakuten_live_web', count: allItems.length, Items: allItems });
    }
  } catch (err) {
    console.error('Scraper error:', err);
  }

  return res.status(500).json({ error: 'Ranking fetch error' });
};
