export type SkillCategory =
  | 'languages'
  | 'frameworks'
  | 'security-tools'
  | 'security-skills'
  | 'cloud';

export interface Skill {
  name: string;
  category: SkillCategory;
  /** 1–10 — drives node radius */
  weight: number;
  /** Names of skills to draw edges to */
  connections?: string[];
  /** Project titles this skill was used in */
  relatedProjects?: string[];
}

export const skills: Skill[] = [
  // ── Languages ──────────────────────────────────────────────────
  {
    name: 'TypeScript', category: 'languages', weight: 10,
    connections: ['React.js', 'Node.js', 'Jest', 'Next.js'],
    relatedProjects: ['Thumbo.app', 'Portfolio Website', 'Down — Social Media App'],
  },
  {
    name: 'Python', category: 'languages', weight: 10,
    connections: ['Docker', 'AWS', 'Azure'],
  },
  {
    name: 'JavaScript', category: 'languages', weight: 8,
    connections: ['React.js', 'Node.js', 'React Native'],
    relatedProjects: ['CSULB ACM Website', 'Thumbo.app'],
  },
  {
    name: 'HTML', category: 'languages', weight: 6,
    connections: ['CSS'],
    relatedProjects: ['CSULB ACM Website'],
  },
  {
    name: 'CSS', category: 'languages', weight: 6,
    connections: ['HTML', 'React.js'],
    relatedProjects: ['CSULB ACM Website'],
  },
  { name: 'Rust', category: 'languages', weight: 7 },
  { name: 'PHP',  category: 'languages', weight: 4, connections: ['HTML'] },
  { name: 'Java', category: 'languages', weight: 4 },
  { name: 'C++',  category: 'languages', weight: 4, relatedProjects: ['Rosie the Wardriver'] },
  { name: 'C#',   category: 'languages', weight: 3 },
  { name: 'C',    category: 'languages', weight: 5 },

  // ── Frameworks & Tools ─────────────────────────────────────────
  {
    name: 'React.js', category: 'frameworks', weight: 9,
    connections: ['TypeScript', 'JavaScript', 'Next.js'],
    relatedProjects: ['CSULB ACM Website', 'Portfolio Website', 'Thumbo.app', 'FooDood', 'Down — Social Media App'],
  },
  {
    name: 'Next.js', category: 'frameworks', weight: 7,
    connections: ['React.js', 'TypeScript', 'Vercel'],
    relatedProjects: ['Thumbo.app', 'FooDood'],
  },
  {
    name: 'Astro.js', category: 'frameworks', weight: 6,
    connections: ['TypeScript', 'React.js'],
    relatedProjects: ['Portfolio Website'],
  },
  {
    name: 'Jest', category: 'frameworks', weight: 5,
    connections: ['TypeScript', 'React Native'],
    relatedProjects: ['Down — Social Media App'],
  },
  {
    name: 'Expo', category: 'frameworks', weight: 5,
    connections: ['React Native'],
    relatedProjects: ['FooDood', 'Down — Social Media App'],
  },
  {
    name: 'React Native', category: 'frameworks', weight: 6,
    connections: ['JavaScript', 'TypeScript', 'Firebase'],
    relatedProjects: ['FooDood', 'Down — Social Media App'],
  },
  {
    name: 'Node.js', category: 'frameworks', weight: 8,
    connections: ['TypeScript', 'JavaScript'],
  },
  {
    name: 'Docker', category: 'frameworks', weight: 8,
    connections: ['Python', 'AWS', 'Azure', 'DevSecOps', 'Git', 'Linux/UNIX'],
    relatedProjects: ['Thumbo.app'],
  },
  {
    name: 'Git', category: 'frameworks', weight: 10,
    connections: ['GitHub Enterprise', 'DevSecOps'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },
  {
    name: 'GitHub CLI', category: 'frameworks', weight: 6,
    connections: ['GitHub Enterprise', 'Git'],
  },
  {
    name: 'Linux/UNIX', category: 'frameworks', weight: 9,
    connections: ['Python', 'Docker', 'AWS', 'Azure', 'DevSecOps'],
  },

  // ── Security Tools (named products) ───────────────────────────
  {
    name: 'CrowdStrike', category: 'security-tools', weight: 10,
    connections: ['EDR', 'Incident Response', 'Malware Analysis'],
  },
  {
    name: 'Netskope', category: 'security-tools', weight: 8,
    connections: ['DLP', 'Zscaler'],
  },
  {
    name: 'Zscaler', category: 'security-tools', weight: 7,
    connections: ['Netskope', 'DLP'],
  },
  {
    name: 'Microsoft Sentinel', category: 'security-tools', weight: 7,
    connections: ['Splunk', 'SIEM', 'Azure'],
  },
  {
    name: 'Splunk', category: 'security-tools', weight: 9,
    connections: ['Microsoft Sentinel', 'SIEM', 'Incident Response'],
  },
  {
    name: 'Intune', category: 'security-tools', weight: 8,
    connections: ['Azure AD', 'Entra IAM', 'Azure', 'Mobile Security'],
  },
  {
    name: 'Azure AD', category: 'security-tools', weight: 7,
    connections: ['Entra IAM', 'Intune'],
  },
  {
    name: 'Entra IAM', category: 'security-tools', weight: 8,
    connections: ['Azure AD', 'Intune', 'Azure'],
  },
  {
    name: 'GitHub Enterprise', category: 'security-tools', weight: 7,
    connections: ['Git', 'DevSecOps', 'GitHub Actions', 'GitHub CLI'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },
  {
    name: 'Ansible', category: 'security-tools', weight: 5,
    connections: ['AWS', 'Azure', 'Terraform', 'GitHub Enterprise', 'DevSecOps'],
  },
  {
    name: 'Terraform', category: 'security-tools', weight: 6,
    connections: ['AWS', 'Azure', 'GitHub Enterprise', 'Ansible'],
  },
  {
    name: 'GitHub Actions', category: 'security-tools', weight: 7,
    connections: ['GitHub Enterprise', 'DevSecOps'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },

  // ── Security Skills (practices / concepts) ─────────────────────
  {
    name: 'SIEM', category: 'security-skills', weight: 9,
    connections: ['Splunk', 'Microsoft Sentinel', 'Incident Response'],
  },
  {
    name: 'EDR', category: 'security-skills', weight: 8,
    connections: ['CrowdStrike', 'DLP', 'Incident Response'],
  },
  {
    name: 'DLP', category: 'security-skills', weight: 8,
    connections: ['Netskope', 'Zscaler', 'EDR'],
  },
  {
    name: 'Incident Response', category: 'security-skills', weight: 9,
    connections: ['CrowdStrike', 'Splunk', 'SIEM', 'Digital Forensics'],
  },
  {
    name: 'Malware Analysis', category: 'security-skills', weight: 7,
    connections: ['Digital Forensics', 'Incident Response'],
  },
  {
    name: 'Vulnerability Mgmt', category: 'security-skills', weight: 7,
    connections: ['CrowdStrike', 'SIEM'],
  },
  {
    name: 'Digital Forensics', category: 'security-skills', weight: 6,
    connections: ['Malware Analysis', 'Incident Response'],
  },
  {
    name: 'AD Security', category: 'security-skills', weight: 7,
    connections: ['Entra IAM', 'Azure AD', 'Intune'],
  },
  {
    name: 'Cloud Security', category: 'security-skills', weight: 8,
    connections: ['AWS', 'Azure', 'DevSecOps'],
    relatedProjects: ['Thumbo.app', 'FooDood'],
  },
  {
    name: 'Mobile Security', category: 'security-skills', weight: 8,
    connections: ['Intune', 'Entra IAM'],
  },
  {
    name: 'DevSecOps', category: 'security-skills', weight: 9,
    connections: ['GitHub Enterprise', 'Docker', 'Python', 'GitHub Actions'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },

  // ── Cloud ──────────────────────────────────────────────────────
  {
    name: 'AWS', category: 'cloud', weight: 9,
    connections: ['Python', 'Docker', 'Azure', 'Terraform'],
    relatedProjects: ['Thumbo.app'],
  },
  {
    name: 'Azure', category: 'cloud', weight: 9,
    connections: ['Intune', 'Microsoft Sentinel', 'AWS', 'Entra IAM'],
  },
  {
    name: 'Google Cloud', category: 'cloud', weight: 5,
    connections: ['Firebase'],
    relatedProjects: ['FooDood'],
  },
  {
    name: 'Firebase', category: 'cloud', weight: 6,
    connections: ['React Native', 'Google Cloud'],
    relatedProjects: ['Thumbo.app', 'FooDood', 'Down — Social Media App'],
  },
  {
    name: 'Vercel', category: 'cloud', weight: 5,
    connections: ['Next.js'],
    relatedProjects: ['Thumbo.app'],
  },
  {
    name: 'DataDog', category: 'cloud', weight: 6,
    connections: ['AWS', 'Azure'],
  },
];

/** Display metadata per category */
export const CATEGORY_META: Record<SkillCategory, { label: string; color: string }> = {
  languages:        { label: 'Languages',          color: '#00FF41' },
  frameworks:       { label: 'Frameworks & Tools', color: '#00BFFF' },
  'security-tools': { label: 'Security Tools',     color: '#FF6B6B' },
  'security-skills':{ label: 'Security Skills',    color: '#FF9F43' },
  cloud:            { label: 'Cloud',              color: '#B48EFF' },
};
