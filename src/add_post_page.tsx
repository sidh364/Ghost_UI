import { useRef, useState, useCallback, useEffect } from 'react'
import './add_post_page.css'
import YoutubeEmbed from './components/YoutubeEmbed'
import type { YoutubeEmbedHandle } from './components/YoutubeEmbed'

export type PublishedPost = {
  id: string
  title: string
  description: string
  publishedAt: string
  coverUrl?: string | null
}

export default function AddPostPage({ onPublish }: { onPublish?: (post: PublishedPost) => void } = {}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorImageInputRef = useRef<HTMLInputElement | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [title, setTitle] = useState<string>('')
  type Block =
    | { id: string; type: 'paragraph'; text: string }
    | { id: string; type: 'divider' }
    | { id: string; type: 'youtube'; url: string; width?: number; height?: number }
  const [blocks, setBlocks] = useState<Block[]>([{ id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: 'paragraph', text: '' }])
  const [currentBlockId, setCurrentBlockId] = useState<string>(blocks[0].id)
  const [saveStatus, setSaveStatus] = useState<string>('Draft')
  const DRAFT_KEY = 'add_post_draft'
  const [showInsert, setShowInsert] = useState<boolean>(false)
  const plusRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const youtubeRefs = useRef<Record<string, YoutubeEmbedHandle | null>>({})

  // Remove a block by id and maintain a sensible focus target
  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const toRemove = prev[idx]
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)]
      if (toRemove.type === 'youtube') {
        delete youtubeRefs.current[id]
      }
      // Ensure at least one paragraph remains
      let result = next
      let focusId: string | undefined
      const hasParagraph = next.some(b => b.type === 'paragraph')
      if (!hasParagraph) {
        const newParaId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        result = [...next, { id: newParaId, type: 'paragraph', text: '' }]
        focusId = newParaId
      } else {
        // Prefer focusing a previous paragraph, else the next available paragraph
        for (let i = idx - 1; i >= 0; i--) {
          if (prev[i]?.type === 'paragraph') { focusId = prev[i].id; break }
        }
        if (!focusId) {
          for (let i = idx; i < next.length; i++) {
            if (next[i]?.type === 'paragraph') { focusId = next[i]!.id; break }
          }
        }
      }
      requestAnimationFrame(() => {
        if (focusId) {
          setCurrentBlockId(focusId)
          inputRefs.current[focusId]?.focus()
        }
      })
      return result
    })
  }, [])

  // Remove the selected cover image
  const removeCover = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }, [previewUrl])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    // clear the input so same file can be re-picked if needed
    e.currentTarget.value = ''
  }, [])

  // Handle editor image selection from the insert menu
  const onEditorImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    // Append token to current paragraph
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === currentBlockId)
      if (idx === -1) return prev
      const cur = prev[idx]
      if (cur.type !== 'paragraph') return prev
      const updated = { ...cur, text: cur.text ? `${cur.text} [image:${url}]` : `[image:${url}]` }
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
    })
    // clear input so same file can be selected again if needed
    e.currentTarget.value = ''
    // We won't revoke immediately; user might still reference the preview token.
    // In a real TipTap integration, the editor would manage the image node lifecycle and revoke when removed.
  }, [currentBlockId])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Load any saved draft on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null
      if (raw) {
        const data = JSON.parse(raw) as { title?: string; body?: string; blocks?: Block[] }
        if (typeof data.title === 'string') setTitle(data.title)
        if (Array.isArray(data.blocks) && data.blocks.length > 0) {
          setBlocks(data.blocks as Block[])
          const firstPara = (data.blocks as Block[]).find(b => b.type === 'paragraph') as Block | undefined
          if (firstPara && firstPara.type === 'paragraph') setCurrentBlockId(firstPara.id)
        } else if (typeof data.body === 'string') {
          // Fallback: hydrate into a single paragraph
          const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          setBlocks([{ id, type: 'paragraph', text: data.body }])
          setCurrentBlockId(id)
        }
        setSaveStatus('Draft-Saved')
      } else {
        setSaveStatus('Draft')
      }
    } catch {
      // ignore corrupted drafts
      console.warn('Failed to load draft from localStorage')
    }
  }, [])

  // Debounced autosave when title or blocks change
  useEffect(() => {
    // indicate saving in progress on any change
    setSaveStatus('Saving...')
    const handle = window.setTimeout(() => {
      try {
        const trimmedTitle = title.trim()
        const aggregated = blocks
          .map(b => (b.type === 'paragraph' ? b.text : ''))
          .join('\n')
          .trim()
        if (!trimmedTitle && !aggregated) {
          localStorage.removeItem(DRAFT_KEY)
          setSaveStatus('Draft')
          return
        }
        const payload = {
          title: title,
          body: aggregated,
          blocks: blocks,
          updatedAt: new Date().toISOString(),
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
        setSaveStatus('Draft-Saved')
      } catch {
        // storage may be unavailable; fail silently
        setSaveStatus('Draft')
      }
    }, 500)
    return () => window.clearTimeout(handle)
  }, [title, blocks])

  // Close the insert menu on outside click or ESC
  useEffect(() => {
    if (!showInsert) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (plusRef.current?.contains(target)) return
      setShowInsert(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowInsert(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showInsert])

  const onPlusClick = useCallback(() => {
    setShowInsert(v => !v)
  }, [])

  const onPublishClick = useCallback(() => {
    // Build a published post object
    const aggregated = blocks
      .map(b => (b.type === 'paragraph' ? b.text : ''))
      .join('\n')
      .trim()
    const trimmedTitle = title.trim()
    if (!trimmedTitle && !aggregated) {
      alert('Please add a title or some content before publishing.')
      return
    }
    const description = aggregated.length > 200 ? aggregated.slice(0, 200) + '…' : aggregated
    const post: PublishedPost = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: trimmedTitle || 'Untitled',
      description,
      publishedAt: new Date().toISOString(),
      coverUrl: previewUrl || null,
    }
    try {
      const raw = localStorage.getItem('posts')
      const posts: PublishedPost[] = raw ? JSON.parse(raw) : []
      const next = [...posts, post]
      localStorage.setItem('posts', JSON.stringify(next))
      // Clear the draft after successful publish
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore storage failures silently
    }
    // Notify parent (ListPage) if provided
    onPublish?.(post)
  }, [blocks, title, previewUrl, onPublish])

  const handleInsert = useCallback((type: string) => {
    setShowInsert(false)
    if (type === 'divider') {
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId)
        const newDivider: Block = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: 'divider' }
        if (idx === -1) {
          // fallback: append divider and a new empty paragraph at the end
          const newParaId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const newPara: Block = { id: newParaId, type: 'paragraph', text: '' }
          const next = [...prev, newDivider, newPara]
          requestAnimationFrame(() => {
            setCurrentBlockId(newParaId)
            inputRefs.current[newParaId]?.focus()
          })
          return next
        }
        const before = prev.slice(0, idx)
        const current = prev[idx]
        const after = prev.slice(idx + 1)
        if (current.type === 'paragraph' && current.text.trim().length > 0) {
          // Current has text: do not move it; insert divider after current, then a new empty paragraph
          const newParaId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const newPara: Block = { id: newParaId, type: 'paragraph', text: '' }
          const next = [...before, current, newDivider, newPara, ...after]
          requestAnimationFrame(() => {
            setCurrentBlockId(newParaId)
            inputRefs.current[newParaId]?.focus()
          })
          return next
        } else {
          // Current is empty (or not a paragraph): insert divider before it and keep focus on same input
          const next = [...before, newDivider, current, ...after]
          requestAnimationFrame(() => {
            setCurrentBlockId(current.id)
            if (current.type === 'paragraph') inputRefs.current[current.id]?.focus()
          })
          return next
        }
      })
      return
    }
    if (type === 'html') {
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId)
        if (idx === -1) return prev
        const cur = prev[idx]
        if (cur.type !== 'paragraph') return prev
        const updated = { ...cur, text: cur.text ? `${cur.text} <div></div>` : '<div></div>' }
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
      })
      return
    }
    if (type === 'image') {
      // Trigger hidden file input for image selection
      editorImageInputRef.current?.click()
      return
    }
    if (type === 'bookmark') {
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId)
        if (idx === -1) return prev
        const cur = prev[idx]
        if (cur.type !== 'paragraph') return prev
        const updated = { ...cur, text: cur.text ? `${cur.text} [bookmark]` : '[bookmark]' }
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
      })
      return
    }
    if (type === 'youtube') {
      const url = window.prompt('Enter YouTube URL') || ''
      if (!url) return
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId)
        if (idx === -1) return prev
        const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const yt: Block = { id: newId, type: 'youtube', url }
        // Insert after current paragraph (keep current in place), then add a new paragraph for continuing typing
        const newParaId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const newPara: Block = { id: newParaId, type: 'paragraph', text: '' }
        const before = prev.slice(0, idx + 1)
        const after = prev.slice(idx + 1)
        const next = [...before, yt, newPara, ...after]
        // Focus the new paragraph and add the video into the TipTap instance
        requestAnimationFrame(() => {
          setCurrentBlockId(newParaId)
          inputRefs.current[newParaId]?.focus()
          youtubeRefs.current[newId]?.addVideo(url)
        })
        return next
      })
      return
    }
    if (type === 'twitter') {
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId)
        if (idx === -1) return prev
        const cur = prev[idx]
        if (cur.type !== 'paragraph') return prev
        const updated = { ...cur, text: cur.text ? `${cur.text} https://twitter.com/.../status/...` : 'https://twitter.com/.../status/...' }
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
      })
      return
    }
    if (type === 'unsplash') {
      setBlocks(prev => {
        const idx = prev.findIndex(b => b.id === currentBlockId)
        if (idx === -1) return prev
        const cur = prev[idx]
        if (cur.type !== 'paragraph') return prev
        const updated = { ...cur, text: cur.text ? `${cur.text} [unsplash]` : '[unsplash]' }
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
      })
      return
    }
  }, [currentBlockId])

  const onParagraphKeyDown = useCallback((id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return
    const el = e.currentTarget
    const atStart = (el.selectionStart ?? 0) === 0 && (el.selectionEnd ?? 0) === 0
    if (!atStart) return
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const cur = prev[idx]
      // If previous block is a divider, remove that divider (existing behavior)
      if (idx > 0 && prev[idx - 1].type === 'divider') {
        e.preventDefault()
        const nextBlocks = [...prev.slice(0, idx - 1), ...prev.slice(idx)]
        // Keep focus on current paragraph id (which shifts up by one)
        requestAnimationFrame(() => {
          setCurrentBlockId(id)
          inputRefs.current[id]?.focus()
        })
        return nextBlocks
      }
      // If current paragraph is empty, remove it (but keep at least one paragraph overall)
      if (cur.type === 'paragraph' && cur.text.trim() === '') {
        const remainingParagraphs = prev.filter(b => b.type === 'paragraph' && b.id !== id)
        if (remainingParagraphs.length === 0) {
          // Don't remove the last paragraph block
          return prev
        }
        e.preventDefault()
        // Choose a focus target: previous paragraph if any, else next paragraph
        let focusId: string | undefined
        for (let i = idx - 1; i >= 0; i--) {
          if (prev[i].type === 'paragraph') { focusId = prev[i].id; break }
        }
        if (!focusId) {
          for (let i = idx + 1; i < prev.length; i++) {
            if (prev[i].type === 'paragraph') { focusId = prev[i].id; break }
          }
        }
        const nextBlocks = [...prev.slice(0, idx), ...prev.slice(idx + 1)]
        requestAnimationFrame(() => {
          if (focusId) {
            setCurrentBlockId(focusId)
            inputRefs.current[focusId]?.focus()
          }
        })
        return nextBlocks
      }
      return prev
    })
  }, [])

  const onParagraphChange = useCallback((id: string, value: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const cur = prev[idx]
      if (cur.type !== 'paragraph') return prev
      const updated = { ...cur, text: value }
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
    })
  }, [])

  return (
    <div className="add-post-page">
      <div className="add-header">
        <div className="add-header-left">
          <a href="/posts" className="back-link" aria-label="Back to posts">&lt; Posts</a>
          <div className="status">{saveStatus}</div>
        </div>
        <div className="add-header-actions">
          <button className="btn preview" type="button">Preview</button>
          <button className="btn publish" type="button" onClick={onPublishClick}>Publish</button>
        </div>
      </div>

  <div className="content-wrapper">
  <div className="cover-upload">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
  <button type="button" className={previewUrl ? 'upload-area has-preview' : 'upload-area'} aria-label="Upload post cover" onClick={openFilePicker}>
          <div className="upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="17" viewBox="0 0 20 17" fill="none" aria-hidden>
              <g clipPath="url(#clip0_1_583)">
                <path d="M13 13.5H16C16.7956 13.5 17.5587 13.1839 18.1213 12.6213C18.6839 12.0587 19 11.2957 19 10.5C19 9.70436 18.6839 8.9413 18.1213 8.37869C17.5587 7.81608 16.7956 7.50001 16 7.50001H15.975C15.9908 7.3338 15.9992 7.16697 16 7.00001C15.9962 5.67336 15.5131 4.39279 14.6396 3.39429C13.7661 2.39579 12.5611 1.74667 11.2467 1.56656C9.93236 1.38645 8.59718 1.68749 7.48727 2.41419C6.37736 3.14089 5.56752 4.24428 5.207 5.52101C5.137 5.51701 5.071 5.50001 5 5.50001C3.93913 5.50001 2.92172 5.92144 2.17157 6.67158C1.42143 7.42173 1 8.43914 1 9.50001C1 10.5609 1.42143 11.5783 2.17157 12.3284C2.92172 13.0786 3.93913 13.5 5 13.5H7.167M10 15.5V6.50001M10 6.50001L8 8.50001M10 6.50001L12 8.50001" stroke="#6A7282" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
              <defs>
                <clipPath id="clip0_1_583">
                  <rect width="20" height="16" fill="white" transform="translate(0 0.5)"/>
                </clipPath>
              </defs>
            </svg>
          </div>
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Cover preview" className="upload-preview" />
              <button
                type="button"
                className="remove-cover-btn"
                aria-label="Remove cover image"
                onClick={(e) => { e.stopPropagation(); removeCover() }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </>
          ) : (
            <div className="upload-text">Click to upload post cover or drag and drop<br/>SVG, PNG, JPG or GIF. MAX: 2000x1200px</div>
          )}
        </button>
      </div>

  <input
        className="title-input"
        aria-label="Post title"
        placeholder="Post title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="title-underline" />

      <div className="editor-row">
          {/* hidden file input for inserting images into the editor */}
          <input
            ref={editorImageInputRef}
            type="file"
            accept="image/*"
            onChange={onEditorImageChange}
            style={{ display: 'none' }}
          />
          <button ref={plusRef} type="button" className="plus-circle" aria-label="Insert" onClick={onPlusClick}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <path d="M11 4.125V17.875M17.875 11H4.125" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
          {showInsert && (
            <div ref={menuRef} className="insert-menu" role="menu" aria-label="Insert menu">
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('image')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20Z" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Photo</span>
              </button>
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('html')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M10 20L14 4M18 8L22 12L18 16M6 16L2 12L6 8" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>HTML</span>
              </button>
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('divider')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20 12H4" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Divider</span>
              </button>
              <div className="insert-separator" />
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('bookmark')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21L12 17.5L5 21V5Z" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Bookmark</span>
              </button>
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('youtube')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M14.752 11.1681L11.555 9.03607C11.4043 8.9355 11.229 8.87778 11.048 8.86907C10.867 8.86037 10.687 8.90102 10.5274 8.98667C10.3677 9.07232 10.2342 9.19975 10.1414 9.35535C10.0485 9.51095 9.99961 9.68886 10 9.87007V14.1331C9.99998 14.3141 10.0491 14.4918 10.1421 14.6471C10.2352 14.8024 10.3686 14.9295 10.5282 15.0149C10.6879 15.1004 10.8677 15.1408 11.0485 15.132C11.2293 15.1233 11.4044 15.0656 11.555 14.9651L14.752 12.8331C14.889 12.7417 15.0013 12.618 15.0789 12.4729C15.1566 12.3278 15.1972 12.1657 15.1972 12.0011C15.1972 11.8365 15.1566 11.6744 15.0789 11.5293C15.0013 11.3841 14.889 11.2594 14.752 11.1681Z" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.3869 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12Z" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Youtube</span>
              </button>
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('twitter')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M19 11C19 12.8565 18.2625 14.637 16.9497 15.9497C15.637 17.2625 13.8565 18 12 18M12 18C10.1435 18 8.36301 17.2625 7.05025 15.9497C5.7375 14.637 5 12.8565 5 11M12 18V22M12 22H8M12 22H16M12 14C11.2044 14 10.4413 13.6839 9.87868 13.1213C9.31607 12.5587 9 11.7956 9 11V5C9 4.20435 9.31607 3.44129 9.87868 2.87868C10.4413 2.31607 11.2044 2 12 2C12.7956 2 13.5587 2.31607 14.1213 2.87868C14.6839 3.44129 15 4.20435 15 5V11C15 11.7956 14.6839 12.5587 14.1213 13.1213C13.5587 13.6839 12.7956 14 12 14Z" stroke="black" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Twitter</span>
              </button>
              <button className="insert-item" role="menuitem" onClick={() => handleInsert('unsplash')}>
                <span className="icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <g clipPath="url(#clip0_1_532)">
                      <path d="M16.4391 10.6168V17.3084H7.56089V10.6168H0V24H24V10.6168H16.4391ZM7.56089 0H16.4411V6.69161H7.56089V0Z" fill="black"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_1_532">
                        <rect width="24" height="24" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                </span>
                <span>Unsplash</span>
              </button>
            </div>
          )}
        <div className="editor-col">
          {blocks.map((block, idx) => (
            <div key={block.id} className="block-row">
              {block.type === 'paragraph' ? (
                <input
                  ref={(el) => { inputRefs.current[block.id] = el }}
                  className="editor-placeholder-input"
                  aria-label="Post body"
                  placeholder={idx === 0 ? 'Begin writing your post...' : 'Continue writing...'}
                  value={block.text}
                  onChange={(e) => onParagraphChange(block.id, e.target.value)}
                  onKeyDown={(e) => onParagraphKeyDown(block.id, e)}
                  onFocus={() => setCurrentBlockId(block.id)}
                />
              ) : block.type === 'divider' ? (
                <div className="editor-divider" />
              ) : (
                <div className="youtube-wrapper">
                  <YoutubeEmbed ref={(inst) => { youtubeRefs.current[block.id] = inst }} />
                  <button
                    type="button"
                    className="youtube-remove-btn"
                    aria-label="Remove video"
                    onClick={() => removeBlock(block.id)}
                    title="Remove"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
              {block.type !== 'youtube' && (
                <button
                  type="button"
                  className="remove-block-btn"
                  aria-label="Remove block"
                  onClick={() => removeBlock(block.id)}
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
