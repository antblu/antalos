import React, { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';

const settings = () => window.drupalSettings.antalosJournal || {};
const bookmarkKey = 'antalos:reading-list';
const roots = new WeakMap();

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
    bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
    share: <><path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M5 19 19 5M5 5h14v14" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}

function readBookmarks() {
  try {
    const values = JSON.parse(localStorage.getItem(bookmarkKey) || '[]');
    return Array.isArray(values) ? [...new Set(values.filter(Number.isSafeInteger).filter(id => id > 0))].slice(0, 100) : [];
  } catch { return []; }
}

function useBookmarks() {
  const [saved, setSaved] = useState(readBookmarks);
  useEffect(() => {
    const update = () => setSaved(readBookmarks());
    window.addEventListener('storage', update);
    window.addEventListener('journal:bookmarks', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('journal:bookmarks', update);
    };
  }, []);
  return saved;
}

function BookmarkButton({ id }) {
  const saved = useBookmarks();
  const active = saved.includes(id);
  const [message, setMessage] = useState('');
  function toggle() {
    const current = readBookmarks();
    if (!current.includes(id) && current.length >= 100) {
      setMessage('Your reading list is full. Remove an article to save another.');
      return;
    }
    try {
      localStorage.setItem(bookmarkKey, JSON.stringify(current.includes(id) ? current.filter(value => value !== id) : [...current, id]));
      window.dispatchEvent(new Event('journal:bookmarks'));
      setMessage(active ? 'Removed from your reading list.' : 'Saved on this browser.');
    } catch { setMessage('Saving is unavailable because browser storage is blocked.'); }
  }
  return <><button className="icon-button" onClick={toggle} aria-pressed={active} aria-label={active ? 'Remove from reading list' : 'Save for later'} title={active ? 'Saved on this browser' : 'Save for later'}><Icon name="bookmark" /></button><span className="visually-hidden" role="status">{message}</span></>;
}

function ThemeToggle() {
  const system = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => document.documentElement.dataset.journalTheme ? document.documentElement.dataset.journalTheme === 'dark' : system();
  const [dark, setDark] = useState(current);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(current());
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.journalTheme = next;
    setDark(!dark);
    try { localStorage.setItem('antalos:theme', next); } catch { /* Still works for this page. */ }
  }
  return <button className="icon-button" onClick={toggle} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Use light theme' : 'Use dark theme'}><Icon name={dark ? 'sun' : 'moon'} /></button>;
}

async function fetchArticles(params, signal) {
  const url = new URL(settings().endpoint, location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' }, credentials: 'same-origin' });
  if (!response.ok) throw new Error('Articles could not be loaded. Please try again.');
  const data = await response.json();
  if (!Array.isArray(data.articles)) throw new Error('Articles could not be loaded.');
  return data;
}

function SearchDialog({ dialog }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('Search article titles from the journal.');
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setStatus('Search article titles from the journal.');
      return;
    }
    const controller = new AbortController();
    setStatus('Searching…');
    setResults([]);
    const timer = setTimeout(() => fetchArticles({ q: query }, controller.signal).then(data => {
      setResults(data.articles.slice(0, 6));
      setStatus(data.total ? `${data.total} matching ${data.total === 1 ? 'article' : 'articles'}.` : 'No matches yet. Try another title or topic.');
    }).catch(error => { if (error.name !== 'AbortError') setStatus(error.message); }), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const allUrl = new URL(settings().journalUrl, location.origin);
  allUrl.searchParams.set('q', query);
  return <dialog ref={dialog} className="search-dialog" aria-labelledby="search-dialog-title" onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}>
    <div className="section-heading"><h2 id="search-dialog-title">A little discovery.</h2><button className="icon-button" aria-label="Close search" onClick={() => dialog.current.close()}><Icon name="close" /></button></div>
    <form action={settings().journalUrl}><label className="search-field"><span>Search article titles</span><input autoFocus type="search" name="q" placeholder="What are you curious about?" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} /></label></form>
    <p className="search-hint" role="status">{status}</p>
    <ul className="search-results">{results.map(story => <li key={story.id}><a href={story.url}><strong>{story.title}</strong><small>{story.dateLabel} · {story.minutes} min read</small></a></li>)}</ul>
    {query.trim() && <a className="text-link" href={allUrl.pathname + allUrl.search}>See all results <Icon name="arrow" size={13} /></a>}
    <p className="search-hint">Esc to close · Ctrl / ⌘ K to open</p>
  </dialog>;
}

function NavigationTools() {
  const dialog = useRef(null);
  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current.open) dialog.current.close(); else dialog.current.showModal();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return <><button className="icon-button" aria-label="Search articles" title="Search (Ctrl / ⌘ K)" onClick={() => dialog.current.showModal()}><Icon name="search" /></button><ThemeToggle />{createPortal(<SearchDialog dialog={dialog} />, document.body)}</>;
}

function ArticleArtwork({ story, featured }) {
  return <a className={`story-art art-${story.id % 4}`} href={story.url} tabIndex={-1} aria-hidden="true">
    {story.image ? <img src={story.image.url} alt="" loading={featured ? 'eager' : 'lazy'} decoding="async" /> : <><span className="art-orbit" /><span className="art-glyph">{['{ }', '> _', '[ / ]', '*'][story.id % 4]}</span><span className="art-caption">FIELD NOTES / {String(story.id).padStart(2, '0')}</span></>}
  </a>;
}

function StoryCard({ story, featured = false }) {
  return <article className={`story-card${featured ? ' story-card--featured' : ''}`}>
    <ArticleArtwork story={story} featured={featured} />
    <div className="story-card__body">
      <div className="story-meta">{featured && <span className="eyebrow">The latest entry</span>}<span>{story.minutes} min read</span></div>
      <h2><a href={story.url}>{story.title}</a></h2><p>{story.summary}</p>
      <div className="topic-list">{story.tags.map(tag => <a className="topic-pill" key={tag.id} href={tag.url}>{tag.label}</a>)}</div>
      <div className="story-bottom"><time dateTime={story.date}>{story.dateLabel}</time><a className="text-link" href={story.url}>Read story <Icon name="arrow" size={13} /></a><BookmarkButton id={story.id} /></div>
    </div>
  </article>;
}

function ArticleExplorer({ fallback }) {
  const initial = settings().initial;
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState(initial.filters.q);
  const [filters, setFilters] = useState(initial.filters);
  const [savedOnly, setSavedOnly] = useState(false);
  const saved = useBookmarks();
  const savedIds = saved.join(',');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const firstFetch = useRef(true);
  useEffect(() => {
    if (fallback) fallback.hidden = true;
    return () => { if (fallback) fallback.hidden = false; };
  }, [fallback]);
  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => setFilters(previous => ({ ...previous, q: query, page: 0 })), 300);
    return () => clearTimeout(timer);
  }, [query, filters.q]);
  useEffect(() => {
    if (firstFetch.current) { firstFetch.current = false; return; }
    const controller = new AbortController();
    setBusy(true);
    setError('');
    fetchArticles({ ...filters, ...(savedOnly ? { ids: savedIds } : {}) }, controller.signal).then(result => {
      setData(result);
      setBusy(false);
      if (!savedOnly) {
        const url = new URL(location.href);
        ['q', 'tag', 'page', 'sort'].forEach(key => url.searchParams.delete(key));
        Object.entries(filters).forEach(([key, value]) => {
          if (value && !(key === 'sort' && value === 'latest')) url.searchParams.set(key, String(value));
        });
        history.replaceState(history.state, '', url);
      }
    }).catch(failure => {
      if (failure.name !== 'AbortError') { setError(failure.message); setBusy(false); }
    });
    return () => controller.abort();
  }, [filters, savedOnly, savedIds, retry]);
  function update(patch) { setFilters(previous => ({ ...previous, ...patch, page: 0 })); }
  const featured = !filters.q && !filters.tag && !filters.page && !savedOnly && filters.sort === 'latest';
  return <>
    <div className="section-heading"><h2>{savedOnly ? 'Your reading list' : 'From the journal'}</h2><span role="status">{busy ? 'Finding your next read…' : `${data.total} ${data.total === 1 ? 'article' : 'articles'}`}</span></div>
    <form className="explorer-controls" onSubmit={event => { event.preventDefault(); update({ q: query }); }}>
      <label className="search-field"><span>Search article titles</span><input type="search" placeholder="Find your next read…" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Sort<select value={filters.sort} onChange={event => update({ sort: event.target.value })}><option value="latest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <button type="submit" className="button">Search <Icon name="search" size={15} /></button>
    </form>
    <div className="filter-row" aria-label="Filter articles by topic">
      <button className="topic-pill" aria-pressed={!filters.tag} onClick={() => update({ tag: 0 })}>All topics</button>
      {(data.topics || []).map(tag => <button className="topic-pill" key={tag.id} aria-pressed={filters.tag === tag.id} onClick={() => update({ tag: tag.id })}>{tag.label}</button>)}
      {filters.tag > 0 && !(data.topics || []).some(tag => tag.id === filters.tag) && <button className="topic-pill" aria-pressed="true" onClick={() => update({ tag: 0 })}>Selected topic ×</button>}
      <button className="topic-pill saved-filter" aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); update({}); }}><Icon name="bookmark" size={13} /> Saved ({saved.length})</button>
    </div>
    {savedOnly && <p className="results-count">Saved on this browser. Only articles you can currently read appear here.</p>}
    {error && <div className="error-message" role="alert">{error} <button className="button button--quiet" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <div className="article-grid" aria-busy={busy}>
      {data.articles.map((story, index) => <StoryCard key={story.id} story={story} featured={featured && index === 0} />)}
      {!data.articles.length && !busy && <div className="empty-state"><span className="eyebrow">A little room for discovery</span><h2>{savedOnly ? 'Something worth coming back to.' : 'No articles here yet.'}</h2><p>{savedOnly ? 'Tap the bookmark on a story to save it here. Search and topic filters also apply to your reading list.' : 'Try another search, or come back for the next field note.'}</p><button className="button button--quiet" onClick={() => { setQuery(''); setSavedOnly(false); update({ q: '', tag: 0 }); }}>Browse all articles</button></div>}
    </div>
    {(data.total > 12 || filters.page > 0) && <nav className="pagination" aria-label="Article pages"><button className="button button--quiet" disabled={busy || filters.page === 0} onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}>← Previous</button><span>Page {filters.page + 1}</span><button className="button button--quiet" disabled={busy || !data.next} onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}>Next →</button></nav>}
  </>;
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

function ReadingTools({ article }) {
  const [large, setLarge] = useState(false);
  const [status, setStatus] = useState('');
  async function share() {
    const url = new URL(article.dataset.articleUrl, location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: article.dataset.articleTitle, url });
      else { await copyText(url); setStatus('Link copied.'); }
    } catch (error) { if (error.name !== 'AbortError') setStatus('Copy the link from your browser’s address bar.'); }
  }
  return <div className="reading-actions"><BookmarkButton id={Number(article.dataset.articleId)} /><button className="icon-button" onClick={share} aria-label="Share article" title="Share article"><Icon name="share" /></button><button className="icon-button" aria-label="Larger reading text" title="Larger reading text" aria-pressed={large} onClick={() => { article.dataset.readingSize = large ? 'normal' : 'large'; setLarge(!large); }}>Aa</button><span className="action-status" role="status">{status}</span></div>;
}

function ReadingProgress({ article }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame;
    const prose = article.querySelector('[data-journal-prose]');
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = prose.getBoundingClientRect();
        const distance = box.height - window.innerHeight;
        setProgress(distance <= 0 ? (box.bottom <= window.innerHeight ? 1 : 0) : Math.max(0, Math.min(1, -box.top / distance)));
      });
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(prose);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [article]);
  return createPortal(<div className="reading-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>, document.body);
}

function TableOfContents({ article }) {
  const [headings, setHeadings] = useState([]);
  const [active, setActive] = useState('');
  useEffect(() => {
    const nodes = [...article.querySelectorAll('[data-journal-prose] h2, [data-journal-prose] h3')];
    nodes.forEach((heading, index) => {
      if (!heading.id) {
        let id = `journal-section-${index + 1}`;
        while (document.getElementById(id)) id += '-heading';
        heading.id = id;
      }
    });
    setHeadings(nodes.map(node => ({ id: node.id, title: node.textContent, sub: node.tagName === 'H3' })));
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const preceding = nodes.filter(node => node.getBoundingClientRect().top <= 160);
        setActive((preceding.at(-1) || nodes[0])?.id || '');
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); };
  }, [article]);
  return <><ReadingProgress article={article} />{headings.length > 0 && <nav aria-label="On this page"><h2 className="toc-title">On this page</h2><ol className="toc-links">{headings.map(heading => <li key={heading.id} className={heading.sub ? 'toc-sub' : ''}><a href={`#${encodeURIComponent(heading.id)}`} aria-current={active === heading.id ? 'location' : undefined}>{heading.title}</a></li>)}</ol></nav>}</>;
}

function CodeCopy({ text }) {
  const [label, setLabel] = useState('Copy code');
  return <button onClick={async () => { try { await copyText(text); setLabel('Copied!'); } catch { setLabel('Select code to copy'); } }}><span role="status">{label}</span></button>;
}

function RelatedArticles({ article }) {
  const [stories, setStories] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    const tag = article.dataset.articleTag;
    const id = Number(article.dataset.articleId);
    (async () => {
      let data = await fetchArticles(tag ? { tag } : {}, controller.signal);
      let next = data.articles.filter(story => story.id !== id);
      if (!next.length && tag) {
        data = await fetchArticles({}, controller.signal);
        next = data.articles.filter(story => story.id !== id);
      }
      setStories(next.slice(0, 3));
    })().catch(() => { /* Optional discovery must never interrupt the article. */ });
    return () => controller.abort();
  }, [article]);
  if (!stories.length) return null;
  return <><div className="section-heading"><h2>A little more to explore</h2><a className="text-link" href={settings().journalUrl}>All articles ↗</a></div><div className="article-grid">{stories.map(story => <StoryCard key={story.id} story={story} />)}</div></>;
}

class IslandBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { if (this.props.fallback) this.props.fallback.hidden = false; }
  render() { return this.state.failed ? null : this.props.children; }
}

// Drupal behaviors allow AJAX/BigPipe attachments without duplicate roots.
window.Drupal.behaviors.antalosJournal = {
  attach(context) {
    function mount(selector, render) {
      window.once('antalos-journal', selector, context).forEach(element => {
        const fallback = element.parentElement.querySelector('[data-journal-fallback]');
        const root = createRoot(element);
        roots.set(element, root);
        root.render(<IslandBoundary fallback={fallback}>{render(element, fallback)}</IslandBoundary>);
      });
    }
    mount('[data-journal-navigation]', () => <NavigationTools />);
    mount('[data-journal-explorer]', (_, fallback) => <ArticleExplorer fallback={fallback} />);
    mount('[data-journal-reader-tools]', element => <ReadingTools article={element.closest('[data-journal-article]')} />);
    mount('[data-journal-toc]', element => <TableOfContents article={element.closest('[data-journal-article]')} />);
    mount('[data-journal-related]', element => <RelatedArticles article={element.closest('[data-journal-article]')} />);
    window.once('antalos-code', '[data-journal-prose] pre', context).forEach(pre => {
      const code = pre.querySelector('code');
      const text = (code || pre).textContent;
      const element = document.createElement('span');
      element.className = 'code-copy';
      element.dataset.journalCopy = '';
      pre.appendChild(element);
      const root = createRoot(element);
      roots.set(element, root);
      root.render(<IslandBoundary><CodeCopy text={text} /></IslandBoundary>);
    });
  },
  detach(context, settings, trigger) {
    if (trigger !== 'unload') return;
    const selector = '[data-once~="antalos-journal"], [data-journal-copy]';
    const elements = [...context.querySelectorAll(selector)];
    if (context.matches?.(selector)) elements.push(context);
    elements.forEach(element => { roots.get(element)?.unmount(); roots.delete(element); });
    window.once.remove('antalos-journal', '[data-once~="antalos-journal"]', context);
    window.once.remove('antalos-code', '[data-once~="antalos-code"]', context);
    context.querySelectorAll('[data-journal-copy]').forEach(element => element.remove());
  },
};
// Deferred assets can execute after Drupal's initial attach pass.
window.Drupal.behaviors.antalosJournal.attach(document);
