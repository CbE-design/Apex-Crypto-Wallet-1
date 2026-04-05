import { AlertTriangle, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Risk Disclosure Statement — Apex Wallet',
  description: 'Important risks associated with cryptocurrency and digital asset trading.',
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

export default function RiskDisclosurePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Risk Disclosure Statement</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Last updated: 1 January 2026</span>
        </div>
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-red-200/80">
          <strong className="text-red-300">⚠ HIGH RISK INVESTMENT WARNING:</strong> Trading, holding, or transacting in crypto assets involves a substantial risk of loss. You should not invest money you cannot afford to lose entirely. This disclosure does not constitute financial advice. Please consult a licensed financial advisor before making investment decisions.
        </div>
      </div>

      <Section title="1. Nature of This Disclosure">
        <p>This Risk Disclosure Statement is provided in compliance with the <strong className="text-foreground">Financial Sector Conduct Authority (FSCA) requirements</strong> and international best practices for crypto asset service providers. It is intended to inform you of the material risks associated with using the Apex Wallet platform and transacting in crypto assets.</p>
        <p>This disclosure is not exhaustive. Crypto assets are novel and rapidly evolving instruments, and new risks may emerge that are not described herein. You should seek independent professional advice if you are uncertain about any aspect of crypto asset investment.</p>
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
            Crypto asset transactions may give rise to capital gains tax, income tax, or VAT obligations under South African law. The South African Revenue Service (SARS) treats crypto assets as assets of an intangible nature. You are responsible for determining and meeting your tax obligations. Apex Wallet does not provide tax advice.
          </RiskBox>

          <RiskBox title="Exchange Rate & Conversion Risk">
            When withdrawing to fiat currency, exchange rates are subject to fluctuation. Rates are locked for 30 seconds at time of quote. If a quote expires, the new rate may be materially different from the quoted rate, resulting in a different fiat amount being received.
          </RiskBox>

          <RiskBox title="Systemic & Macro Risk">
            Geo-political events, economic crises, pandemics, natural disasters, and other macro factors may significantly impact crypto asset markets. Correlation with traditional financial markets may increase during periods of stress, eliminating diversification benefits.
          </RiskBox>
        </div>
      </Section>

      <Section title="3. No Financial Advice">
        <p>Nothing on the Apex Wallet platform constitutes financial, investment, legal, or tax advice. The information and tools provided are for informational purposes only. The AI assistant and market data provided on the Platform are not regulated financial advice and should not be relied upon as such.</p>
        <p>Apex Wallet does not hold a Financial Services Provider (FSP) licence under the Financial Advisory and Intermediary Services (FAIS) Act. Users are strongly encouraged to seek advice from a FSCA-licensed financial advisor before making investment decisions.</p>
      </Section>

      <Section title="4. Past Performance">
        <p>Historical price data, charts, and performance indicators shown on the Platform are provided for informational purposes only. Past performance of any crypto asset is not indicative of, and provides no guarantee of, future performance. You should not base investment decisions on historical price data alone.</p>
      </Section>

      <Section title="5. Irreversibility of Transactions">
        <p>Blockchain transactions are irreversible by their nature. Once a crypto asset transfer is confirmed on the blockchain, it cannot be undone. Internal ledger transactions on the Apex Wallet platform are similarly final once confirmed. You must verify all transaction details carefully before confirming any transaction. Errors cannot be corrected after the fact.</p>
      </Section>

      <Section title="6. FICA Compliance Risks">
        <p>Failure to comply with FICA requirements, including providing accurate KYC documentation, may result in:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Suspension or termination of your account;</li>
          <li>Freezing of funds pending compliance review;</li>
          <li>Reporting of suspicious transactions to the Financial Intelligence Centre (FIC);</li>
          <li>Referral to law enforcement authorities.</li>
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
    </div>
  );
}
