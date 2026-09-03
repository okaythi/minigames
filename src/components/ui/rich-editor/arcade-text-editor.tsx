import { useState, useRef, useId, type ChangeEvent } from 'react'
import { MarkdownRenderer } from './markdown-renderer'
import './arcade-text-editor.css'

export interface ArcadeTextEditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly maxChars?: number
  readonly label?: string
  readonly minHeight?: number
  readonly showMediaUpload?: boolean
}

type EditorTab = 'edit' | 'split' | 'preview'

export function ArcadeTextEditor({
  value,
  onChange,
  placeholder = 'Write update content with markdown...',
  maxChars,
  label,
  minHeight = 160,
  showMediaUpload = true,
}: ArcadeTextEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('edit')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const imageInputId = useId()
  const videoInputId = useId()
  const audioInputId = useId()

  const charCount = value.length
  const wordCount = value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length
  const isOverLimit = maxChars !== undefined && charCount > maxChars

  const insertText = (before: string, after = '', defaultPlaceholder = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end)
    const content = selected || defaultPlaceholder
    const nextValue = value.slice(0, start) + before + content + after + value.slice(end)

    onChange(nextValue)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + content.length,
      )
    }, 0)
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio') => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/updates/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      if (type === 'image') {
        insertText(`![${file.name}](${data.url})`, '')
      } else if (type === 'video') {
        insertText(`\n<video controls src="${data.url}"></video>\n`, '')
      } else if (type === 'audio') {
        insertText(`\n<audio controls src="${data.url}"></audio>\n`, '')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Media upload failed'
      setUploadError(msg)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="nx-editor-container" data-over-limit={isOverLimit ? 'true' : undefined}>
      {label && (
        <div className="nx-editor-header">
          <label className="nx-editor-label">{label}</label>
          <div className="nx-editor-tabs">
            <button
              type="button"
              className="nx-editor-tab"
              data-active={activeTab === 'edit' ? 'true' : undefined}
              onClick={() => setActiveTab('edit')}
            >
              Write
            </button>
            <button
              type="button"
              className="nx-editor-tab"
              data-active={activeTab === 'split' ? 'true' : undefined}
              onClick={() => setActiveTab('split')}
            >
              Split
            </button>
            <button
              type="button"
              className="nx-editor-tab"
              data-active={activeTab === 'preview' ? 'true' : undefined}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {/* 25+ Button Formatting Toolbar */}
      <div className="nx-editor-toolbar" role="toolbar" aria-label="Text formatting tools">
        {/* Inline Typography */}
        <div className="nx-btn-group">
          <button type="button" className="nx-tb-btn" onClick={() => insertText('**', '**', 'bold text')} title="Bold (Ctrl+B)">
            <strong>B</strong>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('*', '*', 'italic text')} title="Italic (Ctrl+I)">
            <em>I</em>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('~~', '~~', 'struck text')} title="Strikethrough">
            <s>S</s>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('<mark>', '</mark>', 'highlight')} title="Highlight">
            <span style={{ background: '#ffd9a0', padding: '0 2px' }}>H</span>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('`', '`', 'code')} title="Inline Code">
            <code>&lt;/&gt;</code>
          </button>
        </div>

        {/* Headings */}
        <div className="nx-btn-group">
          <button type="button" className="nx-tb-btn" onClick={() => insertText('# ', '', 'Heading 1')} title="Heading 1">H1</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('## ', '', 'Heading 2')} title="Heading 2">H2</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('### ', '', 'Heading 3')} title="Heading 3">H3</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('> ', '', 'Quote block')} title="Quote / Rationale">”</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('\n---\n')} title="Horizontal Divider">—</button>
        </div>

        {/* Lists & Tasks */}
        <div className="nx-btn-group">
          <button type="button" className="nx-tb-btn" onClick={() => insertText('- ', '', 'List item')} title="Bullet List">• List</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('1. ', '', 'Numbered item')} title="Numbered List">1. List</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('- [ ] ', '', 'Task item')} title="Task Checkbox">☑ Todo</button>
        </div>

        {/* Code & Tables */}
        <div className="nx-btn-group">
          <button type="button" className="nx-tb-btn" onClick={() => insertText('```ts\n', '\n```', '// Code here')} title="Code Block">Codeblock</button>
          <button
            type="button"
            className="nx-tb-btn"
            onClick={() => insertText('\n| Column 1 | Column 2 |\n|---|---|\n| Value A | Value B |\n')}
            title="Insert Table"
          >
            Table
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('[', '](https://)', 'Link text')} title="Link">🔗 Link</button>
        </div>

        {/* Media Upload Buttons (R2 Connected) */}
        {showMediaUpload && (
          <div className="nx-btn-group">
            <label htmlFor={imageInputId} className="nx-tb-btn nx-upload-btn" title="Upload Image (any extension, <=30MB)">
              🖼️ Image (30MB)
            </label>
            <input
              id={imageInputId}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e, 'image')}
            />

            <label htmlFor={videoInputId} className="nx-tb-btn nx-upload-btn" title="Upload Video (mp4, <=80MB)">
              🎥 Video (80MB)
            </label>
            <input
              id={videoInputId}
              type="file"
              accept="video/mp4"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e, 'video')}
            />

            <label htmlFor={audioInputId} className="nx-tb-btn nx-upload-btn" title="Upload Audio (mp3, ogg, wav, <=10MB)">
              🎵 Audio (10MB)
            </label>
            <input
              id={audioInputId}
              type="file"
              accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e, 'audio')}
            />
          </div>
        )}

        {/* Nixlabs Engine Domain Tags */}
        <div className="nx-btn-group">
          <button type="button" className="nx-tb-btn" onClick={() => insertText('[tag:Balance]')} title="Tag: Balance">
            <span style={{ color: 'var(--nx-orange)' }}>Tag:Balance</span>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('[tag:New]')} title="Tag: New">
            <span style={{ color: 'var(--nx-green)' }}>Tag:New</span>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('[tag:Fix]')} title="Tag: Fix">
            <span style={{ color: 'var(--nx-blue)' }}>Tag:Fix</span>
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('[delta:+15%]')} title="Stat Delta">
            Δ+15%
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('> [!NOTE]\n> ')} title="Alert Callout">
            🔔 Note
          </button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('🕹️')} title="Arcade Icon">🕹️</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('🍬')} title="Candy">🍬</button>
          <button type="button" className="nx-tb-btn" onClick={() => insertText('⚡')} title="Lightning">⚡</button>
        </div>
      </div>

      {uploading && <div className="nx-editor-upload-status">⏳ Uploading media to Cloudflare R2...</div>}
      {uploadError && <div className="nx-editor-upload-error">⚠️ {uploadError}</div>}

      {/* Editor Body */}
      <div className="nx-editor-body" data-tab={activeTab}>
        {(activeTab === 'edit' || activeTab === 'split') && (
          <textarea
            ref={textareaRef}
            className="nx-editor-textarea"
            style={{ minHeight }}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {(activeTab === 'preview' || activeTab === 'split') && (
          <div className="nx-editor-preview-pane" style={{ minHeight }}>
            {value.trim().length === 0 ? (
              <span className="nx-preview-empty">Nothing to preview yet...</span>
            ) : (
              <MarkdownRenderer content={value} />
            )}
          </div>
        )}
      </div>

      {/* Footer Metrics */}
      <div className="nx-editor-footer">
        <span className="nx-metric-words">{wordCount} words</span>
        <span className="nx-metric-chars">
          {maxChars !== undefined ? (
            <strong style={{ color: isOverLimit ? 'var(--nx-red)' : charCount > maxChars * 0.85 ? 'var(--nx-orange)' : 'var(--nx-slate)' }}>
              {charCount} / {maxChars} max
            </strong>
          ) : (
            `${charCount} chars`
          )}
        </span>
      </div>
    </div>
  )
}
