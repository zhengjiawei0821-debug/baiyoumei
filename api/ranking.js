module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { genreId = '0' } = req.query;

  // 1. 拼接乐天前台官方排行榜页面地址
  const isAll = (!genreId || genreId === '0');
  const rankPageUrl = isAll 
    ? 'https://ranking.rakuten.co.jp/daily/' 
    : `https://ranking.rakuten.co.jp/daily/${encodeURIComponent(genreId)}/`;

  try {
    const rankRes = await fetch(rankPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });

    if (rankRes.ok) {
      const html = await rankRes.text();
      const items = [];

      // 精准提取乐天前台字段
      const titles = [...html.matchAll(/class="rnkRanking_itemName"[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      const prices = [...html.matchAll(/class="rnkRanking_price"[^>]*>[\s\S]*?([0-9,]+)\s*円/gi)];
      const shops = [...html.matchAll(/class="rnkRanking_shop"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)];
      const reviews = [...html.matchAll(/class="rnkRanking_reviewCount"[^>]*>[\s\S]*?([0-9,]+)\s*件/gi)];
      const scores = [...html.matchAll(/class="rnkRanking_reviewScore"[^>]*>[\s\S]*?([0-9.]+)/gi)];
      const images = [...html.matchAll(/class="rnkRanking_image"[\s\S]*?<img[^>]*src="([^"]+)"/gi)];

      for (let i = 0; i < titles.length && i < 30; i++) {
        const itemUrl = titles[i][1];
        const rawTitle = titles[i][2].replace(/<[^>]+>/g, '').replace(/[\r\n\t]/g, '').trim();
        const price = prices[i] ? parseInt(prices[i][1].replace(/,/g, ''), 10) : 0;
        const shop = shops[i] ? shops[i][1].replace(/<[^>]+>/g, '').trim() : '楽天市場店';
        const reviewCount = reviews[i] ? parseInt(reviews[i][1].replace(/,/g, ''), 10) : 0;
        const reviewScore = scores[i] ? parseFloat(scores[i][1]) : 4.8;
        const img = images[i] ? images[i][1] : '';

        items.push({
          rank: i + 1,
          itemName: rawTitle,
          itemPrice: price,
          itemUrl: itemUrl,
          shopName: shop,
          reviewCount: reviewCount,
          reviewAverage: reviewScore,
          mediumImageUrls: img ? [img] : []
        });
      }

      if (items.length > 0) {
        return res.status(200).json({ status: 'ok', source: 'live_rakuten_daily', count: items.length, Items: items });
      }
    }
  } catch (err) {
    console.error('Scraping error:', err);
  }

  return res.status(500).json({ error: 'Failed to fetch ranking from Rakuten' });
};
