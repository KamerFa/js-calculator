import { useState, useEffect, useCallback } from 'react';
import { DB } from '../db';

const CATEGORIES = ['All', 'World', 'Tech', 'Science', 'Sports'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconNewspaper() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <line x1="10" y1="6" x2="18" y2="6" />
      <line x1="10" y1="10" x2="18" y2="10" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

const SOURCE_COLORS = {
  bbc: '#bb1919',
  reuters: '#ff8800',
  aljazeera: '#d2982a',
  techcrunch: '#0a9e01',
  ars: '#ff4e00',
  hackernews: '#ff6600',
  espn: '#d00',
  nature: '#2a6496',
  nyt: '#1a1a1a',
  verge: '#712cf9',
};

export default function NewsView() {
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSource, setActiveSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (activeSource) params.source = activeSource;
      else if (activeCategory !== 'All') params.category = activeCategory;
      const data = await DB.getNews(params);
      setArticles(data.articles || []);
      if (data.sources) setSources(data.sources);
    } catch (err) {
      setError(err.message || 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeSource]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filteredArticles = searchQuery
    ? articles.filter((a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : articles;

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    setActiveSource(null);
  };

  const handleSourceClick = (srcId) => {
    if (activeSource === srcId) {
      setActiveSource(null);
    } else {
      setActiveSource(srcId);
      setActiveCategory('All');
    }
  };

  const uniqueCategories = [...new Set(sources.map((s) => s.category))];

  return (
    <div className="news-view">
      {/* Header */}
      <div className="news-header">
        <div className="news-header-left">
          <IconNewspaper />
          <h2>News</h2>
          <span className="news-article-count">
            {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="news-header-right">
          <div className="news-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="news-view-toggle">
            <button
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
              title="Card view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          <button className="news-refresh-btn" onClick={fetchNews} disabled={loading} title="Refresh news">
            <IconRefresh />
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="news-filters">
        <div className="news-category-tabs">
          {CATEGORIES.filter((c) => c === 'All' || uniqueCategories.includes(c)).map((cat) => (
            <button
              key={cat}
              className={`news-cat-tab${activeCategory === cat && !activeSource ? ' active' : ''}`}
              onClick={() => handleCategoryClick(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="news-source-chips">
          {sources.map((src) => (
            <button
              key={src.id}
              className={`news-source-chip${activeSource === src.id ? ' active' : ''}`}
              onClick={() => handleSourceClick(src.id)}
              style={activeSource === src.id ? { borderColor: SOURCE_COLORS[src.id] || 'var(--accent)', background: (SOURCE_COLORS[src.id] || 'var(--accent)') + '18' } : {}}
            >
              <span className="news-source-dot" style={{ background: SOURCE_COLORS[src.id] || 'var(--muted)' }} />
              {src.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error && (
        <div className="news-error">
          <p>Failed to load news: {error}</p>
          <button onClick={fetchNews}>Try again</button>
        </div>
      )}

      {loading && articles.length === 0 && (
        <div className="news-loading">
          <div className="news-loading-spinner" />
          <p>Loading latest news...</p>
        </div>
      )}

      {!loading && filteredArticles.length === 0 && !error && (
        <div className="news-empty">
          <IconNewspaper />
          <p>No articles found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
        </div>
      )}

      {filteredArticles.length > 0 && (
        <div className={`news-grid ${viewMode === 'list' ? 'news-grid-list' : 'news-grid-cards'}`}>
          {filteredArticles.map((article, i) => (
            <a
              key={`${article.sourceId}-${i}`}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="news-card"
            >
              {viewMode === 'cards' && article.image && (
                <div className="news-card-image">
                  <img
                    src={article.image}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="news-card-body">
                <div className="news-card-meta">
                  <span
                    className="news-card-source"
                    style={{ color: SOURCE_COLORS[article.sourceId] || 'var(--muted)' }}
                  >
                    {article.sourceName}
                  </span>
                  <span className="news-card-time">{timeAgo(article.pubDate)}</span>
                </div>
                <h3 className="news-card-title">{article.title}</h3>
                {article.description && (
                  <p className="news-card-desc">{article.description}</p>
                )}
                <span className="news-card-link">
                  Read more <IconExternalLink />
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
