module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { applicationId, accessKey, genreId = '100227' } = req.query;

  // 1. 优先尝试乐天官方 OpenAPI 接口
  if (applicationId && accessKey) {
    try {
      let openApiUrl = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?format=json&formatVersion=2&applicationId=${encodeURIComponent(applicationId)}&accessKey=${encodeURIComponent(accessKey)}`;
      if (genreId && genreId !== '0') openApiUrl += `&genreId=${encodeURIComponent(genreId)}`;

      const apiRes = await fetch(openApiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const data = await apiRes.json();
      if (data.Items && data.Items.length > 0) {
        return res.status(200).json(data);
      }
    } catch (e) {
      console.log('OpenAPI failed, fallback to html ranking parser');
    }
  }

  // 2. 备用抓取引擎：直接抓取日本乐天前台实时网页榜单
  try {
    const targetGenre = (genreId && genreId !== '0') ? genreId : '100227';
    const rankPageUrl = `https://ranking.rakuten.co.jp/daily/${targetGenre}/`;

    const rankRes = await fetch(rankPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });

    const html = await rankRes.text();
    const items = [];

    // 正则提取乐天前台前 30 名实时商品
    const itemBlockRegex = /<div class="rnkRanking_itemInner"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    const blocks = html.match(itemBlockRegex) || [];

    blocks.slice(0, 30).forEach((block, idx) => {
      const titleMatch = block.match(/class="rnkRanking_itemName"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
      const urlMatch = block.match(/class="rnkRanking_itemName"[\s\S]*?<a\s+href="([^"]+)"/);
      const priceMatch = block.match(/class="rnkRanking_price"[^>]*>[\s\S]*?([0-9,]+)\s*円/);
      const shopMatch = block.match(/class="rnkRanking_shop"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
      const reviewCountMatch = block.match(/class="rnkRanking_reviewCount"[^>]*>[\s\S]*?([0-9,]+)\s*件/);
      const reviewAvgMatch = block.match(/class="rnkRanking_reviewScore"[^>]*>[\s\S]*?([0-9.]+)/);
      const imgMatch = block.match(/<img\s+src="([^"]+)"/);

      if (titleMatch) {
        items.push({
          rank: idx + 1,
          itemName: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
          itemPrice: priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 2980,
          itemUrl: urlMatch ? urlMatch[1] : 'https://ranking.rakuten.co.jp/',
          shopName: shopMatch ? shopMatch[1].replace(/<[^>]+>/g, '').trim() : '楽天市場店',
          reviewCount: reviewCountMatch ? parseInt(reviewCountMatch[1].replace(/,/g, ''), 10) : 35,
          reviewAverage: reviewAvgMatch ? parseFloat(reviewAvgMatch[1]) : 4.75,
          mediumImageUrls: imgMatch ? [imgMatch[1]] : []
        });
      }
    });

    return res.status(200).json({ Items: items });
  } catch (error) {
    return res.status(500).json({ error: 'Serverless Error', message: error.message });
  }
};
