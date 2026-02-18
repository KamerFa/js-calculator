import { Router } from 'express';

const router = Router();

// ── News sources (RSS feeds) ─────────────────────────────────
const NEWS_SOURCES = [
  { id: 'bbc',        name: 'BBC News',        url: 'https://feeds.bbci.co.uk/news/rss.xml',              category: 'World' },
  { id: 'reuters',    name: 'Reuters',          url: 'https://feeds.reuters.com/reuters/topNews',          category: 'World' },
  { id: 'aljazeera',  name: 'Al Jazeera',       url: 'https://www.aljazeera.com/xml/rss/all.xml',         category: 'World' },
  { id: 'techcrunch', name: 'TechCrunch',       url: 'https://techcrunch.com/feed/',                      category: 'Tech' },
  { id: 'ars',        name: 'Ars Technica',     url: 'https://feeds.arstechnica.com/arstechnica/index',   category: 'Tech' },
  { id: 'hackernews', name: 'Hacker News',      url: 'https://hnrss.org/frontpage',                       category: 'Tech' },
  { id: 'espn',       name: 'ESPN',             url: 'https://www.espn.com/espn/rss/news',                category: 'Sports' },
  { id: 'nature',     name: 'Nature',           url: 'https://www.nature.com/nature.rss',                 category: 'Science' },
  { id: 'nyt',        name: 'NY Times',         url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'World' },
  { id: 'verge',      name: 'The Verge',        url: 'https://www.theverge.com/rss/index.xml',            category: 'Tech' },
];

// Simple XML tag extractor (no dependency needed)
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] || m[2] || '').trim();
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function parseRSSItems(xml) {
  const items = [];
  // Try RSS 2.0 <item> tags
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description')
      .replace(/<[^>]+>/g, '')  // strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .slice(0, 300);
    const pubDate = extractTag(block, 'pubDate');

    // Try to find image
    let image = extractAttr(block, 'media:content', 'url')
      || extractAttr(block, 'media:thumbnail', 'url')
      || extractAttr(block, 'enclosure', 'url');

    if (title && link) {
      items.push({ title, link, description, pubDate, image });
    }
  }

  // Try Atom <entry> tags if no RSS items found
  if (items.length === 0) {
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = extractTag(block, 'title');
      const link = extractAttr(block, 'link', 'href') || extractTag(block, 'link');
      const description = (extractTag(block, 'summary') || extractTag(block, 'content'))
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .slice(0, 300);
      const pubDate = extractTag(block, 'published') || extractTag(block, 'updated');

      if (title && link) {
        items.push({ title, link, description, pubDate, image: '' });
      }
    }
  }

  return items.slice(0, 15); // max 15 articles per source
}

// In-memory cache (5 min TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchFeed(source) {
  const now = Date.now();
  const cached = cache.get(source.id);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DashboardNewsAggregator/1.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const articles = parseRSSItems(xml).map((a) => ({
      ...a,
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
    }));

    cache.set(source.id, { data: articles, time: now });
    return articles;
  } catch (err) {
    // Return stale cache if available
    if (cached) return cached.data;
    console.error(`News fetch failed for ${source.name}:`, err.message);
    return [];
  }
}

// GET /api/news — fetch aggregated news from all sources
router.get('/', async (req, res) => {
  const { source, category } = req.query;

  let sources = NEWS_SOURCES;
  if (source) {
    sources = sources.filter((s) => s.id === source);
  }
  if (category) {
    sources = sources.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }

  const results = await Promise.all(sources.map(fetchFeed));
  const articles = results.flat();

  // Sort by date (newest first)
  articles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  res.json({
    articles,
    sources: NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name, category: s.category })),
  });
});

// GET /api/news/sources — list available sources
router.get('/sources', (_req, res) => {
  res.json(NEWS_SOURCES.map((s) => ({ id: s.id, name: s.name, category: s.category })));
});

export default router;
