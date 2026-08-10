'use client'


import { useAuth } from '@/context/AuthContext'

export default function PricingCard({ plan, onSelect }) {
    const { user, isPro } = useAuth()

    if (!plan) return null

    const isComingSoon = plan.comingSoon
    const symbol = plan.displayPrice?.startsWith('₹') ? '₹' : ''
    const amount = plan.displayPrice?.replace('₹', '') || ''

    const color = plan.highlight ? 'var(--fire)' :
        isComingSoon ? 'var(--text-muted)' :
            'var(--fire-warm)'

    return (
        <div className={`pricing-card card ${plan.highlight ? 'pricing-card--highlight' : ''} ${isComingSoon ? 'pricing-card--soon' : ''}`}>

            {}
            {plan.badge && (
                <div
                    className="plan-badge font-mono"
                    style={{
                        color: plan.highlight ? '#fff' : color,
                        borderColor: plan.highlight ? 'transparent' : color,
                        background: plan.highlight ? 'var(--fire-grad)' : 'var(--bg-card)',
                    }}
                >
                    {plan.badge}
                </div>
            )}

            {}
            <div className="plan-top">
                <p className="plan-name font-mono">{plan.name}</p>
                <p className="plan-tagline font-mono">{plan.tagline}</p>

                {}
                {isComingSoon ? (
                    <p className="plan-coming font-display" style={{ color }}>🔜</p>
                ) : (
                    <div className="price-row">
                        <span className="plan-symbol font-display" style={{ color }}>{symbol}</span>
                        <span className="plan-price  font-display" style={{ color }}>{amount}</span>
                        <span className="plan-period font-mono">{plan.period}</span>
                    </div>
                )}

                <p className="plan-currency font-mono">Indian Rupees (INR)</p>
            </div>

            {}
            <ul className="features-list">
                {plan.features.map((f, i) => {
                    const text = typeof f === 'string' ? f : f.text
                    const hot = typeof f === 'object' ? f.hot : false
                    return (
                        <li key={i} className={`feature-item font-mono ${hot ? 'feature-item--hot' : ''}`}>
                            <span style={{ color: hot ? color : 'var(--good)' }}>
                                {hot ? '🔥' : '✓'}
                            </span>
                            {' '}{text}
                        </li>
                    )
                })}
            </ul>

            {}
            <button
                className="btn plan-cta"
                style={{
                    background: plan.highlight ? 'var(--fire-grad)' :
                        isComingSoon ? 'transparent' :
                            color,
                    color: isComingSoon ? 'var(--text-secondary)' : '#fff',
                    border: isComingSoon ? '1px solid var(--border)' : 'none',
                }}
                onClick={() => onSelect(plan.id)}
                disabled={isPro && !isComingSoon}
            >
                {isPro && !isComingSoon
                    ? '✓ Already Pro'
                    : !user && !isComingSoon
                        ? 'Connect GitHub to Pay'
                        : plan.cta}
            </button>

            {plan.ctaSubtext && (
                <p className="plan-note font-mono">{plan.ctaSubtext}</p>
            )}

            {}
            {!isComingSoon && (
                <p className="plan-methods font-mono">
                    Card · UPI · NetBanking · Wallet via Razorpay
                </p>
            )}

            <style jsx>{`
        .pricing-card {
          display:        flex;
          flex-direction: column;
          gap:            1.1rem;
          padding:        1.5rem;
          padding-top:    2rem;  /* WHY: space for badge above top edge */
          position:       relative;
          transition:     transform 0.2s ease, box-shadow 0.2s ease;
          overflow:       visible; /* WHY: badge overflows top — must be visible */
        }
        .pricing-card:hover:not(.pricing-card--soon) {
          transform:  translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .pricing-card--highlight {
          border-color: var(--fire);
          box-shadow:   0 0 24px rgba(255,69,0,0.15);
        }
        .pricing-card--soon { opacity: 0.75; }

        /* Badge — sits above top edge of card */
        .plan-badge {
          position:       absolute;
          top:            -11px;
          left:           50%;
          transform:      translateX(-50%);
          font-size:      9px;
          padding:        3px 12px;
          border:         1px solid;
          border-radius:  var(--radius-sm);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          white-space:    nowrap;
        }

        /* Plan header */
        .plan-top {
          border-bottom:  1px solid var(--border);
          padding-bottom: 1rem;
          display:        flex;
          flex-direction: column;
          gap:            4px;
        }
        .plan-name {
          font-size:      11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color:          var(--text-secondary);
        }
        .plan-tagline {
          font-size: 12px;
          color:     var(--text-muted);
        }
        .price-row {
          display:     flex;
          align-items: baseline;
          gap:         2px;
          margin-top:  4px;
        }
        .plan-symbol  { font-size: 20px; line-height: 1; }
        .plan-price   { font-size: 40px; line-height: 1; margin-right: 6px; }
        .plan-period  { font-size: 13px; color: var(--text-secondary); }
        .plan-coming  { font-size: 32px; margin-top: 4px; }
        .plan-currency {
          font-size:      10px;
          color:          var(--text-muted);
          letter-spacing: 0.5px;
        }

        /* Features */
        .features-list {
          list-style:     none;
          display:        flex;
          flex-direction: column;
          gap:            9px;
          flex:           1;
        }
        .feature-item {
          font-size:   13px;
          color:       var(--text-secondary);
          display:     flex;
          gap:         8px;
          align-items: flex-start;
          line-height: 1.4;
        }
        /* WHY fire color on hot features: draws eye to best differentiators */
        .feature-item--hot { color: var(--text-primary); font-weight: 500; }

        /* CTA */
        .plan-cta {
          width:          100%;
          padding:        13px;
          border-radius:  var(--radius-md);
          font-size:      15px;
          letter-spacing: 0.5px;
          transition:     var(--ease);
        }
        .plan-cta:hover:not(:disabled) {
          opacity:   0.9;
          transform: translateY(-1px);
        }
        .plan-cta:disabled {
          opacity: 0.5;
          cursor:  not-allowed;
        }

        .plan-note {
          text-align: center;
          color:      var(--text-muted);
          font-size:  11px;
        }
        .plan-methods {
          text-align: center;
          color:      var(--text-ghost);
          font-size:  10px;
          letter-spacing: 0.3px;
        }
      `}</style>
        </div>
    )
}
