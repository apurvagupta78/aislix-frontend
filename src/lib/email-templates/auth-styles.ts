/** Shared Aislix brand styling for authentication emails. */

export const NAVY = '#09283e'
export const GREEN = '#0B8F4D'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

export const container = { padding: '32px 28px', maxWidth: '560px' }

export const brand = {
  fontSize: '20px',
  fontWeight: 700 as const,
  letterSpacing: '-0.4px',
  color: NAVY,
  margin: '0 0 24px',
}

export const heading = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: NAVY,
  margin: '0 0 16px',
}

export const text = {
  fontSize: '15px',
  color: '#3f4a56',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

export const button = {
  backgroundColor: GREEN,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '13px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const link = { color: GREEN, textDecoration: 'underline' }

export const hr = { borderColor: '#e5e9ee', margin: '32px 0 20px' }

export const muted = { fontSize: '12px', color: '#7a8794', lineHeight: '1.6', margin: '0 0 8px' }

export const code = {
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '6px',
  color: NAVY,
  margin: '0 0 24px',
}
