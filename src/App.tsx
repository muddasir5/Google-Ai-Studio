import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, GeminiResponse } from './types'
import { sendChatMessage } from './api'
import './App.css'

type ThinkingLevel = 'low' | 'medium' | 'high'

const SUGGESTIONS = [
  { icon: 'trending_up', label: 'What are the latest AI breakthroughs this week?', search: true },
  { icon: 'science', label: 'Explain quantum entanglement like I am 12', search: false },
  { icon: 'public', label: 'What happened in world news today?', search: true },
  { icon: 'lightbulb', label: 'Give me 5 creative startup ideas using AI agents', search: false },
]

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useSearch, setUseSearch] = useState(true)
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium')
  const [showThoughts, setShowThoughts] = useState<Record<string, boolean>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const toggleThoughts = (id: string) => {
    setShowThoughts(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSend = async (promptText?: string) => {
    const prompt = (promptText ?? input).trim()
    if (!prompt || loading) return

    setInput('')
    setError(null)

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      content: m.content,
    }))

    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const data: GeminiResponse = await sendChatMessage(prompt, history, { useSearch, thinkingLevel })

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: data.text || '(No text response)',
        thoughts: data.thoughts || '',
        grounding: data.groundingMetadata,
        usage: data.usageMetadata,
        model: data.model,
        timestamp: Date.now(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setError(null)
    setShowThoughts({})
    setSidebarOpen(false)
  }

  const renderMarkdownLite = (text: string): string => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')

    html = '<p>' + html + '</p>'
    html = html.replace(/<p><\/p>/g, '')
    return html
  }

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <svg viewBox="0 0 100 100" width="32" height="32">
              <circle cx="50" cy="50" r="45" fill="var(--primary)" />
              <path d="M50 25 L55 45 L75 50 L55 55 L50 75 L45 55 L25 50 L45 45 Z" fill="#fff" />
            </svg>
            <span>Gemini Assistant</span>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          New Chat
        </button>

        <div className="sidebar-section">
          <div className="sidebar-label">Search Grounding</div>
          <label className="toggle-row">
            <span>Use Google Search</span>
            <button
              className={`toggle ${useSearch ? 'on' : ''}`}
              onClick={() => setUseSearch(!useSearch)}
              role="switch"
              aria-checked={useSearch}
            >
              <span className="toggle-knob" />
            </button>
          </label>
          {useSearch && (
            <div className="badge-info">Responses will include web sources</div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Thinking Level</div>
          <div className="thinking-options">
            {(['low', 'medium', 'high'] as ThinkingLevel[]).map(level => (
              <button
                key={level}
                className={`thinking-btn ${thinkingLevel === level ? 'active' : ''}`}
                onClick={() => setThinkingLevel(level)}
              >
                {level === 'low' && 'Quick'}
                {level === 'medium' && 'Balanced'}
                {level === 'high' && 'Deep'}
              </button>
            ))}
          </div>
          <div className="badge-info">
            {thinkingLevel === 'low' && 'Fast responses, minimal reasoning'}
            {thinkingLevel === 'medium' && 'Moderate thinking before answering'}
            {thinkingLevel === 'high' && 'Extended reasoning for complex questions'}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="model-info">
            <div className="model-name">Gemini 2.5 Flash</div>
            <div className="model-sub">Grounded with Google Search</div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="header">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className="header-title">
            <svg viewBox="0 0 100 100" width="24" height="24">
              <circle cx="50" cy="50" r="45" fill="var(--primary)" />
              <path d="M50 25 L55 45 L75 50 L55 55 L50 75 L45 55 L25 50 L45 45 Z" fill="#fff" />
            </svg>
            <span>Gemini Search Assistant</span>
          </div>
          <div className="header-actions">
            <button
              className={`header-toggle ${useSearch ? 'active' : ''}`}
              onClick={() => setUseSearch(!useSearch)}
              title="Toggle Google Search grounding"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <span>Search</span>
            </button>
          </div>
        </header>

        <div className="chat-container" ref={scrollRef}>
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg viewBox="0 0 100 100" width="64" height="64">
                  <circle cx="50" cy="50" r="45" fill="var(--primary)" />
                  <path d="M50 25 L55 45 L75 50 L55 55 L50 75 L45 55 L25 50 L45 45 Z" fill="#fff" />
                </svg>
              </div>
              <h1>What can I help you with?</h1>
              <p className="empty-sub">Powered by Gemini 2.5 Flash with Google Search grounding</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="suggestion-card"
                    onClick={() => {
                      setUseSearch(s.search)
                      handleSend(s.label)
                    }}
                  >
                    <div className="suggestion-icon">
                      {s.icon === 'trending_up' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m23 6-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>}
                      {s.icon === 'science' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3v6l-5 9a3 3 0 0 0 3 4h10a3 3 0 0 0 3-4l-5-9V3" /><path d="M7 3h10" /></svg>}
                      {s.icon === 'public' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>}
                      {s.icon === 'lightbulb' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.3.3.5.7.5 1.1V17h7v-1.2c0-.4.2-.8.5-1.1A7 7 0 0 0 12 2z" /></svg>}
                    </div>
                    <span>{s.label}</span>
                    {s.search && <span className="suggestion-badge">Search</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                ) : (
                  <svg viewBox="0 0 100 100" width="22" height="22">
                    <circle cx="50" cy="50" r="45" fill="var(--primary)" />
                    <path d="M50 25 L55 45 L75 50 L55 55 L50 75 L45 55 L25 50 L45 45 Z" fill="#fff" />
                  </svg>
                )}
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <span className="message-role">{msg.role === 'user' ? 'You' : 'Gemini'}</span>
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>

                {msg.role === 'assistant' && msg.thoughts && (
                  <div className="thoughts-section">
                    <button className="thoughts-toggle" onClick={() => toggleThoughts(msg.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-4 12.7c.3.3.5.7.5 1.1V17h7v-1.2c0-.4.2-.8.5-1.1A7 7 0 0 0 12 2z" /></svg>
                      {showThoughts[msg.id] ? 'Hide' : 'Show'} reasoning
                      <svg className={`chevron ${showThoughts[msg.id] ? 'up' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                    {showThoughts[msg.id] && (
                      <div className="thoughts-content">{msg.thoughts}</div>
                    )}
                  </div>
                )}

                <div
                  className="message-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownLite(msg.content) }}
                />

                {msg.role === 'assistant' && msg.grounding && msg.grounding.groundingChunks.length > 0 && (
                  <div className="grounding-section">
                    <div className="grounding-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>
                      Sources
                    </div>
                    <div className="grounding-chips">
                      {msg.grounding.groundingChunks.map((chunk, i) => (
                        chunk.uri && (
                          <a
                            key={i}
                            href={chunk.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grounding-chip"
                            title={chunk.title || chunk.uri}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                            <span>{chunk.title || new URL(chunk.uri).hostname}</span>
                          </a>
                        )
                      ))}
                    </div>
                    {msg.grounding.webSearchQueries.length > 0 && (
                      <div className="search-queries">
                        <span className="queries-label">Searched for:</span>
                        {msg.grounding.webSearchQueries.map((q, i) => (
                          <span key={i} className="query-tag">{q}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg.role === 'assistant' && msg.usage && (
                  <div className="usage-bar">
                    {msg.usage.thoughtsTokenCount != null && <span>Thoughts: {msg.usage.thoughtsTokenCount}</span>}
                    {msg.usage.promptTokenCount != null && <span>Prompt: {msg.usage.promptTokenCount}</span>}
                    {msg.usage.candidatesTokenCount != null && <span>Response: {msg.usage.candidatesTokenCount}</span>}
                    {msg.usage.totalTokenCount != null && <span>Total: {msg.usage.totalTokenCount}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant loading-message">
              <div className="message-avatar">
                <svg viewBox="0 0 100 100" width="22" height="22">
                  <circle cx="50" cy="50" r="45" fill="var(--primary)" />
                  <path d="M50 25 L55 45 L75 50 L55 55 L50 75 L45 55 L25 50 L45 45 Z" fill="#fff" />
                </svg>
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <span className="message-role">Gemini</span>
                </div>
                <div className="typing-indicator">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              <span>{error}</span>
              <button className="error-dismiss" onClick={() => setError(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <button
              className={`input-search-toggle ${useSearch ? 'active' : ''}`}
              onClick={() => setUseSearch(!useSearch)}
              title="Toggle Google Search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Gemini anything..."
              rows={1}
              disabled={loading}
            />
            <button
              className="send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              {loading ? (
                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
              )}
            </button>
          </div>
          <div className="input-footer">
            <span>Gemini may produce inaccurate information about people, places, or facts</span>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
