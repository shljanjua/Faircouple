import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * Dynamic Open Graph image. Used as the default social card and per-page via
 * /og?title=…&subtitle=…  (1200×630, the size every network expects).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get('title') ?? 'Is your relationship actually fair?').slice(0, 110);
  const subtitle = (
    searchParams.get('subtitle') ??
    'Both partners measure effort, respect and loyalty — then read one shared report.'
  ).slice(0, 160);
  const badge = searchParams.get('badge') ?? 'FairCouples';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #e11d48 0%, #db2777 45%, #c026d3 100%)',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
            }}
          >
            💗
          </div>
          <div style={{ color: 'white', fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            {badge}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: 'white',
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.86)',
              fontSize: 30,
              marginTop: 26,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 28,
            color: 'rgba(255,255,255,0.9)',
            fontSize: 24,
          }}
        >
          <span>⚖️ Fairness scoring</span>
          <span>💗 Emotions</span>
          <span>💸 Fair budgets</span>
          <span>✈️ Travel planning</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
