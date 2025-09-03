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

// Optional: Matrix rain effect
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
const cols = Math.floor(canvas.width / 20);
const chars = 'abcdefghijklmnopqrstuvwxyz0123456789@#$%&';
let drops = Array(cols).fill(1);
function drawMatrix() {
  ctx.fillStyle = 'rgba(10,10,10,0.15)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.font = '18px JetBrains Mono';
  ctx.fillStyle = '#00ff41';
  for(let i=0; i<drops.length; i++) {
    let text = chars[Math.floor(Math.random()*chars.length)];
    ctx.fillText(text, i*20, drops[i]*20);
    if(drops[i]*20 > canvas.height && Math.random() > 0.975) drops[i]=0;
    drops[i]++;
  }
}
setInterval(drawMatrix, 50);
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
