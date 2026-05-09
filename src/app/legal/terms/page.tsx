import { Scale, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service — Apex Wallet',
  description: 'Terms and conditions governing your use of Apex Wallet.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground border-b border-border/40 pb-2">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Last updated: 1 January 2026 | Version 2.0</span>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200/80">
          <strong className="text-amber-300">Important Notice:</strong> Please read these Terms of Service carefully before using Apex Wallet. By accessing or using the platform, you agree to be bound by these terms. If you do not agree, you must not use the service.
        </div>
      </div>

      <Section title="1. Parties and Acceptance">
        <p>These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you", "your") and <strong className="text-foreground">Apex Wallet (Pty) Ltd</strong> ("Apex", "we", "us", "our"), a company registered under the laws of the Republic of South Africa.</p>
        <p>By creating an account, accessing, or using any part of the Apex Wallet platform, mobile application, or web interface ("the Platform"), you confirm that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are at least 18 years of age;</li>
          <li>You have full legal capacity to enter into binding agreements;</li>
          <li>You are not subject to any sanctions or restrictions under applicable law;</li>
          <li>You accept these Terms in their entirety.</li>
        </ul>
      </Section>

      <Section title="2. Description of Services">
        <p>Apex Wallet provides a self-custodial cryptocurrency wallet platform that enables users to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Store, send, and receive supported crypto assets on a private internal ledger;</li>
          <li>Swap crypto assets against live market rates;</li>
          <li>Withdraw fiat currency to South African bank accounts (EFT) or international accounts (SWIFT);</li>
          <li>Monitor market prices and portfolio performance;</li>
          <li>Access AI-powered financial guidance and support.</li>
        </ul>
        <p className="mt-2"><strong className="text-foreground">Self-Custodial Nature:</strong> Apex Wallet is a self-custodial platform. This means you are solely responsible for maintaining the security of your seed phrase, private key, and PIN. Apex Wallet does not hold, store, or have access to your private keys. Loss of your credentials means permanent and irrecoverable loss of access to your assets.</p>
      </Section>

      <Section title="3. Eligibility and Account Registration">
        <p>To use Apex Wallet, you must:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Be a natural person aged 18 years or older, or a juristic person duly authorised to use financial services;</li>
          <li>Not be a citizen or resident of a jurisdiction where crypto asset services are prohibited;</li>
          <li>Successfully complete our Know Your Customer (KYC) and FICA verification process;</li>
          <li>Provide accurate, complete, and current information at all times.</li>
        </ul>
        <p>We reserve the right to refuse registration, suspend, or terminate accounts at our sole discretion, including where we suspect fraud, money laundering, or other illegal activity.</p>
      </Section>

      <Section title="4. KYC/AML Compliance Obligations">
        <p>In compliance with the <strong className="text-foreground">Financial Intelligence Centre Act (FICA) No. 38 of 2001</strong> and its subsequent amendments, Apex Wallet is an Accountable Institution required to implement comprehensive customer due diligence measures.</p>
        <p>By using the Platform, you consent to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Providing valid government-issued identification documents;</li>
          <li>Submitting proof of residential address not older than 3 months;</li>
          <li>Enhanced due diligence for Politically Exposed Persons (PEPs) and high-risk users;</li>
          <li>Ongoing monitoring of your account transactions;</li>
          <li>Reporting obligations to the Financial Intelligence Centre (FIC) where required by law.</li>
        </ul>
        <p>Failure to provide required documentation may result in suspension of your account or withholding of funds pending compliance resolution.</p>
      </Section>

      <Section title="5. Prohibited Activities">
        <p>You agree not to use the Platform for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Any unlawful purpose, including but not limited to money laundering, terrorist financing, or tax evasion;</li>
          <li>Circumventing sanctions imposed by the United Nations, OFAC, EU, or any other relevant authority;</li>
          <li>Manipulating market prices or engaging in fraudulent transactions;</li>
          <li>Hacking, phishing, or attempting unauthorised access to any part of the Platform;</li>
          <li>Using automated bots or scripts without our express written consent;</li>
          <li>Providing false or misleading information in connection with KYC or any other process;</li>
          <li>Any activity that violates the Financial Markets Act, Prevention of Organised Crime Act (POCA), or any other applicable South African legislation.</li>
        </ul>
      </Section>

      <Section title="6. Transaction Rules and Limits">
        <p>All transactions on the Platform are subject to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Minimum EFT Withdrawal:</strong> R50 per transaction;</li>
          <li><strong className="text-foreground">Maximum EFT Withdrawal:</strong> R500,000 per transaction;</li>
          <li><strong className="text-foreground">SWIFT Minimum:</strong> R1,000 per transaction;</li>
          <li><strong className="text-foreground">SWIFT Maximum:</strong> R1,000,000 per transaction;</li>
          <li><strong className="text-foreground">Travel Rule Threshold:</strong> Transactions exceeding R3,000 in crypto assets trigger mandatory Travel Rule compliance;</li>
          <li><strong className="text-foreground">Enhanced Monitoring:</strong> Transactions or cumulative balances exceeding R25,000 are subject to enhanced FICA due diligence;</li>
          <li>Daily, monthly, and annual limits may be imposed based on your KYC verification level.</li>
        </ul>
        <p>Apex Wallet reserves the right to reverse, freeze, or report transactions at any time where required by law or our internal risk policies.</p>
      </Section>

      <Section title="7. Fees and Charges">
        <p>The following fees apply to transactions on the Platform:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">EFT Withdrawal Fee:</strong> 1.50% of withdrawal amount plus a R15.00 network fee;</li>
          <li><strong className="text-foreground">SWIFT Wire Transfer Fee:</strong> 3.50% of withdrawal amount plus a R250.00 wire fee;</li>
          <li><strong className="text-foreground">Swap Fee:</strong> As disclosed at time of transaction;</li>
          <li><strong className="text-foreground">Network/Gas Fees:</strong> Applied where applicable and disclosed prior to confirmation.</li>
        </ul>
        <p>All fees are exclusive of VAT at the standard rate of 15% unless otherwise stated. Fees are subject to change with 30 days' notice.</p>
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
          <li>Apex Wallet provides no guarantee of any returns or preservation of capital.</li>
        </ul>
        <p>Please refer to our <a href="/legal/risk-disclosure" className="underline text-primary hover:text-primary/80 transition-colors">Risk Disclosure Statement</a> for full details.</p>
      </Section>

      <Section title="9. Limitation of Liability">
        <p>To the fullest extent permitted by applicable law, Apex Wallet shall not be liable for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Any loss of crypto assets due to user error, lost credentials, or seed phrase compromise;</li>
          <li>Market losses, exchange rate fluctuations, or investment decisions;</li>
          <li>System downtime, technical failures, or network disruptions outside our control;</li>
          <li>Losses arising from third-party hacks, phishing, or social engineering;</li>
          <li>Indirect, consequential, incidental, or punitive damages of any kind.</li>
        </ul>
        <p>Our aggregate liability to you for any cause of action shall not exceed the fees paid by you to Apex Wallet in the 12 months preceding the claim.</p>
      </Section>

      <Section title="10. Intellectual Property">
        <p>All content, software, trademarks, logos, and materials on the Platform are the property of Apex Wallet (Pty) Ltd or its licensors and are protected by applicable intellectual property laws. You may not copy, reproduce, modify, distribute, or create derivative works without our prior written consent.</p>
      </Section>

      <Section title="11. Privacy and Data Protection">
        <p>Your use of the Platform is subject to our <a href="/legal/privacy" className="underline text-primary hover:text-primary/80 transition-colors">Privacy Policy</a>, which forms part of these Terms. We process your personal information in accordance with the <strong className="text-foreground">Protection of Personal Information Act (POPIA) No. 4 of 2013</strong> and applicable data protection regulations.</p>
      </Section>

      <Section title="12. Governing Law and Dispute Resolution">
        <p>These Terms are governed by and construed in accordance with the laws of the Republic of South Africa. Any dispute arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of South Africa.</p>
        <p>Before initiating legal proceedings, you agree to attempt to resolve disputes amicably through our support channels. Unresolved disputes may be referred to mediation under the rules of the Arbitration Foundation of Southern Africa (AFSA).</p>
      </Section>

      <Section title="13. Amendments">
        <p>We reserve the right to amend these Terms at any time. Material changes will be communicated via the Platform or registered email address with at least 30 days' notice. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</p>
      </Section>

      <Section title="14. Contact Information">
        <p>For legal inquiries, compliance matters, or to exercise your rights under applicable law, please contact:</p>
        <div className="mt-3 p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1 font-mono text-xs">
          <p><strong className="text-foreground">Apex Wallet (Pty) Ltd</strong></p>
          <p>Compliance Department</p>
          <p>Email: legal@apexwallet.co.za</p>
          <p>Registered Address: South Africa</p>
          <p>FSCA Regulated Entity</p>
        </div>
      </Section>
    </div>
  );
}
