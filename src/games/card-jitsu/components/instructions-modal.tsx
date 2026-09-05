import './instructions-modal.css'

interface InstructionsModalProps {
  readonly onClose: () => void
}

export function InstructionsModal({ onClose }: InstructionsModalProps) {
  return (
    <div className="nx-instructions-backdrop" onClick={onClose}>
      <div className="nx-scroll-container" onClick={(e) => e.stopPropagation()}>
        <h3 className="nx-scroll-title">Card-Jitsu Teachings</h3>

        <div className="nx-scroll-section">
          <h4>1. The Cycle of the Elements</h4>
          <p>
            Master the elemental trinity: <strong>Fire</strong> melts <strong>Snow</strong>,{' '}
            <strong>Snow</strong> freezes <strong>Water</strong>, and <strong>Water</strong> douses{' '}
            <strong>Fire</strong>.
          </p>

          <div className="nx-element-triangle">
            <div className="nx-triangle-item" style={{ color: '#e53935' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>[FIRE]</span>
              <span>FIRE</span>
              <span style={{ fontSize: '11px', color: '#666' }}>beats Snow</span>
            </div>
            <span style={{ fontSize: '18px', color: '#888' }}>&rarr;</span>
            <div className="nx-triangle-item" style={{ color: '#00acc1' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>[SNOW]</span>
              <span>SNOW</span>
              <span style={{ fontSize: '11px', color: '#666' }}>beats Water</span>
            </div>
            <span style={{ fontSize: '18px', color: '#888' }}>&rarr;</span>
            <div className="nx-triangle-item" style={{ color: '#1e88e5' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>[WATER]</span>
              <span>WATER</span>
              <span style={{ fontSize: '11px', color: '#666' }}>beats Fire</span>
            </div>
          </div>
        </div>

        <div className="nx-scroll-section">
          <h4>2. Matching Elements (Number Comparison)</h4>
          <p>
            When both ninjas play the same element, the card with the higher number wins the round.
            If the values are identical, neither card wins and both cards dissipate!
          </p>
        </div>

        <div className="nx-scroll-section">
          <h4>3. How to Win the Match</h4>
          <p>
            The first ninja to collect <strong>three winning cards</strong> achieves victory:
          </p>
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '13.5px', lineHeight: 1.6 }}>
            <li>
              <strong>One of each element</strong> (1 Fire + 1 Water + 1 Snow), where all three cards have <em>different colors</em>.
            </li>
            <li>
              <strong>Three of the same element</strong> (e.g. 3 Fire), all in <em>different colors</em>.
            </li>
          </ul>
        </div>

        <button type="button" className="nx-scroll-close-btn" onClick={onClose}>
          Understood, Sensei
        </button>
      </div>
    </div>
  )
}
