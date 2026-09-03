import { useMemo } from 'react'
import './markdown-renderer.css'

interface MarkdownRendererProps {
  readonly content: string
  readonly className?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const htmlParts: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockLines: string[] = []
  let inTable = false
  let tableHeaderParsed = false
  let inList: 'ul' | 'ol' | null = null
  let inCallout = false
  let inQuote = false

  function closeList() {
    if (inList) {
      htmlParts.push(`</${inList}>`)
      inList = null
    }
  }

  function closeTable() {
    if (inTable) {
      htmlParts.push(`</table></div>`)
      inTable = false
      tableHeaderParsed = false
    }
  }

  function closeCallout() {
    if (inCallout) {
      htmlParts.push('</div>')
      inCallout = false
    }
  }

  function closeQuote() {
    if (inQuote) {
      htmlParts.push('</blockquote>')
      inQuote = false
    }
  }

  function closeAllBlocks() {
    closeList()
    closeTable()
    closeCallout()
    closeQuote()
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!
    const trimmed = rawLine.trim()

    // 1. Code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        closeAllBlocks()
        inCodeBlock = true
        codeBlockLang = trimmed.slice(3).trim()
        codeBlockLines = []
      } else {
        inCodeBlock = false
        const codeContent = escapeHtml(codeBlockLines.join('\n'))
        htmlParts.push(
          `<pre class="nx-md-code-block"><code class="language-${escapeHtml(codeBlockLang)}">${codeContent}</code></pre>`,
        )
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine)
      continue
    }

    // 2. Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList()
      closeCallout()
      closeQuote()
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())

      if (!inTable) {
        inTable = true
        tableHeaderParsed = false
        htmlParts.push('<div class="nx-md-table-wrapper"><table class="nx-md-table">')
      }

      // Check if divider row like |---|---|
      const isDivider = cells.every((c) => /^:?-+:?$/.test(c))
      if (isDivider) {
        tableHeaderParsed = true
        continue
      }

      if (!tableHeaderParsed) {
        const row = `<thead><tr>${cells.map((c) => `<th>${parseInline(c)}</th>`).join('')}</tr></thead><tbody>`
        htmlParts.push(row)
      } else {
        const row = `<tr>${cells.map((c) => `<td>${parseInline(c)}</td>`).join('')}</tr>`
        htmlParts.push(row)
      }
      continue
    } else {
      closeTable()
    }

    // 3. Blank line: terminates lists, callouts, and blockquotes
    if (trimmed.length === 0) {
      closeList()
      closeCallout()
      closeQuote()
      continue
    }

    // 4. Horizontal rule
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      closeAllBlocks()
      htmlParts.push('<hr class="nx-md-hr" />')
      continue
    }

    // 5. Headings
    if (trimmed.startsWith('### ')) {
      closeAllBlocks()
      htmlParts.push(`<h3 class="nx-md-h3">${parseInline(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeAllBlocks()
      htmlParts.push(`<h2 class="nx-md-h2">${parseInline(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('# ')) {
      closeAllBlocks()
      htmlParts.push(`<h1 class="nx-md-h1">${parseInline(trimmed.slice(2))}</h1>`)
      continue
    }

    // 6. Alert Callouts (> [!NOTE], > [!WARNING], > [!TIP], > [!IMPORTANT])
    if (trimmed.startsWith('> [!')) {
      closeAllBlocks()
      const kindMatch = trimmed.match(/^> \[!(NOTE|WARNING|TIP|IMPORTANT)\]/i)
      const kind = (kindMatch?.[1] ?? 'NOTE').toLowerCase()
      inCallout = true
      htmlParts.push(`<div class="nx-md-callout" data-callout="${kind}"><strong class="nx-md-callout-title">${kind.toUpperCase()}</strong>`)
      continue
    }

    // Callout content continuation (either lines starting with '>' or lazy lines until next blank line)
    if (inCallout) {
      closeList()
      closeQuote()
      if (trimmed.startsWith('> ')) {
        htmlParts.push(`<p class="nx-md-p">${parseInline(trimmed.slice(2))}</p>`)
      } else if (trimmed === '>') {
        // empty blockquote spacer inside callout
      } else {
        htmlParts.push(`<p class="nx-md-p">${parseInline(trimmed)}</p>`)
      }
      continue
    }

    // 7. Blockquotes (> ...)
    if (trimmed.startsWith('> ') || trimmed === '>') {
      closeList()
      if (!inQuote) {
        inQuote = true
        htmlParts.push('<blockquote class="nx-md-quote">')
      }
      if (trimmed !== '>') {
        htmlParts.push(`<p class="nx-md-p">${parseInline(trimmed.slice(2))}</p>`)
      }
      continue
    } else if (inQuote) {
      closeQuote()
    }

    // 8. Lists
    const taskMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      closeCallout()
      closeQuote()
      if (inList !== 'ul') {
        closeList()
        inList = 'ul'
        htmlParts.push('<ul class="nx-md-list nx-md-task-list">')
      }
      const checked = taskMatch[1]!.toLowerCase() === 'x'
      htmlParts.push(
        `<li class="nx-md-task-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled /> <span>${parseInline(taskMatch[2]!)}</span></li>`,
      )
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      closeCallout()
      closeQuote()
      if (inList !== 'ul') {
        closeList()
        inList = 'ul'
        htmlParts.push('<ul class="nx-md-list">')
      }
      htmlParts.push(`<li>${parseInline(bulletMatch[1]!)}</li>`)
      continue
    }

    const numMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (numMatch) {
      closeCallout()
      closeQuote()
      if (inList !== 'ol') {
        closeList()
        inList = 'ol'
        htmlParts.push('<ol class="nx-md-list">')
      }
      htmlParts.push(`<li>${parseInline(numMatch[1]!)}</li>`)
      continue
    }

    closeList()
    closeCallout()
    closeQuote()

    // 9. Video or Audio embedding shortcut
    if (trimmed.startsWith('<video') || trimmed.startsWith('<audio')) {
      htmlParts.push(`<div class="nx-md-media-player">${trimmed}</div>`)
      continue
    }

    // 10. Standard Paragraph
    htmlParts.push(`<p class="nx-md-p">${parseInline(trimmed)}</p>`)
  }

  closeAllBlocks()

  return htmlParts.join('')
}

function parseInline(text: string): string {
  let result = escapeHtml(text)

  // Images: ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="nx-md-img" src="$2" alt="$1" loading="lazy" />')

  // Links: [label](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="nx-md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Bold + Italic: ***text***
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')

  // Bold: **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Italic: *text*
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Strikethrough: ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // Highlight: ==text== or &lt;mark&gt;text&lt;/mark&gt;
  result = result.replace(/==([^=]+)==/g, '<mark class="nx-md-mark">$1</mark>')
  result = result.replace(/&lt;mark&gt;([\s\S]*?)&lt;\/mark&gt;/g, '<mark class="nx-md-mark">$1</mark>')

  // Inline Code: `code`
  result = result.replace(/`([^`]+)`/g, '<code class="nx-md-inline-code">$1</code>')

  // Nixlabs Domain Tags: [tag:Balance], [tag:New], etc.
  result = result.replace(/\[tag:(Balance|New|Fix|Feature|Polish)\]/g, '<span class="nx-change-tag" data-tag="$1">$1</span>')

  // Game Slugs: @avoid-the-spikes, @fl-tron-3, @pong, @platform
  result = result.replace(/@(avoid-the-spikes|fl-tron-3|pong|platform)/g, '<span class="nx-md-game-pill">@$1</span>')

  // Stat deltas: [delta:+15%], [delta:-15%], [delta:-2.0s]
  result = result.replace(/\[delta:([^\]]+)\]/g, (_match, rawDelta) => {
    const delta = rawDelta.trim()
    const isNegative = delta.startsWith('-') || delta.startsWith('−') || delta.startsWith('–')
    const polarity = isNegative ? 'negative' : 'positive'
    return `<span class="nx-md-stat-delta nx-md-stat-delta-${polarity}" data-polarity="${polarity}">${delta}</span>`
  })

  return result
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const html = useMemo(() => parseMarkdownToHtml(content), [content])

  return (
    <div
      className={`nx-markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
