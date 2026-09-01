import './brand.css'

/**
 * The wordmark sits next to `/nixlabs-mark.svg` (also the favicon) so there is
 * exactly one drawing of the flask anywhere in the app.
 */
export function BrandLockup({ compact = false }: { readonly compact?: boolean }) {
  return (
    <span className="nx-brand" data-compact={compact ? 'true' : undefined}>
      <img className="nx-brand-mark" src="/nixlabs-mark.svg" alt="" width={72} height={48} />
      <span className="nx-brand-word">
        <strong>Nixlabs</strong>
        {!compact && <span className="nx-brand-suffix">Games</span>}
      </span>
    </span>
  )
}
