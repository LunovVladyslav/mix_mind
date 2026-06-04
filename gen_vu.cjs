const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 300;
const HEIGHT = 200;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// 1. Background base (Dark metallic/plastic with texture)
ctx.fillStyle = '#111317';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// 2. Bezel (Inner shadow + outer highlight)
const bezelRad = 15;
ctx.beginPath();
ctx.moveTo(bezelRad, 0);
ctx.lineTo(WIDTH - bezelRad, 0);
ctx.quadraticCurveTo(WIDTH, 0, WIDTH, bezelRad);
ctx.lineTo(WIDTH, HEIGHT - bezelRad);
ctx.quadraticCurveTo(WIDTH, HEIGHT, WIDTH - bezelRad, HEIGHT);
ctx.lineTo(bezelRad, HEIGHT);
ctx.quadraticCurveTo(0, HEIGHT, 0, HEIGHT - bezelRad);
ctx.lineTo(0, bezelRad);
ctx.quadraticCurveTo(0, 0, bezelRad, 0);
ctx.lineWidth = 4;
ctx.strokeStyle = '#3a3f4b';
ctx.stroke();

// 3. Dial face (warm yellowish glow like a backlit analog VU meter)
const facePadding = 20;
ctx.fillStyle = '#22252a';
ctx.fillRect(facePadding, facePadding, WIDTH - facePadding * 2, HEIGHT - facePadding * 2);

// Add glowing backlight
const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT, 0, WIDTH / 2, HEIGHT, HEIGHT);
glow.addColorStop(0, 'rgba(255, 180, 50, 0.4)'); // Warm amber center bottom
glow.addColorStop(1, 'rgba(25, 28, 35, 1)');
ctx.fillStyle = glow;
ctx.fillRect(facePadding, facePadding, WIDTH - facePadding * 2, HEIGHT - facePadding * 2);

// Top-left light reflection (overall)
const glassReflect = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
glassReflect.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
glassReflect.addColorStop(0.3, 'rgba(255, 255, 255, 0.0)');
ctx.fillStyle = glassReflect;
ctx.fillRect(facePadding, facePadding, WIDTH - facePadding * 2, HEIGHT - facePadding * 2);


// 4. Tick marks and numbers
ctx.save();
ctx.translate(WIDTH / 2, HEIGHT - 30); // Origin at bottom center

// Draw arc
ctx.beginPath();
ctx.arc(0, 0, 110, -Math.PI, 0);
ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
ctx.lineWidth = 2;
ctx.stroke();

// Draw ticks
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = 'bold 12px Arial';
const ticks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3];
const minAngle = -Math.PI * 0.8;
const maxAngle = -Math.PI * 0.2;
const rangeAngle = maxAngle - minAngle;

ticks.forEach((tick, i) => {
    // Normalize tick to a 0-1 range. Since it's logarithmic-ish, we'll map roughly
    const t = (i) / (ticks.length - 1);
    const angle = minAngle + t * rangeAngle;
    const isRed = tick > 0;
    
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(110, 0);
    ctx.lineTo(125, 0);
    ctx.strokeStyle = isRed ? '#ff4040' : '#888c99';
    ctx.lineWidth = tick % 5 === 0 || tick === 0 ? 3 : 1;
    ctx.stroke();
    
    // Draw text
    if (tick % 5 === 0 || tick === -3 || tick === -7 || tick === 3) {
        ctx.translate(140, 0);
        ctx.rotate(-angle); // Keep text upright
        ctx.fillStyle = isRed ? '#ff4040' : '#d0d4df';
        ctx.fillText(tick.toString(), 0, 0);
    }
    ctx.restore();
});
ctx.restore();

// 5. 'VU' label
ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
ctx.font = 'bold 14px Arial';
ctx.textAlign = 'center';
ctx.fillText('VU', WIDTH / 2, HEIGHT - 70);

const outPath = path.join(__dirname, 'public', 'vu-dial.png');
const out = fs.createWriteStream(outPath);
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => console.log('vu-dial.png created'));
