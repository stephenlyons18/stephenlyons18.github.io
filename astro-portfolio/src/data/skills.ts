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
    connections: ['React.js', 'Node.js', 'Jest', 'Next.js', 'Astro.js', 'HTML', 'CSS', 'Git', 'JavaScript', 'React Native', 'App Security', 'GitHub Actions', 'GitHub Enterprise', 'DevSecOps', 'AWS'],
    relatedProjects: ['Thumbo.app', 'Portfolio Website', 'Down — Social Media App'],
  },
  {
    name: 'Python', category: 'languages', weight: 10,
    connections: ['Docker', 'AWS', 'Azure', 'DevSecOps', 'GitHub Actions', 'GitHub Enterprise', 'DataDog', 'Cloud Security', 'Wiz', 'Linux/UNIX', 'Git', 'App Security', 'GitHub CLI'],
  },
  {
    name: 'JavaScript', category: 'languages', weight: 8,
    connections: ['React.js', 'Node.js', 'React Native', 'Next.js', 'Astro.js', 'HTML', 'CSS', 'Git', 'TypeScript', 'App Security'],
    relatedProjects: ['CSULB ACM Website', 'Thumbo.app', 'Portfolio Website', 'Down — Social Media App', 'FooDood'],
  },
  {
    name: 'HTML', category: 'languages', weight: 9,
    connections: ['CSS', 'Git', 'TypeScript', 'JavaScript', 'React.js', 'Next.js', 'Astro.js', 'PHP'],
    relatedProjects: ['CSULB ACM Website', 'Portfolio Website', 'Thumbo.app', 'FooDood', 'Down — Social Media App', 'CSULB ACM Website'],
  },
  {
    name: 'CSS', category: 'languages', weight: 6,
    connections: ['HTML', 'React.js', 'Next.js', 'Astro.js', 'Git', 'TypeScript', 'JavaScript'],
    relatedProjects: ['CSULB ACM Website', 'Thumbo.app', 'FooDood', 'Down — Social Media App', 'Portfolio Website' ],
  },
  { name: 'Rust', category: 'languages', weight: 7 },
  { name: 'Go',   category: 'languages', weight: 7, connections: ['Git'] },
  { name: 'PHP',  category: 'languages', weight: 4, connections: ['HTML'] },
  { name: 'Java', category: 'languages', weight: 4 },
  { name: 'C++',  category: 'languages', weight: 4, relatedProjects: ['Rosie the Wardriver'] },
  { name: 'C#',   category: 'languages', weight: 3 },
  { name: 'C',    category: 'languages', weight: 5 },

  // ── Frameworks & Tools ─────────────────────────────────────────
  {
    name: 'React.js', category: 'frameworks', weight: 9,
    connections: ['TypeScript', 'JavaScript', 'Next.js', 'Astro.js', 'Node.js', 'HTML', 'CSS', 'App Security', 'Jest', 'React Native'],
    relatedProjects: ['CSULB ACM Website', 'Portfolio Website', 'Thumbo.app', 'FooDood', 'Down — Social Media App'],
  },
  {
    name: 'Next.js', category: 'frameworks', weight: 7,
    connections: ['React.js', 'TypeScript', 'Vercel', 'App Security', 'GitHub Actions', 'Git', 'JavaScript', 'HTML', 'CSS', 'Jest', 'Node.js', 'Astro.js'],
    relatedProjects: ['Thumbo.app', 'FooDood'],
  },
  {
    name: 'Astro.js', category: 'frameworks', weight: 6,
    connections: ['TypeScript', 'React.js', 'JavaScript', 'HTML', 'CSS', 'App Security', 'GitHub Actions', 'Git'],
    relatedProjects: ['Portfolio Website'],
  },
  {
    name: 'Jest', category: 'frameworks', weight: 5,
    connections: ['TypeScript', 'React Native', 'App Security', 'JavaScript', 'React.js', 'Next.js', 'Jest', 'Node.js'],
    relatedProjects: ['Down — Social Media App'],
  },
  {
    name: 'Expo', category: 'frameworks', weight: 5,
    connections: ['React Native', 'TypeScript', 'JavaScript', 'App Security'],
    relatedProjects: ['FooDood', 'Down — Social Media App'],
  },
  {
    name: 'React Native', category: 'frameworks', weight: 6,
    connections: ['JavaScript', 'TypeScript', 'Firebase', 'Jest', 'Expo', 'App Security'],
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
    connections: ['GitHub Enterprise', 'DevSecOps', 'GitHub CLI', 'Python', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Go', 'Astro.js', 'Next.js', 'React.js', 'AWS'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },
  {
    name: 'GitHub CLI', category: 'frameworks', weight: 6,
    connections: ['GitHub Enterprise', 'Git', 'DevSecOps', 'GitHub Actions', 'App Security', 'Python'],
  },
  {
    name: 'Linux/UNIX', category: 'frameworks', weight: 9,
    connections: ['Python', 'Docker', 'AWS', 'Azure', 'DevSecOps', 'AWS', 'Azure', 'Google Cloud'],
  },

  // ── Security Tools (named products) ───────────────────────────
  {
    name: 'CrowdStrike', category: 'security-tools', weight: 10,
    connections: ['Endpoint Detection & Response', 'Incident Response', 'Malware Analysis', 'Vulnerability Mgmt', 'Digital Forensics', 'SIEM', 'Python', 'AD Security'],
  },
  {
    name: 'Netskope', category: 'security-tools', weight: 8,
    connections: ['Data Loss Prevention', 'Zscaler', 'Endpoint Detection & Response', 'SIEM'],
  },
  {
    name: 'Zscaler', category: 'security-tools', weight: 7,
    connections: ['Netskope', 'Data Loss Prevention', 'Endpoint Detection & Response', 'SIEM'],
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
    connections: ['Entra IAM', 'Intune', 'CrowdStrike', 'AD Security', 'Azure'],
  },
  {
    name: 'Entra IAM', category: 'security-tools', weight: 8,
    connections: ['Azure AD', 'Intune', 'Azure'],
  },
  {
    name: 'GitHub Enterprise', category: 'security-tools', weight: 7,
    connections: ['Git', 'DevSecOps', 'GitHub Actions', 'GitHub CLI', 'App Security', 'Python', 'Splunk', 'SIEM', 'AWS', 'Terraform'],
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
    connections: ['GitHub Enterprise', 'DevSecOps', 'GitHub CLI', 'TypeScript', 'JavaScript', 'App Security'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },
  {
    name: 'Wiz', category: 'security-skills', weight: 7,
    connections: ['Cloud Security', 'AWS', 'Azure', 'DevSecOps', 'Vulnerability Mgmt', 'Python'],
  },

  // ── Security Skills (practices / concepts) ─────────────────────
  {
    name: 'SIEM', category: 'security-skills', weight: 9,
    connections: ['Splunk', 'Microsoft Sentinel', 'Incident Response', 'CrowdStrike', 'Zscaler', 'Netskope', 'Malware Analysis', 'Python', 'GitHub Enterprise'],
  },
  {
    name: 'Endpoint Detection & Response', category: 'security-skills', weight: 8,
    connections: ['CrowdStrike', 'Data Loss Prevention', 'Incident Response', 'Malware Analysis', 'Netskope', 'Zscaler', 'SIEM'],
  },
  {
    name: 'Data Loss Prevention', category: 'security-skills', weight: 8,
    connections: ['Netskope', 'Zscaler', 'Endpoint Detection & Response', 'SIEM'],
  },
  {
    name: 'Incident Response', category: 'security-skills', weight: 9,
    connections: ['CrowdStrike', 'Splunk', 'SIEM', 'Digital Forensics', 'GitHub Enterprise', 'Endpoint Detection & Response'],
  },
  {
    name: 'Malware Analysis', category: 'security-skills', weight: 7,
    connections: ['Digital Forensics', 'Incident Response', 'CrowdStrike', 'Splunk', 'SIEM'],
  },
  {
    name: 'Vulnerability Mgmt', category: 'security-skills', weight: 7,
    connections: ['CrowdStrike', 'SIEM', 'Wiz', 'Cloud Security'],
  },
  {
    name: 'Digital Forensics', category: 'security-skills', weight: 6,
    connections: ['Malware Analysis', 'Incident Response', 'CrowdStrike', 'Splunk', 'SIEM'],
  },
  {
    name: 'AD Security', category: 'security-skills', weight: 7,
    connections: ['Entra IAM', 'Azure AD', 'CrowdStrike', 'Intune'],
  },
  {
    name: 'Cloud Security', category: 'security-skills', weight: 8,
    connections: ['AWS', 'Azure', 'DevSecOps', 'DataDog', 'Wiz', 'Vulnerability Mgmt', 'Python', 'Google Cloud'],
    relatedProjects: ['Thumbo.app', 'FooDood'],
  },
  {
    name: 'Mobile Security', category: 'security-skills', weight: 8,
    connections: ['Intune', 'Entra IAM'],
  },
  {
    name: 'App Security', category: 'security-skills', weight: 7,
     connections: ['DevSecOps', 'GitHub Enterprise', 'GitHub Actions', 'TypeScript', 'JavaScript', 'React.js', 'Next.js', 'Astro.js', 'AWS', 'Wiz', 'Cloud Security', 'DataDog', 'Jest', 'React Native', 'Python'],
     relatedProjects: ['Thumbo.app', 'FooDood', 'Down — Social Media App'],
  },

  {
    name: 'DevSecOps', category: 'security-skills', weight: 9,
    connections: ['GitHub Enterprise', 'Docker', 'Python', 'GitHub Actions', 'Ansible', 'Terraform', 'AWS', 'Azure', 'Google Cloud', 'Cloud Security', 'Wiz', 'TypeScript', 'JavaScript', 'App Security'],
    relatedProjects: ['GitHub Actions Security Pipelines'],
  },

  // ── Cloud ──────────────────────────────────────────────────────
  {
    name: 'AWS', category: 'cloud', weight: 9,
    connections: ['Python', 'Docker', 'Azure', 'Terraform', 'DataDog', 'Cloud Security', 'Wiz', 'Google Cloud', 'Next.js', 'Linux/UNIX', 'App Security', 'DevSecOps', 'GitHub Actions', 'GitHub Enterprise', 'Vercel', 'Firebase'],
    relatedProjects: ['Thumbo.app'],
  },
  {
    name: 'Azure', category: 'cloud', weight: 9,
    connections: ['Intune', 'Microsoft Sentinel', 'AWS', 'Entra IAM', 'DataDog', 'Cloud Security', 'Wiz'],
  },
  {
    name: 'Google Cloud', category: 'cloud', weight: 5,
    connections: ['Firebase', 'Cloud Security', 'Wiz', 'AWS', 'Linux/UNIX'],
    relatedProjects: ['FooDood'],
  },
  {
    name: 'Firebase', category: 'cloud', weight: 6,
    connections: ['React Native', 'Google Cloud', 'AWS'],
    relatedProjects: ['Thumbo.app', 'FooDood', 'Down — Social Media App'],
  },
  {
    name: 'Vercel', category: 'cloud', weight: 5,
    connections: ['Next.js', 'Next.js', 'AWS'],
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
