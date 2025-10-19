import { useEffect, useMemo, useState } from 'react'
import './list_page.css'
import AddPostPage, { type PublishedPost } from './add_post_page'

export default function ListPage() {
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [posts, setPosts] = useState<PublishedPost[]>([])

  // Load posts from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('posts')
      const list: PublishedPost[] = raw ? JSON.parse(raw) : []
      // sort oldest-first so new posts appear under the old ones
      list.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      setPosts(list)
    } catch {
      setPosts([])
    }
  }, [showAdd])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
  }, [posts, query])

  const onPublish = (post: PublishedPost) => {
    setPosts(prev => [...prev, post])
    setShowAdd(false)
  }

  if (showAdd) return <AddPostPage onPublish={onPublish} />
  return (
    <div className="list-page">
      <div className="list-header">
        <div className="header-left-mid">
          <h2 className="list-title">Posts</h2>
          <div className="search-wrapper">
            <div className="search-field search-content">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                id="search"
                className="search-input"
                type="search"
                placeholder="Search posts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* divider that spans the search row and ends at the New Post button edge */}
        <div className="header-divider" aria-hidden />
    <div className="header-actions">
      <button className="new-post-btn" onClick={() => setShowAdd(true)}>New Post</button>
    </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No posts yet. Add your first content with the form above.</p>
        </div>
      ) : (
        <div className="items-list">
          {filtered.map(p => (
            <div key={p.id} className="item-row">
              <div style={{flex:1}}>
                <h3 className="item-title">{p.title}</h3>
                <p className="item-excerpt">{p.description}</p>
                <p className="item-excerpt" style={{marginTop:6, fontSize:12, color:'#9aa0a6'}}>Published {new Date(p.publishedAt).toLocaleString()}</p>
              </div>
              <div className="item-actions" aria-label="Post actions">
                <button
                  type="button"
                  className="item-action-btn"
                  title="Edit"
                  aria-label="Edit post"
                  onClick={() => alert('Edit coming soon')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M14.0517 3.73916L15.4575 2.33249C15.7506 2.03943 16.148 1.87479 16.5625 1.87479C16.977 1.87479 17.3744 2.03943 17.6675 2.33249C17.9606 2.62556 18.1252 3.02304 18.1252 3.43749C18.1252 3.85195 17.9606 4.24943 17.6675 4.54249L5.69333 16.5167C5.25277 16.957 4.70947 17.2806 4.1125 17.4583L1.875 18.125L2.54167 15.8875C2.7194 15.2905 3.04303 14.7472 3.48333 14.3067L14.0525 3.73916H14.0517ZM14.0517 3.73916L16.25 5.93749" stroke="#71717B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className="item-action-btn"
                  title="Delete"
                  aria-label="Delete post"
                  onClick={() => {
                    if (!confirm('Delete this post?')) return
                    try {
                      const raw = localStorage.getItem('posts')
                      const list: PublishedPost[] = raw ? JSON.parse(raw) : []
                      const next = list.filter(x => x.id !== p.id)
                      localStorage.setItem('posts', JSON.stringify(next))
                    } catch {}
                    setPosts(prev => prev.filter(x => x.id !== p.id))
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M2.66602 4.66635H13.3327" stroke="#71717B" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6.66736 7.33301V11.333" stroke="#71717B" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9.33337 7.33301V11.333" stroke="#71717B" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3.33398 4.66699L4.00065 12.667C4.00065 13.4034 4.5976 14.0003 5.33398 14.0003H10.6673C11.4037 14.0003 12.0007 13.4034 12.0007 12.667L12.6673 4.66699" stroke="#71717B" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 4.66667V2.66667C6 2.29848 6.29848 2 6.66667 2H9.33333C9.70152 2 10 2.29848 10 2.66667V4.66667" stroke="#71717B" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
