import { useState } from 'react'

/**
 * The CTA logo, from web/public/assets/ (cta-logo-blue.png for light backgrounds,
 * cta-logo-white.png for the blue header and emails). Hides itself if the file can't load.
 */
export function BrandLogo({ variant, width }: { variant: 'blue' | 'white'; width: number }) {
  const [missing, setMissing] = useState(false)
  if (missing) return null
  return (
    <img
      src={`/assets/cta-logo-${variant}.png`}
      alt="California Teachers Association"
      width={width}
      style={{ display: 'block', height: 'auto' }}
      onError={() => setMissing(true)}
    />
  )
}
