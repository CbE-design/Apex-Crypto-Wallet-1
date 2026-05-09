import { Shield, Calendar } from 'lucide-react';

export const metadata = {
  title: 'AML, FICA & Compliance Policy — Apex Wallet',
  description: 'Anti-Money Laundering, FICA compliance, and KYC policy for Apex Wallet.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground border-b border-border/40 pb-2">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function ComplianceTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden mt-3">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-border/40">
          {rows.map(([label, value], i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-muted/10' : ''}>
              <td className="px-4 py-2.5 font-semibold text-foreground/80 w-1/2">{label}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AMLPolicyPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
            <Shield className="h-5 w-5 text-green-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">AML, FICA & Compliance Policy</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Last updated: 1 January 2026 | FICA & FATF Compliant</span>
        </div>
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-200/80">
          <strong className="text-green-300">Compliance Notice:</strong> Apex Wallet (Pty) Ltd is an Accountable Institution under the Financial Intelligence Centre Act (FICA) No. 38 of 2001. We are committed to maintaining the highest standards of Anti-Money Laundering (AML) and Counter-Terrorism Financing (CTF) compliance.
        </div>
      </div>

      <Section title="1. Regulatory Framework">
        <p>Apex Wallet's compliance programme is built on the following legislative and regulatory framework:</p>
        <ComplianceTable rows={[
          ['FICA (No. 38 of 2001)', 'Primary AML/CTF obligation framework for South African Accountable Institutions'],
          ['POCA (No. 121 of 1998)', 'Prevention of Organised Crime Act — basis for money laundering offences'],
          ['FIC Act Regulations', 'Defines thresholds, reporting requirements, and customer due diligence standards'],
          ['FATF Recommendations', 'International standards for AML/CTF, including Recommendation 16 (Travel Rule)'],
          ['FSRA (No. 9 of 2017)', 'Financial Sector Regulation Act — regulatory oversight by FSCA'],
          ['POPIA (No. 4 of 2013)', 'Data protection framework governing personal information processing'],
          ['ECT Act (No. 25 of 2002)', 'Electronic communications and online transaction regulation'],
          ['SARB Exchange Control Regulations', 'Applicable to fiat currency withdrawals and international transfers'],
          ['CARF (OECD)', 'Crypto-Asset Reporting Framework for international tax transparency'],
        ]} />
      </Section>

      <Section title="2. Customer Due Diligence (CDD) — Know Your Customer (KYC)">
        <p>Apex Wallet applies a risk-based approach to customer due diligence. The following levels of verification are applied:</p>

        <div className="space-y-3 mt-2">
          <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
            <h3 className="text-sm font-semibold text-foreground mb-2">Standard CDD (All Users)</h3>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Full legal name and date of birth;</li>
              <li>South African Identity Number or Passport Number;</li>
              <li>Residential address and proof thereof (not older than 3 months);</li>
              <li>Liveness check / selfie verification matched to ID document;</li>
              <li>Contact details (email and mobile number).</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <h3 className="text-sm font-semibold text-amber-300 mb-2">Enhanced Due Diligence (EDD) — Triggered By:</h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Cumulative transactions exceeding <strong className="text-foreground">R25,000</strong> per month or in a single transaction;</li>
              <li>Identification as a Politically Exposed Person (PEP) or close associate thereof;</li>
              <li>High-risk jurisdiction of residence or origin;</li>
              <li>Unusual or suspicious transaction patterns;</li>
              <li>Inconsistencies in documentation or information provided.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">EDD may require source of funds documentation, employer verification, business registration documents, or an in-person/video verification call.</p>
          </div>
        </div>
      </Section>

      <Section title="3. Transaction Monitoring & Thresholds">
        <p>All transactions are monitored in real-time against predefined rules and risk indicators. The following thresholds trigger specific compliance actions:</p>
        <ComplianceTable rows={[
          ['R3,000+ crypto transfer', 'FATF Travel Rule — beneficiary information collected and transmitted to receiving VASP'],
          ['R25,000+ single transaction', 'Enhanced FICA monitoring — source of funds may be required'],
          ['R24,999 cash equivalent transactions', 'Structuring (smurfing) monitoring — multiple such transactions trigger enhanced scrutiny'],
          ['Cumulative R50,000/month', 'Monthly threshold review and potential enhanced verification'],
          ['Sanctioned entity match', 'Immediate transaction blocking and suspicious activity report filed with FIC'],
          ['PEP identification', 'Enhanced Due Diligence mandatory; senior management approval required'],
        ]} />
      </Section>

      <Section title="4. FATF Travel Rule Compliance">
        <p>In accordance with FATF Recommendation 16 and applicable South African implementation requirements, Apex Wallet complies with the <strong className="text-foreground">Travel Rule</strong> for qualifying crypto asset transfers.</p>
        <p>For transfers of crypto assets with a value of <strong className="text-foreground">R3,000 (approximately USD 162) or more</strong>, the following information is collected and transmitted to the receiving Virtual Asset Service Provider (VASP):</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Originator information:</strong> Full name, wallet address, account number, national ID or passport number;</li>
          <li><strong className="text-foreground">Beneficiary information:</strong> Full name, wallet address of the recipient.</li>
        </ul>
        <p>Transfers to/from unhosted wallets (non-VASP wallets) are subject to additional verification where the transfer value exceeds R3,000.</p>
      </Section>

      <Section title="5. CARF — Crypto-Asset Reporting Framework">
        <p>Apex Wallet participates in the <strong className="text-foreground">OECD Crypto-Asset Reporting Framework (CARF)</strong> for international tax transparency. This framework requires reporting of crypto asset transactions to the South African Revenue Service (SARS) and, through automatic exchange of information agreements, to relevant foreign tax authorities.</p>
        <p>Transactions subject to CARF reporting are flagged in your transaction history with a <strong className="text-foreground">CARF badge</strong>. This does not constitute tax advice — please consult a tax professional regarding your obligations.</p>
      </Section>

      <Section title="6. Suspicious Activity Reporting (SAR)">
        <p>Apex Wallet is legally obligated to file Suspicious Transaction Reports (STRs) with the <strong className="text-foreground">Financial Intelligence Centre (FIC)</strong> where we have reasonable grounds to suspect that a transaction involves the proceeds of crime, tax evasion, or terrorist financing.</p>
        <p>In accordance with FICA Section 29, we are prohibited by law from disclosing ("tipping off") the fact that a report has been or is being considered. Accounts subject to STR investigations may be suspended or restricted without prior notice.</p>
      </Section>

      <Section title="7. Sanctions Screening">
        <p>All users and transactions are screened against the following sanctions lists at onboarding and on an ongoing basis:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>United Nations Security Council (UNSC) Consolidated Sanctions List;</li>
          <li>US Office of Foreign Assets Control (OFAC) Specially Designated Nationals (SDN) List;</li>
          <li>European Union Consolidated Financial Sanctions List;</li>
          <li>UK HM Treasury Financial Sanctions;</li>
          <li>South African designated entities under the Protection of Constitutional Democracy Against Terrorist and Related Activities Act (POCDATARA).</li>
        </ul>
        <p>Any match results in immediate account suspension and reporting to relevant authorities.</p>
      </Section>

      <Section title="8. Politically Exposed Persons (PEPs)">
        <p>Apex Wallet applies Enhanced Due Diligence to all Politically Exposed Persons (PEPs), their immediate family members, and close associates. PEPs include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Current and former heads of state or government;</li>
          <li>Senior government officials, members of parliament, and cabinet ministers;</li>
          <li>Senior military officials;</li>
          <li>Senior officials of state-owned enterprises;</li>
          <li>Senior officials of major political parties;</li>
          <li>Judges of high courts and above.</li>
        </ul>
        <p>PEP account activation requires senior management approval and ongoing enhanced monitoring.</p>
      </Section>

      <Section title="9. Record Keeping">
        <p>In accordance with FICA Section 22, Apex Wallet maintains the following records for a minimum of <strong className="text-foreground">5 years</strong> from the date of the transaction or account closure:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All customer identification records;</li>
          <li>All transaction records, including amounts, dates, parties, and methods;</li>
          <li>Suspicious Transaction Reports filed with the FIC;</li>
          <li>All correspondence related to compliance activities.</li>
        </ul>
      </Section>

      <Section title="10. Compliance Contacts">
        <p>If you have questions about our compliance obligations, wish to report suspicious activity, or need to escalate a compliance matter, please contact:</p>
        <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-1 font-mono text-xs mt-3">
          <p><strong className="text-foreground">Chief Compliance Officer</strong></p>
          <p>Email: compliance@apexwallet.co.za</p>
          <p className="mt-2"><strong className="text-foreground">Financial Intelligence Centre (FIC)</strong></p>
          <p>For reporting money laundering concerns: www.fic.gov.za</p>
          <p className="mt-2"><strong className="text-foreground">FSCA — Financial Sector Conduct Authority</strong></p>
          <p>Website: www.fsca.co.za | Tel: 0800 20 37 22</p>
        </div>
      </Section>
    </div>
  );
}
