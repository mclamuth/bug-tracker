import { useState } from 'react'

/**
 * The CTA logo. The image files are not in the repository yet; drop them into web/public/assets/
 * (cta-logo-blue.png for light backgrounds, cta-logo-white.png for the blue header).
 * Until then the logo simply doesn't show.
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
