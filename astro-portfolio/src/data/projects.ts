export interface ProjectLink {
  label: string;
  href: string;
}

export interface ProjectImage {
  /** Public path served from /public, e.g. /images/projects/foo.jpg */
  src: string;
  alt: string;
  caption?: string;
}

export interface ProjectSection {
  heading: string;
  items: string[];
}

export interface Project {
  id: string;
  tag: string;
  title: string;
  date?: string;
  /** Paragraphs shown on the projects page */
  descriptions: string[];
  /** Optional highlight/feature bullet sections */
  sections?: ProjectSection[];
  tech: string[];
  links?: ProjectLink[];
  /** Optional photos shown in a gallery inside the project card */
  images?: ProjectImage[];
  /** Whether to show this project in the homepage featured grid */
  featured?: boolean;
  /** Short title override for the homepage card (falls back to title) */
  featuredTitle?: string;
  /** Short tag override for the homepage card (falls back to tag) */
  featuredTag?: string;
  /** Short description for the homepage card (falls back to descriptions[0]) */
  featuredDesc?: string;
  /** Tech list override for the homepage card (falls back to tech) */
  featuredTech?: string[];
}

const projects: Project[] = [
  {
    id: 'rosie',
    tag: 'Hardware / Wardriving',
    title: 'Rosie the Wardriver',
    date: 'DEF CON 33 — 2025',
    featured: true,
    featuredTitle: 'Rosie the Wardriver',
    featuredTag: 'Hardware / Wardriving',
    featuredDesc: 'A mobile cybersecurity demonstration platform built by repurposing an abandoned commercial Android service robot.',
    descriptions: [
      'A mobile cybersecurity demonstration platform built by repurposing an abandoned commercial Android service robot. Rosie transforms a stationary kiosk into a rolling wardriving unit capable of WiFi reconnaissance and RF signal mapping, showcased at DEF CON 33 and other cybersecurity conferences.',
      'Built with the National Upcycled Computing Collective (NUCC), a Southern California hacker nonprofit that repurposes decommissioned computing equipment for educational cybersecurity programs. The project demonstrates practical embedded systems design through creative hardware repurposing.',
    ],
    sections: [
      {
        heading: 'Highlights',
        items: [
          'Differential drive mobility using repurposed hoverboard hub motors with tank steering',
          'Dual-sensor wardriving stack — Android robot paired with an integrated Meta Quest 3S running Kali NetHunter',
          'ESP32 motor-control firmware in C++ with wireless telemetry and Wii Nunchuck input over I2C',
          'Modular power architecture using XT60 connectors and magnetic pogo pins for field servicing',
          'Custom 3D-printed mounts for headset integration and cable management',
          'Live conference display featuring WiFi scanning, packet visualization, and animated demos',
        ],
      },
    ],
    tech: ['ESP32', 'C++', 'Android', 'Kali NetHunter', 'Termux', 'Kismet', 'WiGLE', 'I2C', '3D Printing'],
    images: [
      {
        src: '/images/projects/defcon-feature.jpg',
        alt: 'Stephen Lyons with Rosie the Wardriver at DEF CON 33',
        caption: 'DEF CON 33, Las Vegas 2025',
      },
      {
        src: '/images/projects/hackster-feature.jpg',
        alt: 'Rosie the Wardriver robot on the conference floor',
        caption: 'Conference floor display',
      },
    ],
    links: [
      { label: 'View on GitHub →', href: 'https://github.com/stephenlyons18/rosie' },
      { label: 'View on Hackster.io →', href: 'https://www.hackster.io/news/a-networked-porta-potty-and-more-absurdity-at-def-con-s-scavenger-hunt-475ee8c567ca' },
      { label: 'View on HackerPhotos →', href: 'https://www.hackerphotos.com/picture.php?/61246/category/43' },
    ],
  },
  {
    id: 'thumbo',
    tag: 'Freelance Full-Stack Engineer',
    title: 'Thumbo.app',
    date: 'Aug 2022 – Dec 2023',
    descriptions: [
      'Developed the MVP for a stadium and fan entertainment site enabling real-time chatting, trivia, and polls from attendees. Built the front-end experience for both mobile devices and Jumbotron displays, and managed full deployment pipeline via AWS.',
      'The platform allows event organizers to engage live audiences through interactive features, providing a seamless experience from personal devices to large-screen stadium displays.',
    ],
    sections: [
      {
        heading: 'Key Contributions',
        items: [
          'Architected and developed the full-stack MVP from concept to deployment',
          'Built responsive mobile UI and large-format Jumbotron display interface',
          'Implemented real-time chatting, trivia games, and audience polling features',
          'Managed containerized deployments with Docker on AWS infrastructure',
          'Configured CI/CD pipeline for automated testing and deployments via Vercel and AWS',
        ],
      },
    ],
    tech: ['Next.js', 'TypeScript', 'TailwindCSS', 'Firebase', 'Docker', 'AWS', 'Vercel', 'GitHub'],
    links: [{ label: 'Visit thumbo.app →', href: 'https://thumbo.app' }],
    featured: true,
    featuredTag: 'Full-Stack',
    featuredDesc:
      'Developed MVP for a stadium and fan entertainment platform enabling real-time chatting, trivia, and polls from attendees. Implemented mobile and Jumbotron display experiences.',
    featuredTech: ['Next.js', 'TypeScript', 'TailwindCSS', 'Firebase', 'AWS', 'Docker'],
  },
  {
    id: 'foodood',
    tag: 'CSULB Senior Project',
    title: 'FooDood',
    date: 'Sep 2022 – May 2023',
    descriptions: [
      'A food-finding swiper mobile application that recommends personalized dishes from nearby restaurants. Users swipe through curated dish suggestions based on their preferences, location, and ratings from Google Business Profile and Yelp APIs.',
      'Built as a senior capstone project at CSULB, the app demonstrates end-to-end mobile development from user experience design to API integration and cloud deployment.',
    ],
    sections: [
      {
        heading: 'Key Features',
        items: [
          'Swipe-based UI for intuitive dish discovery and selection',
          'Personalized recommendations using machine learning and user preference data',
          'Integration with Google Business Profile API and Yelp API for restaurant data',
          'Real-time data sync via Firebase with Google Cloud backend',
          'Cross-platform mobile app built with React Native and Expo',
        ],
      },
    ],
    tech: ['React Native', 'Expo', 'Next.js', 'Google Cloud', 'Firebase', 'Google Business Profile API', 'Yelp API'],
    links: [{ label: 'View on GitHub →', href: 'https://github.com/Brenden-Smith/FooDood' }],
    featured: true,
    featuredTag: 'Mobile App',
    featuredDesc:
      'Food-finding swiper mobile application that recommends personalized dishes from nearby restaurants using Google Business Profile and Yelp APIs.',
    featuredTech: ['React Native', 'Expo', 'Next.js', 'Google Cloud', 'Firebase'],
  },
  {
    id: 'security-automation',
    tag: 'DevSecOps',
    title: 'GitHub Actions Security Pipelines',
    date: 'Ongoing',
    descriptions: [
      'A collection of GitHub Actions workflows implementing security-first CI/CD practices. Includes automated secret scanning with TruffleHog, code formatting enforcement with Prettier, and broken link checking for static sites.',
    ],
    sections: [
      {
        heading: 'Workflows',
        items: [
          'Secret Scanning — TruffleHog scans every push and PR for accidentally committed credentials',
          'Code Formatting — Prettier checks enforce consistent style across HTML, CSS, and JS',
          'Link Checker — Weekly and on-push scans detect broken internal and external links',
        ],
      },
    ],
    tech: ['GitHub Actions', 'TruffleHog', 'Prettier', 'YAML', 'CI/CD'],
    featured: true,
    featuredTitle: 'Security Automation',
    featuredDesc:
      'GitHub Actions pipelines for secret scanning, code formatting, and broken link detection. CI/CD with security gates baked into every workflow.',
    featuredTech: ['GitHub Actions', 'TruffleHog', 'Prettier', 'YAML'],
  },
  {
    id: 'portfolio',
    tag: 'Personal',
    title: 'Portfolio Website',
    date: '2026',
    descriptions: [
      'This very site — a terminal-themed cybersecurity portfolio built with Astro, TypeScript, Tailwind, and Motion. Features an interactive terminal overlay (Ctrl+K), Matrix rain backgrounds, CRT scanline effects, View Transitions, and a fully responsive design.',
    ],
    sections: [
      {
        heading: 'Highlights',
        items: [
          'Interactive terminal with tab-completion, command history, and themed output',
          'Terminal boot sequence, typing animations, and glitch effects',
          'Canvas-based matrix rain background and CSS scanline overlays',
          'Theme switching (green/cyan/amber) via terminal command',
          'Astro static output, Motion-powered React islands, and View Transitions',
          'Deployed as static files — minimal client JS',
        ],
      },
    ],
    tech: ['Astro', 'TypeScript', 'Tailwind CSS', 'Motion', 'React'],
  },
  {
    id: 'down',
    tag: 'Security Engineering',
    title: 'Down — Social Media App',
    date: 'May 2021 – Jan 2022',
    descriptions: [
      'Led security engineering for a React Native social media application. Coordinated development and testing across Android and iOS platforms, implemented Firebase security rules, and built comprehensive test suites with Jest and Detox.',
    ],
    tech: ['TypeScript', 'React Native', 'Expo', 'Firebase', 'Jest', 'Detox', 'GitHub'],
    links: [{ label: 'Visit joindown.com →', href: 'https://joindown.com' }],
  },
  {
    id: 'acm',
    tag: 'Club Webmaster',
    title: 'CSULB ACM Website',
    date: '2022 – 2023',
    descriptions: [
      'Served as Webmaster for the CSULB Association for Computing Machinery (ACM) chapter, maintaining and improving the club\'s website to serve the computer science community at Long Beach.',
    ],
    tech: ['HTML', 'CSS', 'JavaScript', 'React.js'],
    links: [
      { label: 'Visit acm.csulb.org →', href: 'https://acm.csulb.org' },
      { label: 'View on GitHub →', href: 'https://github.com/csulbacm/ACM-Website-2022' },
    ],
  },
];

export default projects;

/** Projects shown in the homepage featured grid, in display order */
export const featuredProjects = projects.filter((p) => p.featured);
