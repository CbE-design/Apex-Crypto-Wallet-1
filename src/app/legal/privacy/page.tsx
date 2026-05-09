import { Lock, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Apex Wallet',
  description: 'How Apex Wallet collects, uses, and protects your personal information.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground border-b border-border/40 pb-2">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Last updated: 1 January 2026 | POPIA Compliant</span>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200/80">
          <strong className="text-blue-300">POPIA Notice:</strong> This Privacy Policy is issued in compliance with the Protection of Personal Information Act (POPIA) No. 4 of 2013. Apex Wallet (Pty) Ltd is the Responsible Party for your personal information. Our Information Officer can be reached at privacy@apexwallet.co.za.
        </div>
      </div>

      <Section title="1. Who We Are">
        <p><strong className="text-foreground">Apex Wallet (Pty) Ltd</strong> ("Apex Wallet", "we", "us", "our") is a South African registered company that provides a self-custodial cryptocurrency wallet and financial services platform. We are committed to protecting your privacy and processing your personal information in a lawful, fair, and transparent manner.</p>
      </Section>

      <Section title="2. Personal Information We Collect">
        <p><strong className="text-foreground">Identity Information:</strong> Full legal name, date of birth, nationality, government-issued ID number, passport details, driving licence information.</p>
        <p><strong className="text-foreground">Contact Information:</strong> Email address, phone number, physical and postal address.</p>
        <p><strong className="text-foreground">Financial Information:</strong> Bank account details, IBAN, SWIFT codes, transaction history, portfolio balances, wallet addresses.</p>
        <p><strong className="text-foreground">KYC Documentation:</strong> Copies of identity documents, proof of address, selfie/liveness verification images submitted during onboarding.</p>
        <p><strong className="text-foreground">Technical Information:</strong> IP addresses, device identifiers, browser type, operating system, access logs, cookies.</p>
        <p><strong className="text-foreground">Behavioural Information:</strong> Platform usage patterns, feature interactions, transaction patterns (for fraud detection and compliance monitoring).</p>
      </Section>

      <Section title="3. Legal Basis for Processing (POPIA Conditions)">
        <p>We process your personal information on the following legal grounds under POPIA:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Contractual necessity:</strong> To provide the services you have requested;</li>
          <li><strong className="text-foreground">Legal obligation:</strong> To comply with FICA, POCA, FSRA, SARB regulations, and FATF Travel Rule requirements;</li>
          <li><strong className="text-foreground">Legitimate interests:</strong> To detect fraud, prevent money laundering, and ensure platform security;</li>
          <li><strong className="text-foreground">Consent:</strong> For marketing communications, where separately obtained.</li>
        </ul>
      </Section>

      <Section title="4. How We Use Your Personal Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>Account creation, verification, and management;</li>
          <li>Processing transactions and executing crypto asset operations;</li>
          <li>Identity verification and KYC/AML compliance screening;</li>
          <li>Risk assessment, fraud detection, and suspicious activity reporting to the FIC;</li>
          <li>Sending transaction confirmations, security alerts, and regulatory notices;</li>
          <li>Responding to your support queries and complaints;</li>
          <li>Improving platform functionality and user experience;</li>
          <li>Complying with court orders, regulatory requests, or law enforcement obligations;</li>
          <li>Sending marketing communications (only with your explicit consent).</li>
        </ul>
      </Section>

      <Section title="5. Information Sharing and Disclosure">
        <p>We do not sell your personal information. We may share your information with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Regulatory Authorities:</strong> The Financial Intelligence Centre (FIC), South African Revenue Service (SARS), Financial Sector Conduct Authority (FSCA), South African Reserve Bank (SARB), and law enforcement agencies as required by law;</li>
          <li><strong className="text-foreground">KYC Providers:</strong> Third-party identity verification and screening services (under strict data processing agreements);</li>
          <li><strong className="text-foreground">Banking Partners:</strong> For processing EFT and SWIFT transactions;</li>
          <li><strong className="text-foreground">Cloud Service Providers:</strong> Including Google Firebase for platform infrastructure;</li>
          <li><strong className="text-foreground">Professional Advisors:</strong> Legal, audit, and compliance professionals under confidentiality obligations;</li>
          <li><strong className="text-foreground">Travel Rule Recipients:</strong> Where crypto transfers trigger FATF Travel Rule obligations, beneficiary information may be shared with receiving Virtual Asset Service Providers (VASPs).</li>
        </ul>
        <p>International transfers of personal information are conducted only to jurisdictions with adequate data protection frameworks or under appropriate safeguards.</p>
      </Section>

      <Section title="6. Data Retention">
        <p>We retain your personal information for the following periods:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Account and KYC Records:</strong> 5 years after account closure (as required by FICA);</li>
          <li><strong className="text-foreground">Transaction Records:</strong> 5 years from the date of the transaction;</li>
          <li><strong className="text-foreground">Suspicious Activity Reports:</strong> As required by the FIC;</li>
          <li><strong className="text-foreground">Technical Logs:</strong> Up to 12 months for security purposes.</li>
        </ul>
        <p>After the applicable retention period, your information will be securely deleted or anonymised.</p>
      </Section>

      <Section title="7. Your Rights Under POPIA">
        <p>As a data subject, you have the following rights:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Right of Access:</strong> Request a copy of the personal information we hold about you;</li>
          <li><strong className="text-foreground">Right to Correction:</strong> Request correction of inaccurate or incomplete information;</li>
          <li><strong className="text-foreground">Right to Deletion:</strong> Request deletion of your information (subject to legal retention obligations);</li>
          <li><strong className="text-foreground">Right to Object:</strong> Object to processing for direct marketing purposes at any time;</li>
          <li><strong className="text-foreground">Right to Complain:</strong> Lodge a complaint with the Information Regulator of South Africa.</li>
        </ul>
        <p>To exercise any of these rights, contact our Information Officer at <span className="text-foreground font-mono">privacy@apexwallet.co.za</span>.</p>
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

      <Section title="11. Contact — Information Officer">
        <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1 font-mono text-xs">
          <p><strong className="text-foreground">Information Officer — Apex Wallet (Pty) Ltd</strong></p>
          <p>Email: privacy@apexwallet.co.za</p>
          <p>Postal Address: South Africa</p>
          <p className="mt-2"><strong className="text-foreground">Information Regulator (South Africa)</strong></p>
          <p>Website: www.justice.gov.za/inforeg</p>
          <p>Email: inforeg@justice.gov.za</p>
        </div>
      </Section>
    </div>
  );
}
