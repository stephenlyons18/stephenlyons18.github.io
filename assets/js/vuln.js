// Vulnerable JavaScript file for demonstration purposes
// This file contains intentional security vulnerabilities for CodeQL testing
// DO NOT USE IN PRODUCTION

// 1. DOM-based XSS vulnerability
function displayUserInput() {
    const userInput = new URLSearchParams(window.location.search).get('message');
    if (userInput) {
        // Vulnerable: Direct insertion of user input into DOM
        document.getElementById('output').innerHTML = userInput;
    }
}

// 2. Prototype pollution vulnerability
function mergeObjects(target, source) {
    for (let key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            // Vulnerable: No check for __proto__ or constructor
            target[key] = target[key] || {};
            mergeObjects(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

// 3. Insecure randomness for security purposes
function generateSessionId() {
    // Vulnerable: Using Math.random() for security-sensitive operations
    return Math.random().toString(36).substr(2, 9);
}

// 4. Clear text storage of sensitive data
function storeCredentials(username, password) {
    // Vulnerable: Storing sensitive data in plain text
    localStorage.setItem('username', username);
    localStorage.setItem('password', password);
    console.log('Stored credentials for:', username);
}

// 5. Unsafe dynamic method call
function callUserMethod(methodName, obj) {
    // Vulnerable: Calling methods based on user input without validation
    if (obj[methodName]) {
        return obj[methodName]();
    }
}

// 6. Weak regular expression (ReDoS potential)
function validateInput(input) {
    // Vulnerable: Regex susceptible to catastrophic backtracking
    const pattern = /^(a+)+$/;
    return pattern.test(input);
}

// 7. Incomplete URL validation
function isSecureUrl(url) {
    // Vulnerable: Incomplete URL scheme check
    return url.indexOf('https://') === 0;
}

// 8. Unsafe HTML construction
function createNotification(message) {
    // Vulnerable: Building HTML with user input
    const html = '<div class="notification">' + message + '</div>';
    document.body.innerHTML += html;
}

// Demo initialization (safe)
if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
        // Only run demo code, not the vulnerable functions
        console.log('Vulnerable demo file loaded - for testing purposes only');
    });
}