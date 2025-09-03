# Cybersecurity Portfolio - Retro Terminal Interface

A comprehensive static portfolio website for cybersecurity engineers featuring a retro terminal aesthetic, interactive command-line interface, and cyberpunk design elements.

## 🚀 Features

### Design & Aesthetics
- **Retro Terminal Interface**: Monospaced JetBrains Mono font with authentic terminal styling
- **Cyberpunk Color Scheme**: Neon red (#ff3366), electric blue (#00bfff), purple (#9933ff), matrix green (#00ff41)
- **Visual Effects**: CRT scan lines, glowing text effects, animated matrix rain background
- **Responsive Design**: Works seamlessly on mobile, tablet, and desktop

### Interactive Terminal Console
- **Persistent Terminal**: Available on every page with functional CLI
- **Command Support**: 
  - `ls` - list available pages
  - `cat [page]` - navigate between pages
  - `whoami` - display bio information
  - `help` - show command reference
  - `clear` - clear terminal output
  - `pwd` - show current page location
  - `tree` - display site structure
  - `history` - show command history
  - `nmap` - simulate network scan
  - `ssh` - attempt remote connection
  - `sudo` - privilege escalation (logged)
- **Advanced Features**: Command history, tab completion, typewriter effects
- **Easter Eggs**: Konami code, hidden commands, security humor

### Page Structure
1. **Index Page**: ASCII banner, system status, featured projects, skills matrix
2. **About Page**: Extended bio, professional timeline, certifications, security philosophy
3. **Projects Page**: Detailed showcases with filtering, tech stacks, GitHub links
4. **Contact Page**: Secure terminal-style contact form, PGP key, encrypted messaging
5. **Admin Page**: Honeypot with fake login, warning banners, access logging
6. **Error Pages**: Custom 404, 403, 500 with cybersecurity themes

### Security Features
- **Honeypot Elements**: Fake credentials in HTML comments, canary tokens
- **Access Logging**: Console logging of suspicious activities
- **Security Headers**: CSP, HSTS, X-Frame-Options via .htaccess
- **Robots.txt**: Strategic disallowing to attract crawlers

## 📁 Project Structure

```
cybersec-portfolio/
├── index.html                 # Main landing page
├── about.html                 # About/bio page
├── projects.html              # Projects showcase
├── contact.html               # Contact form
├── admin.html                 # Honeypot admin page
├── 404.html                   # Custom 404 error
├── 403.html                   # Access denied error
├── 500.html                   # System compromise error
├── assets/
│   ├── css/
│   │   ├── style.css          # Main styles
│   │   ├── terminal.css       # Terminal interface
│   │   └── extended-styles.css # Additional components
│   └── js/
│       ├── terminal.js        # CLI functionality
│       └── main.js           # System status, effects
├── robots.txt                 # SEO and crawler management
├── sitemap.xml               # Site structure for SEO
├── .htaccess                 # Security headers, clean URLs
└── README.md                 # This file
```

## 🛠️ Setup Instructions

### Quick Start
1. **Download/Clone**: Get all files to your web directory
2. **Customize Content**: Update personal information in HTML files
3. **Configure Domain**: Update URLs in sitemap.xml and .htaccess
4. **Deploy**: Upload to your web server

### Customization Guide

#### Personal Information
Update the following placeholders in all HTML files:
- `[Your Name]` → Your actual name
- `your.email@domain.com` → Your email address
- `yourusername` → Your GitHub username
- `yourprofile` → Your LinkedIn profile
- `yourdomain.com` → Your website domain

#### Security Configuration
1. **Honeypot Setup**: 
   - Replace fake AWS credentials in admin.html comments
   - Update canary token URLs if using real tokens
   - Configure logging endpoints for honeypot data

2. **Content Security Policy**: 
   - Update CSP headers in .htaccess for your domain
   - Add any additional external resources you use

#### Project Customization
1. **Projects Section**: Update projects.html with your actual projects
2. **Skills Matrix**: Modify skill percentages in index.html
3. **Certifications**: Update badges in about.html
4. **Contact Info**: Add your real contact details

### Advanced Features

#### Terminal Commands
The interactive terminal supports these commands:
- **Navigation**: `cat index`, `cat about`, `cat projects`, `cat contact`
- **Information**: `whoami`, `pwd`, `tree`, `ls`
- **System**: `clear`, `exit`, `help`, `history`
- **Security**: `nmap`, `ssh`, `sudo` (logged as suspicious)
- **Easter Eggs**: Try the Konami code (↑↑↓↓←→←→BA)

#### Security Monitoring
- All honeypot interactions are logged to browser console
- Admin page access attempts are tracked
- Failed login attempts generate security alerts
- Custom error pages log access patterns

## 🔧 Technical Details

### Dependencies
- **Fonts**: Google Fonts (JetBrains Mono)
- **Framework**: Pure HTML/CSS/JavaScript (no external libraries)
- **Compatibility**: Modern browsers with ES6 support

### Performance
- Optimized CSS with compression
- Minimal JavaScript footprint
- Responsive images and assets
- Browser caching via .htaccess

### Security Headers
```apache
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: [configured for security]
```

### Browser Support
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ⚠️ IE not supported (by design)

## 🎨 Customization Options

### Color Themes
The cyberpunk color scheme can be modified in `assets/css/style.css`:
- **Neon Green**: `#00ff41` (primary)
- **Neon Red**: `#ff3366` (alerts)
- **Electric Blue**: `#00bfff` (links)
- **Purple**: `#9933ff` (secondary)
- **Dark Background**: `#0a0a0a`

### Terminal Behavior
Modify terminal functionality in `assets/js/terminal.js`:
- Add new commands in the `runCommand()` function
- Customize command responses and behaviors
- Adjust typing speed and effects

### Matrix Effect
The animated background can be configured in `assets/js/main.js`:
- Adjust character set and colors
- Modify drop speed and density
- Enable/disable the effect entirely

## 🚀 Deployment

### Local Testing
1. Open `index.html` in a web browser
2. Test all navigation and terminal commands
3. Verify responsive design on different screen sizes

### Web Server Deployment
1. Upload all files to your web root directory
2. Ensure `.htaccess` is supported (Apache)
3. Test all features in production environment
4. Monitor honeypot logs for security insights

### Domain Configuration
1. Update `sitemap.xml` with your domain
2. Configure DNS and SSL certificates
3. Test all external links and resources

## 📊 Analytics & Monitoring

### Honeypot Data
Monitor browser console for:
- Admin page access attempts
- Failed login submissions
- Suspicious command usage
- Canary token activations

### SEO Optimization
- Submit sitemap to search engines
- Monitor robots.txt effectiveness
- Track organic search performance
- Analyze crawler behavior

## 🔒 Security Considerations

### Real-World Usage
- Remove or replace fake credentials before production
- Implement server-side logging for honeypot data
- Configure real security headers
- Regular security audits and updates

### Legal Compliance
- Ensure honeypot activities comply with local laws
- Include privacy policy if collecting visitor data
- Consider GDPR/CCPA requirements for EU/CA visitors

## 🤝 Contributing

This is a template for cybersecurity portfolios. Feel free to:
- Fork and customize for your own use
- Submit improvements via pull requests
- Share additional security features
- Report bugs or compatibility issues

## 📄 License

This project is open source and available under the MIT License.

## 🎯 About

Created for cybersecurity professionals who want a portfolio that reflects their technical skills and security mindset. The retro terminal aesthetic pays homage to the roots of computing and hacking culture while providing a modern, professional presentation.

**Remember**: Update all placeholder content with your actual information before deployment!

---

*"Security is not a product, but a process."* - This portfolio demonstrates that philosophy through its interactive design and security-conscious features.
