import { AlertTriangle, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Risk Disclosure Statement — Apex Wallet',
  description: 'Important risks associated with cryptocurrency and digital asset trading.',
  alternates: {
    canonical: '/legal/risk-disclosure',
  },
  openGraph: {
    title: 'Risk Disclosure Statement — Apex Wallet',
    description: 'Important risks associated with cryptocurrency and digital asset trading.',
    url: '/legal/risk-disclosure',
    type: 'website',
  },
  twitter: {
    title: 'Risk Disclosure Statement — Apex Wallet',
    description: 'Important risks associated with cryptocurrency and digital asset trading.',
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

function RiskBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
      <h3 className="text-sm font-semibold text-destructive/80">{title}</h3>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DigitalDocument',
  name: 'Risk Disclosure Statement — Apex Wallet',
  description: 'Important risks associated with cryptocurrency and digital asset trading on Apex Wallet.',
  dateModified: '2026-01-01',
  inLanguage: 'en-ZA',
  publisher: {
    '@type': 'Organization',
    name: 'Apex Wallet (Pty) Ltd',
    url: 'https://apexwallet.co.za',
  },
  about: ['Risk Disclosure', 'Cryptocurrency risk', 'Self-custody', 'Non-custodial software'],
};

export default function RiskDisclosurePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Risk Disclosure Statement</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <time dateTime="2026-01-01">Last updated: 1 January 2026</time>
          </div>
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-red-200/80">
            <strong className="text-red-300">⚠ HIGH RISK INVESTMENT WARNING:</strong> Trading, holding, or transacting in crypto assets involves a substantial risk of loss. You should not invest money you cannot afford to lose entirely. This disclosure does not constitute financial advice. Please consult a licensed financial advisor before making investment decisions.
          </div>
        </div>

        <Section title="1. Nature of This Disclosure">
          <p>Apex Wallet is a <strong className="text-foreground">non-custodial software application</strong> — a tool that lets you manage your own crypto keys. We are not a bank, exchange, broker, or financial services provider, and we do not offer regulated financial products or advice. This statement is provided voluntarily to inform you of the material risks of self-custody and of holding or transacting in crypto assets using the software.</p>
          <p>This disclosure is not exhaustive. Crypto assets are novel and rapidly evolving, and new risks may emerge that are not described here. You should seek independent professional advice if you are uncertain about any aspect of crypto assets.</p>
        </Section>

        <Section title="2. Key Risk Factors">
          <div className="grid gap-4 mt-2">
            <RiskBox title="Market & Volatility Risk">
              Crypto assets are subject to extreme price volatility. The value of any crypto asset may increase or decrease by 50% or more within hours or days, and may fall to zero. There is no government guarantee, deposit insurance, or consumer protection scheme applicable to crypto assets in South Africa. You may lose your entire investment.
            </RiskBox>

            <RiskBox title="Liquidity Risk">
              Crypto asset markets may experience periods of low liquidity, making it difficult or impossible to execute transactions at desired prices. During periods of market stress, bid-ask spreads may widen significantly, and you may be unable to liquidate your holdings.
            </RiskBox>

            <RiskBox title="Technology & Smart Contract Risk">
              Blockchain networks and smart contracts may contain coding errors, vulnerabilities, or be subject to exploits. Network congestion, forks, or protocol upgrades may result in transaction delays, failures, or permanent loss of assets. Apex Wallet provides no warranty regarding the reliability or security of underlying blockchain networks.
            </RiskBox>

            <RiskBox title="Custody & Key Management Risk">
              Apex Wallet is a self-custodial platform. You are solely responsible for the safekeeping of your seed phrase, private key, and PIN. If you lose access to your credentials, your assets will be permanently and irrecoverably lost. Apex Wallet cannot restore access to your wallet under any circumstances. There is no equivalent to a "forgot password" function for self-custodial wallets.
            </RiskBox>

            <RiskBox title="Regulatory & Legal Risk">
              The regulatory treatment of crypto assets is evolving rapidly. Governments may impose restrictions, bans, or new requirements on crypto asset transactions at any time. Changes in South African or international law may adversely affect your ability to transact in, hold, or withdraw crypto assets. Tax obligations may arise from crypto asset transactions.
            </RiskBox>

            <RiskBox title="Counterparty & Operational Risk">
              Apex Wallet relies on third-party service providers including cloud infrastructure, banking partners, and KYC providers. Failure or disruption of these third parties may affect the availability or reliability of the Platform.
            </RiskBox>

            <RiskBox title="Fraud, Phishing & Social Engineering Risk">
              The crypto asset sector is a frequent target of sophisticated fraud schemes. You should be vigilant against phishing emails, fake websites, imposters, and social engineering attacks. Apex Wallet will never ask for your seed phrase or PIN. Transactions initiated under fraudulent circumstances cannot be reversed.
            </RiskBox>

            <RiskBox title="Tax Risk">
              Crypto asset transactions may give rise to tax obligations, such as capital gains or income tax, under the laws that apply to you. You are solely responsible for determining and meeting your own tax obligations. Apex Wallet does not track, report, or provide advice on your taxes.
            </RiskBox>

            <RiskBox title="Price & Rate Risk">
              Any prices, rates, or portfolio values shown in the app are estimates sourced from third-party market data and are for information only. They may be delayed or inaccurate and can change before a transaction confirms on-chain. Apex Wallet does not convert crypto to fiat or guarantee any price.
            </RiskBox>

            <RiskBox title="Systemic & Macro Risk">
              Geo-political events, economic crises, pandemics, natural disasters, and other macro factors may significantly impact crypto asset markets. Correlation with traditional financial markets may increase during periods of stress, eliminating diversification benefits.
            </RiskBox>
          </div>
        </Section>

        <Section title="3. No Financial Advice">
          <p>Nothing in the Apex Wallet app constitutes financial, investment, legal, or tax advice. The information and tools provided are for informational purposes only. Any assistant responses and market data shown in the app are general information and should not be relied upon as advice.</p>
          <p>Apex Wallet is a software provider, not a licensed financial services provider or advisor. You are strongly encouraged to seek advice from a qualified, licensed financial advisor before making any investment decisions.</p>
        </Section>

        <Section title="4. Past Performance">
          <p>Historical price data, charts, and performance indicators shown on the Platform are provided for informational purposes only. Past performance of any crypto asset is not indicative of, and provides no guarantee of, future performance. You should not base investment decisions on historical price data alone.</p>
        </Section>

        <Section title="5. Irreversibility of Transactions">
          <p>Blockchain transactions are irreversible by their nature. Once a crypto asset transfer is confirmed on the blockchain, it cannot be undone. Internal ledger transactions on the Apex Wallet platform are similarly final once confirmed. You must verify all transaction details carefully before confirming any transaction. Errors cannot be corrected after the fact.</p>
        </Section>

        <Section title="6. Self-Custody &amp; No Recovery">
          <p>Because Apex Wallet is non-custodial, you — and only you — control your wallet. This means:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>We cannot access, freeze, reverse, or recover your funds under any circumstances;</li>
            <li>There is no "forgot password" or account-recovery process — losing your seed phrase means losing your assets permanently;</li>
            <li>You are responsible for your own device security, backups, and for keeping your recovery phrase private;</li>
            <li>You are responsible for complying with any laws and tax obligations that apply to you personally.</li>
          </ul>
        </Section>

        <Section title="7. Risk Acknowledgement">
          <p>By using the Apex Wallet platform, you acknowledge that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You have read and understood this Risk Disclosure Statement in full;</li>
            <li>You understand and accept the risks described herein;</li>
            <li>You are transacting at your own risk and of your own free will;</li>
            <li>You are not relying on Apex Wallet for financial or investment advice;</li>
            <li>You have the financial means to absorb potential losses without affecting your standard of living.</li>
          </ul>
        </Section>
      </article>
    </>
  );
}
