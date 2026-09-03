import { useState, useEffect, type FormEvent } from 'react'
import type { ReleaseAggregate, UpdateReleaseMetaInput } from '../../../engine/updates/types'
import { AuthorPicker } from '../../../components/ui/author-picker'

interface ReleaseMetaFormProps {
  readonly release: ReleaseAggregate
  readonly onSave: (patch: UpdateReleaseMetaInput) => Promise<void>
}

export function ReleaseMetaForm({ release, onSave }: ReleaseMetaFormProps) {
  const [globalVersion, setGlobalVersion] = useState(release.meta.globalVersion)
  const [title, setTitle] = useState(release.meta.title)
  const [headline, setHeadline] = useState(release.meta.headline)
  const [releaseDate, setReleaseDate] = useState(release.meta.releaseDate)
  const [authorUsername, setAuthorUsername] = useState(release.meta.authorUsername ?? '')
  const [isAuthorValid, setIsAuthorValid] = useState(true)
  const [status, setStatus] = useState(release.meta.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setGlobalVersion(release.meta.globalVersion)
    setTitle(release.meta.title)
    setHeadline(release.meta.headline)
    setReleaseDate(release.meta.releaseDate)
    setAuthorUsername(release.meta.authorUsername ?? '')
    setIsAuthorValid(true)
    setStatus(release.meta.status)
  }, [release.meta])

  const headlineLength = headline.length
  const isHeadlineOverLimit = headlineLength > 80

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isHeadlineOverLimit) {
      setError('Headline cannot exceed 80 characters.')
      return
    }
    if (!isAuthorValid) {
      setError('Please select a valid author from the search list (unselected authors are invalid).')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await onSave({
        globalVersion: globalVersion.trim(),
        title: title.trim(),
        headline: headline.trim(),
        releaseDate: releaseDate.trim(),
        authorUsername: authorUsername.trim() || undefined,
        status,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="nx-admin-form" onSubmit={handleSubmit}>
      <div className="nx-admin-form-grid">
        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-global-version">
            Global Version <span className="nx-required">*</span>
          </label>
          <input
            id="nx-global-version"
            className="nx-form-input"
            type="text"
            placeholder="e.g. 0.3.0"
            value={globalVersion}
            onChange={(e) => setGlobalVersion(e.target.value)}
            required
          />
        </div>

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-release-date">
            Release Date <span className="nx-required">*</span>
          </label>
          <input
            id="nx-release-date"
            className="nx-form-input"
            type="text"
            placeholder="e.g. September 3, 2026"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            required
          />
        </div>

        <AuthorPicker
          initialUsername={authorUsername}
          onChange={(user, isValid) => {
            setAuthorUsername(user?.username ?? '')
            setIsAuthorValid(isValid)
          }}
          label="Author Attribution"
        />

        <div className="nx-form-group">
          <label className="nx-form-label" htmlFor="nx-release-status">
            Release Status
          </label>
          <select
            id="nx-release-status"
            className="nx-form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as ReleaseAggregate['meta']['status'])}
          >
            <option value="draft">Draft (Work in progress)</option>
            <option value="review">Review (Pending approval)</option>
            <option value="published">Published (Live to players)</option>
            <option value="archived">Archived (Retired)</option>
          </select>
        </div>
      </div>

      <div className="nx-form-group nx-full-width">
        <label className="nx-form-label" htmlFor="nx-release-title">
          Release Title <span className="nx-required">*</span>
        </label>
        <input
          id="nx-release-title"
          className="nx-form-input"
          type="text"
          placeholder="e.g. Hazard Dissolve Mechanics & Staff Verification"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="nx-form-group nx-full-width">
        <div className="nx-label-row">
          <label className="nx-form-label" htmlFor="nx-release-headline">
            Top Banner Headline <span className="nx-required">*</span>
          </label>
          <span
            className="nx-char-counter"
            data-over-limit={isHeadlineOverLimit ? 'true' : undefined}
          >
            {headlineLength} / 80 characters max
          </span>
        </div>
        <input
          id="nx-release-headline"
          className="nx-form-input"
          type="text"
          placeholder="Max 80-char CTA summary for top banner"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          required
          maxLength={90}
        />
      </div>

      {error && <div className="nx-form-error">⚠️ {error}</div>}
      {success && <div className="nx-form-success">✅ Release metadata saved successfully!</div>}

      <div className="nx-form-actions">
        <button type="submit" className="nx-btn nx-btn-primary" disabled={saving || isHeadlineOverLimit}>
          {saving ? 'Saving...' : 'Update Release Metadata'}
        </button>
      </div>
    </form>
  )
}
