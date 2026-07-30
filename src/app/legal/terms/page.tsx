import { Scale, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — Apex Private Ledger',
  description: 'Terms and conditions governing your use of Apex Private Ledger.',
  alternates: {
    canonical: '/legal/terms',
  },
  openGraph: {
    title: 'Terms of Service — Apex Private Ledger',
    description: 'Terms and conditions governing your use of Apex Private Ledger.',
    url: '/legal/terms',
    type: 'website',
  },
  twitter: {
    title: 'Terms of Service — Apex Private Ledger',
    description: 'Terms and conditions governing your use of Apex Private Ledger.',
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
  name: 'Terms of Service — Apex Private Ledger',
  description: 'Terms and conditions governing your use of Apex Private Ledger.',
  dateModified: '2026-01-01',
  inLanguage: 'en',
  publisher: {
    '@type': 'Organization',
    name: 'Apex Private Ledger',
    url: 'https://apexwallet.app',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@apexwallet.app',
      contactType: 'support',
    },
  },
  about: ['Terms of Service', 'Cryptocurrency wallet', 'Non-custodial software', 'Self-custody'],
};

export default function TermsPage() {
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
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <time dateTime="2026-01-01">Last updated: 1 January 2026</time>
            <span>| Version 2.0</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200/80">
            <strong className="text-amber-300">Important Notice:</strong> Apex Private Ledger is a non-custodial software application — a tool you use to manage your own crypto keys. It is not a bank, exchange, broker, or financial services provider. Please read these Terms carefully. By using the app, you agree to them. If you do not agree, you must not use the app.
          </div>
        </div>

        <Section title="1. Parties and Acceptance">
          <p>These Terms of Service ("Terms") form an agreement between you ("User", "you", "your") and the provider of <strong className="text-foreground">Apex Private Ledger</strong> ("Apex", "we", "us", "our"), the publisher of the Apex Private Ledger software application.</p>
          <p>By downloading, accessing, or using any part of the Apex Private Ledger application or web interface ("the App"), you confirm that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are at least 18 years of age;</li>
            <li>You have full legal capacity to enter into binding agreements;</li>
            <li>You will use the App in accordance with the laws that apply to you;</li>
            <li>You accept these Terms in their entirety.</li>
          </ul>
        </Section>

        <Section title="2. Description of the Software">
          <p>Apex Private Ledger is a <strong className="text-foreground">non-custodial software application</strong>. It is a self-hosted tool that runs on your device and lets you:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Generate and manage your own crypto asset keys and wallet;</li>
            <li>Store, send, and receive supported crypto assets directly on public blockchains;</li>
            <li>View live market prices and track your own portfolio;</li>
            <li>Access general, informational tools and support.</li>
          </ul>
          <p className="mt-2"><strong className="text-foreground">Non-Custodial Nature:</strong> Apex Private Ledger never holds, controls, or has access to your funds or private keys. We do not operate as a bank, exchange, broker, money services business, or financial institution, and we do not take custody of any user assets. You are solely responsible for the security of your seed phrase, private key, and PIN. If you lose them, your assets are permanently and irrecoverably lost — we cannot restore access under any circumstances.</p>
        </Section>

        <Section title="3. Eligibility">
          <p>To use Apex Private Ledger, you must:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Be at least 18 years of age with full legal capacity;</li>
            <li>Not be located in, or a resident of, a jurisdiction where using self-custody crypto software is prohibited;</li>
            <li>Use the App only for lawful purposes.</li>
          </ul>
          <p>Because Apex Private Ledger is non-custodial software, we do not open financial accounts for you, do not require identity verification, and do not screen, approve, or vet users. You alone control your wallet.</p>
        </Section>

        <Section title="4. Your Responsibilities">
          <p>Because you are in full control of your own wallet, you are responsible for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Safely storing and backing up your seed phrase, private key, and PIN;</li>
            <li>Verifying every transaction detail, including recipient addresses, before confirming;</li>
            <li>Understanding that blockchain transactions are final and cannot be reversed;</li>
            <li>Determining and meeting any tax or legal obligations that apply to you personally;</li>
            <li>Complying with the laws of your own jurisdiction when using the software.</li>
          </ul>
          <p>Apex Private Ledger does not monitor, approve, or intermediate your transactions. The software simply helps you sign and broadcast transactions you initiate yourself.</p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree not to use the App for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Any unlawful purpose under the laws that apply to you;</li>
            <li>Attempting to hack, reverse-engineer, disrupt, or gain unauthorised access to the App or its infrastructure;</li>
            <li>Infringing the intellectual property or other rights of Apex Private Ledger or third parties;</li>
            <li>Introducing malware or interfering with other users' use of the software.</li>
          </ul>
        </Section>

        <Section title="6. Transactions">
          <p>All crypto transactions are initiated, signed, and broadcast by you. Because Apex Private Ledger is non-custodial:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>We do not set, impose, or enforce transaction limits — network rules and your own wallet balance apply;</li>
            <li>We cannot pause, reverse, freeze, or recall any transaction once it is broadcast;</li>
            <li>Network (gas) fees are set by the underlying blockchain and are outside our control;</li>
            <li>Any market prices or rates shown in the App are estimates for information only and may change before your transaction confirms.</li>
          </ul>
        </Section>

        <Section title="7. Fees">
          <p>Apex Private Ledger is provided as free-to-use software. The only unavoidable cost of transacting is the <strong className="text-foreground">network (gas) fee</strong> charged by the underlying blockchain, which is paid directly to the network — not to us — and is displayed before you confirm a transaction.</p>
          <p>If any optional in-app service fee ever applies, it will be clearly disclosed to you before you proceed. We may update the software and any applicable fees from time to time.</p>
        </Section>

        <Section title="8. Risk Acknowledgement">
          <p>You acknowledge and accept that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Crypto assets are highly volatile and speculative instruments;</li>
            <li>You may lose some or all of your invested capital;</li>
            <li>Past performance is not a reliable indicator of future results;</li>
            <li>Crypto assets are not legal tender and are not backed by any government or central bank;</li>
            <li>Regulatory changes may adversely affect the value or legality of crypto assets;</li>
            <li>Technology risks including smart contract vulnerabilities, network congestion, and protocol failures exist;</li>
            <li>Apex Private Ledger provides no guarantee of any returns or preservation of capital.</li>
          </ul>
          <p>Please refer to our <a href="/legal/risk-disclosure" className="underline text-primary hover:text-primary/80 transition-colors">Risk Disclosure Statement</a> for full details.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>To the fullest extent permitted by applicable law, Apex Private Ledger shall not be liable for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Any loss of crypto assets due to user error, lost credentials, or seed phrase compromise;</li>
            <li>Market losses, exchange rate fluctuations, or investment decisions;</li>
            <li>System downtime, technical failures, or network disruptions outside our control;</li>
            <li>Losses arising from third-party hacks, phishing, or social engineering;</li>
            <li>Indirect, consequential, incidental, or punitive damages of any kind.</li>
          </ul>
          <p>Our aggregate liability to you for any cause of action shall not exceed the fees paid by you to Apex Private Ledger in the 12 months preceding the claim.</p>
        </Section>

        <Section title="10. Intellectual Property">
          <p>All content, software, trademarks, logos, and materials in the App are the property of Apex Private Ledger or its licensors and are protected by applicable intellectual property laws. You may not copy, reproduce, modify, distribute, or create derivative works without our prior written consent.</p>
        </Section>

        <Section title="11. Privacy and Data Protection">
          <p>Your use of the App is subject to our <a href="/legal/privacy" className="underline text-primary hover:text-primary/80 transition-colors">Privacy Policy</a>, which forms part of these Terms. As a non-custodial app, we collect only the minimal data needed to run the software and, where you opt in, to send you notifications. We do not collect identity documents or run identity verification.</p>
        </Section>

        <Section title="12. Governing Law and Dispute Resolution">
          <p>These Terms are governed by the laws applicable to the software provider. Any dispute arising from or in connection with these Terms should first be raised through our support channels so we can attempt to resolve it amicably before any formal proceedings.</p>
        </Section>

        <Section title="13. Amendments">
          <p>We reserve the right to amend these Terms at any time. Material changes will be communicated via the Platform or registered email address with at least 30 days' notice. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section title="14. Contact Information">
          <p>For legal or general inquiries about the software, please contact:</p>
          <address className="not-italic mt-3 p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1 font-mono text-xs">
            <p><strong className="text-foreground">Apex Private Ledger</strong></p>
            <p>Software Support</p>
            <p>Email: <a href="mailto:support@apexwallet.app">support@apexwallet.app</a></p>
            <p>Non-custodial software provider</p>
          </address>
        </Section>
      </article>
    </>
  );
}
