const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 100;
const FRAMES = 60;
const WIDTH = SIZE;
const HEIGHT = SIZE * FRAMES;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

function drawKnob(ctx, frame, yOffset) {
    const cx = SIZE / 2;
    const cy = yOffset + SIZE / 2;
    const radius = 38;

    // Clear background
    ctx.clearRect(0, yOffset, SIZE, SIZE);

    // 1. Drop shadow (down-right)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 2. Base knob surface (dark metallic)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    const baseGradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    baseGradient.addColorStop(0, '#3a3f4b');
    baseGradient.addColorStop(1, '#1a1c24');
    ctx.fillStyle = baseGradient;
    ctx.fill();

    // 3. Highlight edge (top-left)
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    const highlightGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    highlightGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
    highlightGrad.addColorStop(0.3, 'rgba(255,255,255,0.0)');
    highlightGrad.addColorStop(0.7, 'rgba(0,0,0,0.0)');
    highlightGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.strokeStyle = highlightGrad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Inner metallic reflection (conic-like, but we use radial to fake it)
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
    const innerGrad = ctx.createRadialGradient(cx - 10, cy - 10, 0, cx, cy, radius);
    innerGrad.addColorStop(0, '#4a505e');
    innerGrad.addColorStop(1, '#1f222b');
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // Inner shadow for depth
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5. Center cap or indent
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    const capGrad = ctx.createLinearGradient(cx - radius * 0.6, cy - radius * 0.6, cx + radius * 0.6, cy + radius * 0.6);
    capGrad.addColorStop(0, '#15171e');
    capGrad.addColorStop(1, '#2c313d');
    ctx.fillStyle = capGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 6. Indicator (rotates)
    // -135 to +135 degrees
    const percent = frame / (FRAMES - 1);
    const angleDeg = -135 + (percent * 270);
    const angleRad = (angleDeg - 90) * Math.PI / 180; // -90 so 0 is top

    const startRadius = radius * 0.2;
    const endRadius = radius * 0.85;

    const startX = cx + Math.cos(angleRad) * startRadius;
    const startY = cy + Math.sin(angleRad) * startRadius;
    const endX = cx + Math.cos(angleRad) * endRadius;
    const endY = cy + Math.sin(angleRad) * endRadius;

    // Outer glow for indicator
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#00e5ff'; // Cyan accent
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
    ctx.shadowColor = 'transparent';

    // White core for indicator
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
}

for (let i = 0; i < FRAMES; i++) {
    drawKnob(ctx, i, i * SIZE);
}

const outPath = path.join(__dirname, 'public', 'knob-sprite.png');
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const out = fs.createWriteStream(outPath);
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => console.log('knob-sprite.png created in public folder'));
