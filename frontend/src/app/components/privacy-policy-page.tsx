import { Link } from "react-router-dom";
import { LegalPage, type LegalSection } from "./legal-page";

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope and responsibility",
    content: (
      <>
        <p>This policy explains how the current SkillSync application handles personal information when you create an account, upload a resume, analyze a target role, build career materials, or use career-growth tools.</p>
        <p>Akyra Studios operates SkillSync and is responsible for the personal information processed through the service. Contact <a href="mailto:mann@akyrastudios.com">mann@akyrastudios.com</a> with privacy questions or requests.</p>
      </>
    ),
  },
  {
    id: "information-you-provide",
    title: "Information you provide",
    content: (
      <>
        <p>SkillSync processes information you choose to add, including:</p>
        <ul>
          <li><strong>Account information:</strong> your email address, profile name, authentication details, and password-recovery events handled through Supabase Auth.</li>
          <li><strong>Career information:</strong> resumes, extracted resume text, target job descriptions, company and role details, skill evidence, learning plans, applications, notes, interview answers, contacts, reminders, and portfolio links.</li>
          <li><strong>Generated workspace content:</strong> analyses, scores, gap reports, roadmaps, resume versions, application packages, practice feedback, and related source mappings.</li>
          <li><strong>Sharing choices:</strong> consent settings for external AI and any career-passport information you intentionally make available through an expiring link.</li>
        </ul>
        <p>The current product does not collect payment-card information.</p>
      </>
    ),
  },
  {
    id: "resume-files",
    title: "Resume file handling",
    content: (
      <>
        <p>PDF and DOCX files are read in memory so SkillSync can extract their text. The original uploaded file is not persisted by the application. SkillSync does store the filename, file type, file size, extracted text, and the workspace records created from that text.</p>
        <p>Do not upload confidential, regulated, or highly sensitive information that is not needed for your career analysis.</p>
      </>
    ),
  },
  {
    id: "how-information-is-used",
    title: "How information is used",
    content: (
      <>
        <p>SkillSync uses information to authenticate you, create and maintain your workspaces, compare your resume with target roles, generate learning and application materials, preserve progress, provide export and deletion controls, prevent abuse, troubleshoot errors, and secure the service.</p>
        <p>Depending on applicable law, these activities may rely on providing the service you requested, your consent for optional processing, the operator’s legitimate interests in operating and protecting the service, or compliance with legal obligations.</p>
      </>
    ),
  },
  {
    id: "ai-processing",
    title: "Optional AI processing",
    content: (
      <>
        <p>External AI processing is optional. When you enable it for a workspace or interview exercise, relevant content may be sent to Groq, such as the target job description, extracted resume text, role context, interview question, your answer, and recent practice context.</p>
        <p>If you do not consent, if no provider key is configured, or if the provider is unavailable, SkillSync uses a limited local rules-based workflow where supported. AI output may be incomplete or inaccurate and should be reviewed before you use it.</p>
      </>
    ),
  },
  {
    id: "service-providers",
    title: "Service providers and disclosures",
    content: (
      <>
        <p>Our production service uses the following providers:</p>
        <ul>
          <li><strong>Supabase:</strong> account authentication, sessions, and storage of application records in PostgreSQL. <a href="https://supabase.com/legal/customer-resources/data-processing-addendum">Supabase data-processing information</a>.</li>
          <li><strong>Render:</strong> hosting for the backend that processes uploads and application requests. <a href="https://render.com/privacy">Render privacy information</a>.</li>
          <li><strong>Vercel:</strong> hosting and delivery of the web interface. <a href="https://vercel.com/legal/privacy-notice">Vercel privacy information</a>.</li>
          <li><strong>Groq:</strong> optional AI processing of relevant content when you enable it. <a href="https://console.groq.com/docs/legal/customer-data-processing-addendum">Groq data-processing information</a>.</li>
        </ul>
        <p>Hosting and security providers may process connection information such as IP addresses, request times, and diagnostic information. Provider processing and retention depend on the services and settings in use.</p>
        <p>Information may also be disclosed when required by law, to protect users or the service, to investigate misuse, or as part of a business transfer subject to appropriate safeguards. SkillSync does not include targeted-advertising trackers or a feature that sells career data.</p>
      </>
    ),
  },
  {
    id: "browser-storage",
    title: "Browser storage and cookies",
    content: (
      <>
        <p>SkillSync and Supabase use browser storage to keep you signed in and remember interface preferences such as theme or sidebar state. A small preference cookie may be used for the sidebar. These technologies support requested product functions rather than targeted advertising.</p>
        <p>Clearing browser storage may sign you out or reset preferences.</p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Retention and deletion",
    content: (
      <>
        <p>Application records remain available until you remove them, we apply a retention schedule, or they are no longer needed for the purposes described here. SkillSync does not currently apply a single automatic deletion period to every type of record.</p>
        <p>Signed-in users can <Link to="/privacy">export their SkillSync data or permanently delete application data</Link>. Application-data deletion covers workspaces, analyses, plans, resumes and extracted text, career evidence, packages, and tracking data. It does not delete the separate Supabase identity account; contact the deployment operator to request account deletion.</p>
        <p>Backups and security logs may remain for a limited period where the deployment operator’s infrastructure requires it, subject to applicable law.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    content: (
      <>
        <p>SkillSync uses authenticated, user-scoped API access and keeps the Groq API key on the backend. File type, signature, and size checks are applied to resume uploads. No system can guarantee absolute security, so use a strong password, protect your device, and report suspected unauthorized access promptly.</p>
      </>
    ),
  },
  {
    id: "your-choices",
    title: "Your choices and rights",
    content: (
      <>
        <p>You can decline external AI processing, review saved workspace information, export application data, delete application data, revoke public career-passport links, and stop using the service.</p>
        <p>Depending on where you live, you may also have rights to access, correct, delete, restrict, object to, or receive a portable copy of personal information, and to withdraw consent. Submit requests to <a href="mailto:mann@akyrastudios.com">mann@akyrastudios.com</a>. You may also have the right to complain to a local data-protection authority.</p>
      </>
    ),
  },
  {
    id: "international-and-children",
    title: "International use and children",
    content: (
      <>
        <p>Service providers may process information in countries other than your own. The deployment operator is responsible for describing those locations and using any transfer safeguards required by applicable law.</p>
        <p>SkillSync is not directed to children under 13, or a higher minimum age where local law requires it. Do not use the service without valid parental or guardian authorization when that authorization is legally required.</p>
      </>
    ),
  },
  {
    id: "changes-and-contact",
    title: "Changes and contact",
    content: (
      <>
        <p>This policy may change when SkillSync’s features, providers, or legal obligations change. Material updates should be announced in the service, and the effective date at the top of this page should be revised.</p>
        <p>For privacy questions, data requests, or account-deletion requests, contact Akyra Studios at <a href="mailto:mann@akyrastudios.com">mann@akyrastudios.com</a>.</p>
      </>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      kind="privacy"
      eyebrow="Your data, explained"
      title="Privacy policy"
      summary="What SkillSync collects, how optional AI processing works, and the controls available for your career data."
      effectiveDate="October 23, 2026"
      sections={sections}
    />
  );
}
