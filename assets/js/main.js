// Main JS for system status and matrix rain effect
function updateUptime() {
  const uptime = document.getElementById('uptime');
  let start = Date.now();
  setInterval(() => {
    let diff = Date.now() - start;
    let h = Math.floor(diff / 3600000);
    let m = Math.floor((diff % 3600000) / 60000);
    let s = Math.floor((diff % 60000) / 1000);
    uptime.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }, 1000);
}
updateUptime();

// Optimized Matrix rain effect
const canvas = document.createElement('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '1';
canvas.style.pointerEvents = 'none';
document.getElementById('matrix-bg').appendChild(canvas);
const ctx = canvas.getContext('2d');

// Optimize: Limit columns to prevent excessive computation on wide screens
const maxCols = 100; // Cap at 100 columns for performance
const cols = Math.min(Math.floor(canvas.width / 20), maxCols);
const chars = 'abcdefghijklmnopqrstuvwxyz0123456789@#$%&';
let drops = Array(cols).fill(1);

// Optimize: Use requestAnimationFrame for smoother, browser-synced updates
let animationId;
function drawMatrix() {
  // Semi-transparent fill for trail effect (reduced opacity for less redraw)
  ctx.fillStyle = 'rgba(10,10,10,0.1)'; // Reduced from 0.15 to 0.1
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.font = '18px JetBrains Mono';
  ctx.fillStyle = '#00ff41';
  
  // Optimize: Loop only over active columns
  for (let i = 0; i < drops.length; i++) {
    // Random character (kept simple)
    let text = chars[Math.floor(Math.random() * chars.length)];
    ctx.fillText(text, i * 20, drops[i] * 20);
    
    // Slower fall speed to reduce updates (increment by 0.5 instead of 1)
    drops[i] += 0.5;
    
    // Reset when off-screen with lower probability for less frequent resets
    if (drops[i] * 20 > canvas.height && Math.random() > 0.98) { // Increased from 0.975
      drops[i] = 0;
    }
  }
  
  // Continue animation loop
  animationId = requestAnimationFrame(drawMatrix);
}

// Start the animation
drawMatrix();

// Optimize: Handle resize more efficiently
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Recalculate columns on resize, capped at maxCols
    const newCols = Math.min(Math.floor(canvas.width / 20), maxCols);
    if (newCols !== cols) {
      drops = Array(newCols).fill(1); // Reset drops only if columns changed
    }
  }, 200); // Debounce resize events
});

// Optional: Pause animation when page is not visible to save resources
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(animationId);
  } else {
    drawMatrix(); // Restart
  }
});
