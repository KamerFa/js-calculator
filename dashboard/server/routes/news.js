import { Router } from 'express';

const router = Router();

// ── News sources (RSS feeds) ─────────────────────────────────
const NEWS_SOURCES = [
  // ── World ───────────────────────────────────────────────────
  { id: 'bbc',        name: 'BBC News',        url: 'https://feeds.bbci.co.uk/news/rss.xml',              category: 'World' },
  { id: 'reuters',    name: 'Reuters',          url: 'https://feeds.reuters.com/reuters/topNews',          category: 'World' },
  { id: 'aljazeera',  name: 'Al Jazeera',       url: 'https://www.aljazeera.com/xml/rss/all.xml',         category: 'World' },
  { id: 'nyt',        name: 'NY Times',         url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'World' },

  // ── Tech ────────────────────────────────────────────────────
  { id: 'techcrunch', name: 'TechCrunch',       url: 'https://techcrunch.com/feed/',                      category: 'Tech' },
  { id: 'ars',        name: 'Ars Technica',     url: 'https://feeds.arstechnica.com/arstechnica/index',   category: 'Tech' },
  { id: 'hackernews', name: 'Hacker News',      url: 'https://hnrss.org/frontpage',                       category: 'Tech' },
  { id: 'verge',      name: 'The Verge',        url: 'https://www.theverge.com/rss/index.xml',            category: 'Tech' },

  // ── Science & Sports ───────────────────────────────────────
  { id: 'nature',     name: 'Nature',           url: 'https://www.nature.com/nature.rss',                 category: 'Science' },
  { id: 'espn',       name: 'ESPN',             url: 'https://www.espn.com/espn/rss/news',                category: 'Sports' },

  // ── Balkan / Regional ──────────────────────────────────────
  { id: 'klix',       name: 'Klix.ba',          url: 'https://www.klix.ba/rss',                           category: 'Balkan' },
  { id: 'avaz',       name: 'Dnevni Avaz',      url: 'https://avaz.ba/rss',                               category: 'Balkan' },
  { id: 'oslobodjenje', name: 'Oslobodjenje',   url: 'https://www.oslobodjenje.ba/feed',                  category: 'Balkan' },
  { id: 'n1bih',      name: 'N1 BiH',           url: 'https://n1info.ba/feed/',                           category: 'Balkan' },
  { id: 'index_hr',   name: 'Index.hr',         url: 'https://www.index.hr/rss',                          category: 'Balkan' },
  { id: '24sata',     name: '24sata',            url: 'https://www.24sata.hr/feeds/najnovije.xml',         category: 'Balkan' },
  { id: 'blic',       name: 'Blic',             url: 'https://www.blic.rs/rss',                           category: 'Balkan' },
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

// GET /api/news/article — proxy-fetch article and extract readable content
router.get('/article', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DashboardReader/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Extract readable content
    const content = extractArticleContent(html, url);
    res.json(content);
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch article', detail: err.message });
  }
});

/**
 * Extract readable article content from raw HTML.
 * Lightweight reader-mode: finds <article> or main content block,
 * strips scripts/styles/nav, returns clean HTML + metadata.
 */
function extractArticleContent(html, url) {
  // Extract metadata
  const title = extractMeta(html, 'og:title')
    || extractTagContent(html, 'title')
    || '';
  const image = extractMeta(html, 'og:image') || '';
  const siteName = extractMeta(html, 'og:site_name') || '';
  const description = extractMeta(html, 'og:description')
    || extractMeta(html, 'description')
    || '';
  const author = extractMeta(html, 'author')
    || extractMeta(html, 'article:author')
    || extractMetaName(html, 'author')
    || '';
  const publishedTime = extractMeta(html, 'article:published_time')
    || extractMeta(html, 'datePublished')
    || '';

  // Try to extract article body
  let body = '';

  // Priority 1: <article> tag
  const articleMatch = html.match(/<article[\s>]([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    body = articleMatch[1];
  }

  // Priority 2: role="main" or id="main-content" or class containing "article-body"
  if (!body) {
    const mainPatterns = [
      /role=["']main["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/i,
      /class=["'][^"']*article[_-]?body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /class=["'][^"']*story[_-]?body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /class=["'][^"']*post[_-]?content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /class=["'][^"']*entry[_-]?content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /class=["'][^"']*article[_-]?content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ];
    for (const pattern of mainPatterns) {
      const match = html.match(pattern);
      if (match && match[1].length > 200) {
        body = match[1];
        break;
      }
    }
  }

  // Priority 3: largest block of <p> tags
  if (!body || body.length < 200) {
    const pTags = html.match(/<p[\s>][\s\S]*?<\/p>/gi) || [];
    if (pTags.length > 0) {
      body = pTags.join('\n');
    }
  }

  // Clean the body HTML
  body = cleanHTML(body);

  return { title, image, siteName, description, author, publishedTime, body, url };
}

function extractMeta(html, property) {
  // og:xxx or article:xxx
  const re = new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:|article:)?${property}["'][^>]+content=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  if (m) return m[1];
  // Reversed attribute order
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](?:og:|article:)?${property}["']`, 'i');
  const m2 = html.match(re2);
  return m2 ? m2[1] : '';
}

function extractMetaName(html, name) {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function extractTagContent(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function cleanHTML(html) {
  if (!html) return '';
  return html
    // Remove scripts, styles, iframes, forms, nav, aside
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove data attributes and event handlers
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+data-[\w-]+="[^"]*"/gi, '')
    // Remove class/id/style attributes (keep src, href, alt)
    .replace(/\s+(class|id|style|role|aria-[\w-]+)="[^"]*"/gi, '')
    // Remove empty tags
    .replace(/<(div|span|section)\s*>\s*<\/\1>/gi, '')
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default router;
