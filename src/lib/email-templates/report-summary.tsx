import React from 'react'

import { EmailLogo } from './brand-header'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Kpi {
  label: string
  value: string
  context: string
}

interface Props {
  senderName?: string
  title?: string
  subtitle?: string
  question?: string
  headline?: string | null
  kpis?: Kpi[]
  labeledDemo?: boolean
  message?: string | null
  reportUrl?: string
  scheduled?: boolean
}

const Email = ({
  senderName = 'A teammate',
  title = 'Aislix report',
  subtitle = '',
  question = '',
  headline,
  kpis = [],
  labeledDemo = false,
  message,
  reportUrl = 'https://aislix.com/report',
  scheduled = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Aislix ${title}${subtitle ? ` · ${subtitle}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo />
        <Heading style={heading}>
          {title}
          {labeledDemo ? ' (demo data)' : ''}
        </Heading>
        <Text style={muted}>{subtitle}</Text>
        <Text style={text}>
          {scheduled ? (
            <>Your scheduled Aislix report is ready.</>
          ) : (
            <>
              <strong>{senderName}</strong> shared an Aislix report with you.
            </>
          )}
        </Text>
        {question ? <Text style={muted}>{question}</Text> : null}
        {message ? <Text style={quote}>{message}</Text> : null}
        {headline ? <Text style={headlineStyle}>{headline}</Text> : null}

        {kpis.length ? (
          <Section style={card}>
            {kpis.map((k) => (
              <Section key={k.label} style={kpiRow}>
                <Text style={cellLabel}>{k.label}</Text>
                <Text style={cellValue}>{k.value}</Text>
                <Text style={cellContext}>{k.context}</Text>
              </Section>
            ))}
          </Section>
        ) : null}

        <Section style={{ margin: '28px 0 8px' }}>
          <Button href={reportUrl} style={button}>
            Open full report
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={muted}>
          Numbers come from completed AI audits in your Aislix workspace. Sign in to see photos, tables and
          exports.
        </Text>
        <Text style={muted}>
          If the button does not work, copy this link into your browser:
          <br />
          <Link href={reportUrl} style={link}>
            {reportUrl}
          </Link>
        </Text>
        <Text style={muted}>Aislix — AI-powered retail shelf intelligence.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) => {
    const title = data?.title ? String(data.title) : 'Aislix report'
    const subtitle = data?.subtitle ? String(data.subtitle) : ''
    return subtitle ? `Aislix ${title} · ${subtitle}` : `Aislix ${title}`
  },
  displayName: 'Report summary',
  previewData: {
    senderName: 'Apurv Gupta',
    title: 'Executive summary',
    subtitle: 'All stores · 7 Sept 2026 – 7 Oct 2026',
    question: 'How are all my stores doing, and where should I act first?',
    headline: '12 AI audits across 4 stores found 34 empty gaps and 9 low-stock lines.',
    kpis: [
      { label: 'Shelf availability', value: '88.5%', context: 'Average across 12 AI audits' },
      { label: 'Empty shelf gaps', value: '34', context: 'Empty spaces the AI found' },
    ],
    reportUrl: 'https://aislix.com/report?type=exec&days=30',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const heading = { fontSize: '24px', lineHeight: '32px', color: '#04203F', margin: '0 0 4px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1f2937', margin: '12px 0 8px' }
const quote = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#1f2937',
  backgroundColor: '#F4F7F9',
  borderLeft: '3px solid #04203F',
  borderRadius: '8px',
  padding: '12px 14px',
  margin: '16px 0 0',
}
const headlineStyle = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#04203F',
  backgroundColor: '#F4F7F9',
  border: '1px solid #D9E2E8',
  borderRadius: '10px',
  padding: '10px 12px',
  margin: '16px 0 0',
}
const card = { marginTop: '16px', border: '1px solid #D9E2E8', borderRadius: '12px', padding: '4px 12px' }
const kpiRow = { padding: '8px 0', borderBottom: '1px solid #EEF1F4' }
const cellLabel = { fontSize: '11px', color: '#667085', margin: '0 0 2px', textTransform: 'uppercase' as const }
const cellValue = { fontSize: '18px', color: '#04203F', margin: 0, fontWeight: 600 as const }
const cellContext = { fontSize: '12px', color: '#557187', margin: '2px 0 0' }
const button = {
  backgroundColor: '#04203F',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '12px 20px',
  fontSize: '14px',
  fontWeight: 600 as const,
  textDecoration: 'none',
}
const muted = { fontSize: '12px', lineHeight: '18px', color: '#667085', margin: '8px 0 0' }
const link = { color: '#04203F', textDecoration: 'underline' }
const hr = { borderColor: '#D9E2E8', margin: '24px 0 12px' }
