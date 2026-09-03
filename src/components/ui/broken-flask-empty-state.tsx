import './broken-flask-empty-state.css'

interface BrokenFlaskEmptyStateProps {
  readonly message?: string
  readonly subtitle?: string
}

export function BrokenFlaskEmptyState({
  message = 'nothing to see here yet',
  subtitle = 'No update notes or patch releases have been published yet.',
}: BrokenFlaskEmptyStateProps) {
  return (
    <div className="nx-broken-flask-container" role="status">
      <div className="nx-broken-flask-graphic" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 96 64"
          fill="none"
          className="nx-broken-flask-svg"
        >
          <defs>
            <linearGradient id="nxl-broken-liquid" x1="16" y1="36" x2="42" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FBAD41" />
              <stop offset="100%" stopColor="#F6821F" />
            </linearGradient>
            <clipPath id="nxl-broken-flask-base">
              <path d="M12 42 L22 42 L24 49 L34 47 L36 53 Q33 56 28 56 H16 Q11 56 10 50 Z" />
            </clipPath>
          </defs>

          {/* Severed wire with jagged gap */}
          <path
            d="M34 10 C39 7 43 9 46 14"
            stroke="#404041"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Frayed wire spark dots */}
          <circle cx="47.5" cy="16.5" r="1.2" fill="#F6821F" />
          <path
            d="M52 23 C53.5 24 55 26 57 28"
            stroke="#404041"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="2 2"
          />

          {/* Spilled liquid puddle on table surface */}
          <path
            d="M6 55 Q9 52 18 52 T34 53 Q42 54 46 56 Q40 60 26 60 Q12 60 6 55 Z"
            fill="url(#nxl-broken-liquid)"
            opacity="0.9"
          />
          {/* Spilled droplet splashes */}
          <circle cx="5" cy="53" r="1.6" fill="#F6821F" />
          <circle cx="48" cy="55" r="2.0" fill="#FBAD41" />
          <circle cx="53" cy="57" r="1.3" fill="#FFD9A0" />
          <circle cx="21" cy="57" r="1.4" fill="#FFD9A0" />
          <circle cx="31" cy="56" r="1.8" fill="#FFD9A0" />

          {/* Lower fractured flask shard */}
          <path
            d="M10 50 Q7.8 45.5 12 40 L19 28 L23 34 L28 29 L32 37 L38 43 Q41 49 37 54 L35 55 Q33.5 56.5 28 56.5 H16.5 Q12 56.5 10 50 Z"
            stroke="#404041"
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="#FFFDF9"
          />

          {/* Liquid remnant in lower shard */}
          <path
            d="M11 48 Q10.5 45 13 43 L21 44 L25 41 L30 45 L36 47 Q37.5 52 34 55 H16 Q12 55 11 48 Z"
            fill="url(#nxl-broken-liquid)"
          />
          <circle cx="17" cy="50" r="1.5" fill="#FFD9A0" />
          <circle cx="27" cy="49" r="1.2" fill="#FFD9A0" />

          {/* Fractured crack lines */}
          <path
            d="M20 31 L24 37 L21 42 M28 32 L26 39 L29 44"
            stroke="#404041"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Upper dislodged neck shard, tilted to the left */}
          <g transform="translate(1, -2) rotate(-14 24 16)">
            {/* Neck rim */}
            <path d="M19 8 H32" stroke="#404041" strokeWidth="2.6" strokeLinecap="round" />
            {/* Neck tube with jagged break at bottom */}
            <path
              d="M21 8 V17 L16 26 L22 24 L25 28 L28 23 L31 27 L30 17 V8"
              stroke="#404041"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="#FFFDF9"
            />
            {/* Escaping bubble */}
            <circle cx="25.5" cy="18" r="1.4" fill="#F6821F" />
            <circle cx="23" cy="12" r="1.0" fill="#FBAD41" />
          </g>

          {/* Game Controller - slightly tilted/unplugged */}
          <g transform="translate(48, 30) rotate(5 16 12)">
            <rect x="0" y="0" width="28" height="18" rx="5" fill="#404041" />
            {/* D-pad in paper white */}
            <path d="M5 9 H11 M8 6 V12" stroke="#FAF7F2" strokeWidth="2.2" strokeLinecap="round" />
            {/* Buttons in Nixlabs orange */}
            <circle cx="19" cy="6.8" r="2.1" fill="#F6821F" />
            <circle cx="23.2" cy="11.5" r="2.1" fill="#FBAD41" />
          </g>
        </svg>
      </div>

      <h2 className="nx-broken-flask-title">{message}</h2>
      {subtitle && <p className="nx-broken-flask-subtitle">{subtitle}</p>}
    </div>
  )
}
