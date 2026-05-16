export type SkillCategory = 'languages' | 'frameworks' | 'security' | 'cloud';

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
    name: 'TypeScript', category: 'languages', weight: 9,
    connections: ['React.js', 'Node.js', 'Jest', 'Next.js'],
    relatedProjects: ['Thumbo.app', 'Portfolio Website', 'Down — Social Media App'],
  },
  {
    name: 'Python', category: 'languages', weight: 9,
    connections: ['Docker', 'AWS', 'Azure'],
  },
  {
    name: 'JavaScript', category: 'languages', weight: 8,
    connections: ['React.js', 'Node.js', 'React Native'],
    relatedProjects: ['CSULB ACM Website'],
  },
  {
    name: 'HTML5', category: 'languages', weight: 6,
    connections: ['CSS'],
    relatedProjects: ['CSULB ACM Website'],
  },
  {
    name: 'CSS', category: 'languages', weight: 6,
    connections: ['HTML5', 'React.js'],
    relatedProjects: ['CSULB ACM Website'],
  },
  { name: 'Rust',  category: 'languages', weight: 4 },
  { name: 'PHP',   category: 'languages', weight: 4, connections: ['HTML5'] },
  { name: 'Java',  category: 'languages', weight: 4 },
  { name: 'C++',   category: 'languages', weight: 4, relatedProjects: ['Rosie the Wardriver'] },
  { name: 'C#',    category: 'languages', weight: 3 },

  // ── Frameworks & Tools ─────────────────────────────────────────
  {
    name: 'React.js', category: 'frameworks', weight: 9,
    connections: ['TypeScript', 'JavaScript', 'Next.js'],
    relatedProjects: ['CSULB ACM Website', 'Portfolio Website'],
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
    name: 'Expo', category: 'frameworks', weight: 4,
    connections: ['React Native'],
    relatedProjects: ['FooDood', 'Down — Social Media App'],
  },
  {
    name: 'React Native', category: 'frameworks', weight: 6,
    connections: ['JavaScript', 'TypeScript', 'Firebase'],
    relatedProjects: ['FooDood', 'Down — Social Media App'],
  },
  {
    name: 'Node.js', category: 'frameworks', weight: 7,
    connections: ['TypeScript', 'JavaScript'],
  },
  {
    name: 'Docker', category: 'frameworks', weight: 7,
    connections: ['Python', 'AWS', 'Azure'],
    relatedProjects: ['Thumbo.app'],
  },
  {
    name: 'Git', category: 'frameworks', weight: 8,
    connections: ['GitHub Enterprise', 'DevSecOps'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },
  {
    name: 'Linux/UNIX', category: 'frameworks', weight: 7,
    connections: ['Python', 'Docker'],
  },

  // ── Security ───────────────────────────────────────────────────
  {
    name: 'CrowdStrike', category: 'security', weight: 9,
    connections: ['EDR', 'Incident Response'],
  },
  {
    name: 'Netskope', category: 'security', weight: 8,
    connections: ['DLP', 'Zscaler'],
  },
  {
    name: 'Zscaler', category: 'security', weight: 8,
    connections: ['Netskope', 'DLP'],
  },
  {
    name: 'Microsoft Sentinel', category: 'security', weight: 8,
    connections: ['Splunk', 'SIEM', 'Azure'],
  },
  {
    name: 'Splunk', category: 'security', weight: 7,
    connections: ['Microsoft Sentinel', 'SIEM', 'Incident Response'],
  },
  {
    name: 'SIEM', category: 'security', weight: 8,
    connections: ['Splunk', 'Microsoft Sentinel', 'Incident Response'],
  },
  {
    name: 'EDR', category: 'security', weight: 7,
    connections: ['CrowdStrike', 'DLP'],
  },
  {
    name: 'DLP', category: 'security', weight: 7,
    connections: ['Netskope', 'Zscaler', 'EDR'],
  },
  {
    name: 'Entra IAM', category: 'security', weight: 7,
    connections: ['Azure AD', 'Intune', 'Azure'],
  },
  {
    name: 'Azure AD', category: 'security', weight: 7,
    connections: ['Entra IAM', 'Intune'],
  },
  {
    name: 'Intune', category: 'security', weight: 7,
    connections: ['Azure AD', 'Entra IAM', 'Azure'],
  },
  {
    name: 'Incident Response', category: 'security', weight: 8,
    connections: ['CrowdStrike', 'Splunk', 'SIEM', 'Digital Forensics'],
  },
  {
    name: 'Malware Analysis', category: 'security', weight: 6,
    connections: ['Digital Forensics', 'Incident Response'],
  },
  {
    name: 'Vulnerability Mgmt', category: 'security', weight: 6,
    connections: ['CrowdStrike', 'SIEM'],
  },
  {
    name: 'Digital Forensics', category: 'security', weight: 6,
    connections: ['Malware Analysis', 'Incident Response'],
  },
  {
    name: 'GitHub Enterprise', category: 'security', weight: 7,
    connections: ['Git', 'DevSecOps'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },
  {
    name: 'DevSecOps', category: 'security', weight: 9,
    connections: ['GitHub Enterprise', 'Docker', 'Python'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },

  // ── Cloud ──────────────────────────────────────────────────────
  {
    name: 'AWS', category: 'cloud', weight: 8,
    connections: ['Python', 'Docker', 'Azure'],
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
];

/** Display metadata per category */
export const CATEGORY_META: Record<SkillCategory, { label: string; color: string }> = {
  languages:  { label: 'Languages',          color: '#00FF41' },
  frameworks: { label: 'Frameworks & Tools', color: '#00BFFF' },
  security:   { label: 'Security',           color: '#FF6B6B' },
  cloud:      { label: 'Cloud',              color: '#B48EFF' },
};
