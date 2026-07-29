import { Lock, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Apex Wallet',
  description: 'How Apex Wallet collects, uses, and protects your personal information.',
  alternates: {
    canonical: '/legal/privacy',
  },
  openGraph: {
    title: 'Privacy Policy — Apex Wallet',
    description: 'How Apex Wallet collects, uses, and protects your personal information.',
    url: '/legal/privacy',
    type: 'website',
  },
  twitter: {
    title: 'Privacy Policy — Apex Wallet',
    description: 'How Apex Wallet collects, uses, and protects your personal information.',
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground border-b border-border/40 pb-2">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DigitalDocument',
  name: 'Privacy Policy — Apex Wallet',
  description: 'How Apex Wallet collects, uses, and protects your personal information.',
  dateModified: '2026-01-01',
  inLanguage: 'en-ZA',
  publisher: {
    '@type': 'Organization',
    name: 'Apex Wallet (Pty) Ltd',
    url: 'https://apexwallet.co.za',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'privacy@apexwallet.co.za',
      contactType: 'privacy',
    },
  },
  about: ['Privacy Policy', 'Data Protection', 'Cryptocurrency wallet', 'Non-custodial software'],
};

export default function PrivacyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <time dateTime="2026-01-01">Last updated: 1 January 2026</time>
            <span>| Minimal data</span>
          </div>
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200/80">
            <strong className="text-blue-300">Privacy at a glance:</strong> Apex Wallet is non-custodial software. Your keys and funds stay on your device — we never see them. We collect only the minimal data needed to run the app and, if you opt in, to send notifications. We do not collect identity documents and do not run identity verification.
          </div>
        </div>

        <Section title="1. Who We Are">
          <p><strong className="text-foreground">Apex Wallet</strong> ("Apex Wallet", "we", "us", "our") is the publisher of the Apex Wallet non-custodial software application. We are not a bank, exchange, or financial institution. We are committed to protecting your privacy and handling any data we do collect in a lawful, fair, and transparent way.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p>Because Apex Wallet is non-custodial, your seed phrase, private keys, PIN, and funds are stored on your own device and are <strong className="text-foreground">never transmitted to or accessible by us</strong>. We collect only:</p>
          <p><strong className="text-foreground">Optional Contact Information:</strong> An email address, only if you choose to provide one to receive deposit/withdrawal notifications.</p>
          <p><strong className="text-foreground">Public Wallet Data:</strong> Public wallet addresses and on-chain activity, which are already public on the blockchain, used to display your balances and history in the app.</p>
          <p><strong className="text-foreground">Technical Information:</strong> Basic device and app data such as app version, error logs, and access logs, used to keep the software working and secure.</p>
          <p className="mt-2">We do <strong className="text-foreground">not</strong> collect identity documents, proof of address, selfies, bank account details, or run any KYC/identity verification.</p>
        </Section>

        <Section title="3. Why We Process Data">
          <p>We only process the limited data above to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Provide the software:</strong> Display your wallet balances, history, and prices;</li>
            <li><strong className="text-foreground">Notify you (opt-in):</strong> Send transaction notifications to the email you provide;</li>
            <li><strong className="text-foreground">Maintain security:</strong> Detect errors, prevent abuse, and keep the app reliable.</li>
          </ul>
        </Section>

        <Section title="4. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-1">
            <li>Running the wallet software and displaying your on-chain data;</li>
            <li>Sending optional notifications to an email you choose to provide;</li>
            <li>Diagnosing errors and improving app functionality and user experience;</li>
            <li>Protecting the app and its users from abuse or security threats.</li>
          </ul>
          <p>We do not use your data for identity verification, credit decisions, or automated profiling.</p>
        </Section>

        <Section title="5. Information Sharing">
          <p>We do not sell your personal information. We share the limited data we hold only with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Infrastructure Providers:</strong> Cloud and email service providers (e.g. Google Firebase) strictly to operate the app and send notifications you opted into;</li>
            <li><strong className="text-foreground">Legal Requests:</strong> Only where we are legally compelled by a valid court order or lawful request — and we can only ever share the minimal data we actually hold, which does not include your keys or funds.</li>
          </ul>
          <p>Note: your on-chain transactions are inherently public on the blockchain and are visible to anyone, independent of this app.</p>
        </Section>

        <Section title="6. Data Retention">
          <p>We keep data only as long as needed:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Notification Email:</strong> Until you remove it or stop using the app;</li>
            <li><strong className="text-foreground">Technical Logs:</strong> Up to 12 months for security and diagnostics.</li>
          </ul>
          <p>You can ask us to delete the email you provided at any time. On-chain data cannot be deleted by us as it lives on public blockchains.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Access:</strong> Ask what data we hold about you;</li>
            <li><strong className="text-foreground">Correction:</strong> Ask us to correct inaccurate information;</li>
            <li><strong className="text-foreground">Deletion:</strong> Ask us to delete the email you provided;</li>
            <li><strong className="text-foreground">Object:</strong> Opt out of notifications at any time.</li>
          </ul>
          <p>To exercise any of these rights, contact us at <span className="text-foreground font-mono">privacy@apexwallet.app</span>.</p>
        </Section>

        <Section title="8. Security Measures">
          <p>We implement industry-standard security measures to protect your personal information, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>AES-256 encryption for data at rest;</li>
            <li>TLS 1.3 for data in transit;</li>
            <li>Multi-factor authentication and biometric verification;</li>
            <li>Regular penetration testing and security audits;</li>
            <li>Access controls and role-based permissions;</li>
            <li>Incident response and breach notification procedures.</li>
          </ul>
          <p>In the event of a personal information breach that poses a risk to your rights, we will notify you and the Information Regulator within 72 hours of discovery.</p>
        </Section>

        <Section title="9. Cookies and Tracking">
          <p>We use essential cookies and similar technologies to operate the Platform. These include session tokens, authentication cookies, and security identifiers. We do not use third-party advertising or tracking cookies. You may disable non-essential cookies through your browser settings, although this may affect Platform functionality.</p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>The Platform is not intended for use by individuals under 18 years of age. We do not knowingly collect personal information from minors. If we become aware that a minor has provided personal information, we will take steps to delete such information promptly.</p>
        </Section>

        <Section title="11. Contact">
          <address className="not-italic p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1 font-mono text-xs">
            <p><strong className="text-foreground">Apex Wallet — Privacy</strong></p>
            <p>Email: <a href="mailto:privacy@apexwallet.app">privacy@apexwallet.app</a></p>
            <p>Non-custodial software provider</p>
          </address>
        </Section>
      </article>
    </>
  );
}
