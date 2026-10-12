/**
 * Work history: the single source for the About timeline, the terminal `experience` command and the
 * skill graph's "Used at" hover cards. Jobs are context for skills, not graph nodes.
 */

export interface Job {
    /** Stable slug, used for anchors (`/about#job-<id>`) and in tests. */
    id: string;
    date: string;
    role: string;
    org: string;
    /** Short label for hover cards and the terminal, e.g. "Yamaha". */
    shortOrg: string;
    /** Display chips on the timeline (may include tools that aren't graph skills, e.g. SAP). */
    tech: string[];
    /** Names from `skills.ts` this job used. Drives the graph's "Used at" list (tests enforce they exist). */
    skills: string[];
    details: string[];
}

export const jobs: Job[] = [
    {
        id: 'yamaha-cyber',
        date: 'Aug 2023 – Present',
        role: 'Cybersecurity Engineer',
        org: 'Yamaha Motor Corporation — Cypress, CA',
        shortOrg: 'Yamaha',
        tech: [
            'GitHub Enterprise',
            'infrastructure as Code',
            'Netskope',
            'CrowdStrike',
            'Zscaler',
            'Azure',
            'Intune',
            'Python',
            'AWS',
        ],
        skills: [
            'GitHub Enterprise',
            'Netskope',
            'CrowdStrike',
            'Zscaler',
            'Azure',
            'Intune',
            'Python',
            'AWS',
            'DevSecOps',
            'GitHub Actions',
            'SIEM',
            'Incident Response',
            'Data Loss Prevention',
            'Endpoint Detection & Response',
            'Terraform',
            'Ansible',
        ],
        details: [
            'Manages on-prem and cloud security operations',
            'Implements and manages DevSecOps practices using GitHub Actions and GitHub Enterprise',
            'Develops infrastructure as code using infrastructure as Code',
            'Oversees enterprise cybersecurity tool management including Netskope, CrowdStrike, and Zscaler',
            'Manages Azure infrastructure, groups, and mobile devices through Intune',
            'Builds and maintains CI/CD pipelines with embedded security checks and compliance gates',
            'Develops and maintains SIEM platforms for real-time visibility, detection, and incident response',
            'Automates log collection, normalization, and enrichment across cloud, endpoint, and SaaS sources',
            'Deploys and manages EDR solutions and implements DLP controls',
            'Assists in leading security operations including triage, investigation, containment, and remediation',
        ],
    },
    {
        id: 'yamaha-sap',
        date: 'May 2022 – Aug 2022',
        role: 'Business Application Development Intern',
        org: 'Yamaha Motor Corporation — Cypress, CA',
        shortOrg: 'Yamaha',
        tech: ['ABAP', 'SAP', 'Python', 'React.js'],
        skills: ['Python', 'React.js'],
        details: [
            'Designed and presented testing methods to ensure quality of newly developed code and data',
            'Developed custom SAP programs using the ABAP programming language',
            'Utilized ABAP, SAP, Python, and React.js to support development of advanced business applications',
            'Provided support in transitioning web technologies and frameworks',
        ],
    },
    {
        id: 'asi-web',
        date: 'Feb 2020 – May 2022 & Oct 2022 – Jul 2023',
        role: 'Web Developer',
        org: 'Associated Students Inc. — Long Beach, CA',
        shortOrg: 'ASI',
        tech: ['HTML', 'CSS', 'PHP', 'Joomla', 'React.js', 'Google Analytics', 'WordPress'],
        skills: ['HTML', 'CSS', 'PHP', 'React.js'],
        details: [
            'Led a team of graduate student developers and conducted interviews to hire new web developers',
            'Improved ASI websites with SEO, website merging, and daily content updates for campus events',
            'Developed and deployed a quiz game for incoming freshmen during the COVID-19 Pandemic using React.js',
            'Assisted with the development and deployment of web-related applications for the Student Union and Student Recreation Center',
        ],
    },
    {
        id: 'down-security',
        date: 'May 2021 – Jan 2022',
        role: 'Lead Security Engineer',
        org: 'Down (joindown.com) — Remote',
        shortOrg: 'Down',
        tech: ['TypeScript', 'React Native', 'Expo', 'Jest/Detox', 'GitHub', 'Firebase'],
        skills: ['TypeScript', 'React Native', 'Expo', 'Jest', 'Firebase', 'Git', 'App Security'],
        details: [
            'Coordinated development and testing of Android and iOS components for React Native social media app',
            'Developed security rules and tested the React Native application using Jest and Detox libraries',
            'Led the development of security and testing with Firebase storage',
        ],
    },
    {
        id: 'down-friend-groups',
        date: 'Jun 2021 – Aug 2021',
        role: 'Software Development Lead',
        org: 'Down Friend Groups — Remote',
        shortOrg: 'Down Friend Groups',
        tech: ['React Native', 'JavaScript'],
        skills: ['React Native', 'JavaScript'],
        details: ['Led software development efforts for the Down Friend Groups team'],
    },
    {
        id: 'mr-mold',
        date: 'Jul 2018 – Jun 2019',
        role: 'Intern / Laser Technician',
        org: 'M.R. Mold and Engineering — Brea, CA',
        shortOrg: 'M.R. Mold',
        tech: ['Solidworks', '3D Modeling', 'QC Software'],
        skills: [],
        details: [
            'Founded internship program and acted as liaison to Brea Olinda High School for future interns',
            'Learned cutting-edge plastic and silicone molding methods and 3D modeling with Solidworks',
            'Produced laser-engraved steel products and developed software to quality-control precision silicone parts',
        ],
    },
];

/** skill name → jobs that used it, in timeline order (most recent first). */
export const JOBS_BY_SKILL: ReadonlyMap<string, readonly Job[]> = (() => {
    const m = new Map<string, Job[]>();
    for (const job of jobs) {
        for (const s of job.skills) {
            if (!m.has(s)) m.set(s, []);
            m.get(s)!.push(job);
        }
    }
    return m;
})();
