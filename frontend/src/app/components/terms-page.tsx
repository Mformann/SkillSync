import { Link } from "react-router-dom";
import { LegalPage, type LegalSection } from "./legal-page";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    content: (
      <>
        <p>These terms govern your access to and use of SkillSync. By creating an account or using the service, you agree to these terms and the <Link to="/privacy-policy">privacy policy</Link>. If you do not agree, do not use the service.</p>
        <p>The person or organization running your SkillSync deployment is the service operator. That operator must identify itself and provide any additional terms required for its jurisdiction or deployment.</p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility and accounts",
    content: (
      <>
        <p>You must be legally able to enter into this agreement and meet the minimum age required where you live. If you use SkillSync for an organization, you confirm that you are authorized to accept these terms for that organization.</p>
        <p>Provide accurate account information, keep your sign-in credentials confidential, and promptly report suspected unauthorized access. You are responsible for activity carried out through your account unless applicable law provides otherwise.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "What SkillSync provides",
    content: (
      <>
        <p>SkillSync provides career-planning tools, including resume and job-description comparison, skill-gap analysis, learning roadmaps, application materials, interview practice, application tracking, and selected sharing features.</p>
        <p>The current application does not charge a fee. A deployment operator must clearly disclose any future paid plan, renewal, cancellation, and refund terms before charging users.</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <p>You may use SkillSync only for lawful career-development purposes. You must not:</p>
        <ul>
          <li>upload content you do not have the right to use;</li>
          <li>submit malware, attempt unauthorized access, probe security controls, or disrupt the service;</li>
          <li>misrepresent generated content, evidence, credentials, assessment results, or another person’s identity;</li>
          <li>use the service to discriminate, harass, deceive, spam, or violate another person’s privacy or rights;</li>
          <li>circumvent rate limits, access controls, consent checks, or safety features; or</li>
          <li>reverse engineer or copy protected parts of the service except where applicable law expressly allows it.</li>
        </ul>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content and permissions",
    content: (
      <>
        <p>You retain ownership of the resumes, job descriptions, notes, evidence, links, answers, and other content you provide. You give the service operator a limited permission to host, process, reproduce, and transform that content only as needed to operate, secure, and support SkillSync.</p>
        <p>You confirm that your content is accurate to the best of your knowledge and that you have the rights needed to provide it. Do not upload confidential information belonging to an employer, client, or other person without authorization.</p>
      </>
    ),
  },
  {
    id: "ai-and-career-guidance",
    title: "AI output and career guidance",
    content: (
      <>
        <p>SkillSync can use AI to analyze or draft content when you give the required consent. AI output may be inaccurate, incomplete, outdated, or unsuitable for your situation. Local rules-based results also have limits.</p>
        <p>You must review all recommendations, scores, resumes, cover letters, outreach, and interview feedback before relying on or sending them. SkillSync does not guarantee interviews, employment, compensation, promotion, credential recognition, or any other career outcome. It does not provide legal, financial, immigration, recruiting, or professional certification advice.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing and public links",
    content: (
      <>
        <p>If you create a career-passport link or another shareable output, anyone with the link may be able to view and copy the selected information until the link expires or is revoked. Revocation stops future access through SkillSync but cannot retrieve copies already downloaded or saved by another person.</p>
        <p>Review every selected item before sharing and avoid publishing private contact details or sensitive information.</p>
      </>
    ),
  },
  {
    id: "third-party-services",
    title: "Third-party services and links",
    content: (
      <>
        <p>SkillSync depends on third-party services such as Supabase for authentication and, when enabled with your consent, Groq for AI processing. Learning resources, job links, and portfolio links may lead to third-party websites.</p>
        <p>Those services operate under their own terms and privacy practices. SkillSync does not control third-party content, availability, security, or hiring decisions.</p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy and data controls",
    content: (
      <>
        <p>The <Link to="/privacy-policy">privacy policy</Link> explains how the current application processes information. Signed-in users can also open <Link to="/privacy">Privacy and data controls</Link> to export stored application data or request its deletion.</p>
        <p>Deleting SkillSync application data does not automatically delete the separate Supabase identity account.</p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    content: (
      <>
        <p>The service may be updated, limited, interrupted, or discontinued. Features can change as providers, security needs, and product requirements evolve. The operator should give reasonable notice of material changes when practical.</p>
        <p>You are responsible for keeping copies of important career materials. Do not rely on SkillSync as the only storage location for a resume, evidence, or application record.</p>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    content: (
      <>
        <p>You may stop using SkillSync at any time and use the available deletion controls. The operator may suspend or terminate access when reasonably necessary to address unlawful activity, security risks, serious or repeated violations, provider restrictions, or service shutdown.</p>
        <p>Where appropriate, the operator should provide notice and a reasonable opportunity to export data before permanent termination, unless doing so would create a security, legal, or safety risk.</p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <>
        <p>To the extent permitted by applicable law, SkillSync is provided on an “as is” and “as available” basis. The operator does not promise that the service will always be available, error-free, secure, or that its outputs will meet every user’s needs.</p>
        <p>Nothing in these terms excludes warranties or consumer rights that cannot legally be excluded.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limits of liability",
    content: (
      <>
        <p>To the fullest extent permitted by applicable law, the operator is not responsible for indirect, incidental, special, consequential, or punitive losses arising from your use of SkillSync, including lost opportunities, lost data, or reliance on generated output.</p>
        <p>Any liability that cannot legally be excluded remains subject to the protections and limits available under applicable law. Some jurisdictions do not allow certain exclusions, so parts of this section may not apply to you.</p>
      </>
    ),
  },
  {
    id: "changes-and-contact",
    title: "Changes, disputes, and contact",
    content: (
      <>
        <p>These terms may be updated when the service or legal requirements change. Material changes should be announced in the service, and continued use after the effective date means you accept the revised terms where permitted by law.</p>
        <p>If a concern or dispute arises, contact the deployment operator first through its published support channel. These terms are governed by the mandatory laws that apply to you and the operator; the operator must add any required governing-law, venue, business-identity, and contact disclosures before public launch.</p>
      </>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalPage
      kind="terms"
      eyebrow="Clear rules, fair use"
      title="Terms & conditions"
      summary="The rules for using SkillSync and the important limits you should understand before relying on career or AI-generated guidance."
      effectiveDate="September 21, 2026"
      sections={sections}
    />
  );
}
