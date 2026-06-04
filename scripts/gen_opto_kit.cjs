const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public', 'plugins', 'opto');

async function generateOptoKit() {
    console.log('Loading AI materials...');
    const metalTex = await loadImage(path.join(publicDir, 'metal.png'));
    const goldTex = await loadImage(path.join(publicDir, 'gold.png'));
    const paperTex = await loadImage(path.join(publicDir, 'paper.png'));

    // --- 1. Generate Pure Gold Knob Base (Transparent Background) ---
    console.log('Generating opto_knob_gold.png...');
    const knobSize = 400; // High resolution
    const knobCanvas = createCanvas(knobSize, knobSize);
    const kCtx = knobCanvas.getContext('2d');

    const cx = knobSize / 2;
    const cy = knobSize / 2;
    const radius = (knobSize / 2) - 20; // Leave room for drop shadow

    // Drop shadow
    kCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    kCtx.shadowBlur = 20;
    kCtx.shadowOffsetY = 10;
    kCtx.beginPath();
    kCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    kCtx.fillStyle = 'black';
    kCtx.fill();
    kCtx.shadowColor = 'transparent';

    // Base Gold Texture (Outer Bevel)
    kCtx.beginPath();
    kCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    kCtx.save();
    kCtx.clip();
    kCtx.drawImage(goldTex, 0, 0, goldTex.width, goldTex.height, 0, 0, knobSize, knobSize);
    
    // Conic light/dark overlay to simulate 3D cylinder (using linear gradient fallback since conic isn't supported in Node Canvas)
    const gradient = kCtx.createLinearGradient(0, 0, knobSize, knobSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    kCtx.fillStyle = gradient;
    kCtx.fill();
    kCtx.restore();

    // Inner Flat Area
    const innerRadius = radius * 0.85;
    kCtx.beginPath();
    kCtx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    kCtx.save();
    kCtx.clip();
    // Offset texture slightly so it doesn't perfectly match the bevel
    kCtx.drawImage(goldTex, 50, 50, goldTex.width, goldTex.height, 0, 0, knobSize, knobSize);
    
    // Flat area lighting (gradient from top-left)
    const flatGrad = kCtx.createLinearGradient(0, 0, knobSize, knobSize);
    flatGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    flatGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    kCtx.fillStyle = flatGrad;
    kCtx.fill();
    
    // Center indentation
    const indentRadius = radius * 0.35;
    kCtx.beginPath();
    kCtx.arc(cx, cy, indentRadius, 0, Math.PI * 2);
    const indentGrad = kCtx.createLinearGradient(cx - indentRadius, cy - indentRadius, cx + indentRadius, cy + indentRadius);
    indentGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    indentGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
    kCtx.fillStyle = indentGrad;
    kCtx.fill();
    kCtx.restore();

    // Bevel edges (inner shadow / strokes)
    kCtx.beginPath();
    kCtx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    kCtx.lineWidth = 4;
    kCtx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    kCtx.stroke();
    kCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    kCtx.lineWidth = 2;
    kCtx.beginPath();
    kCtx.arc(cx, cy, innerRadius - 2, 0, Math.PI * 2);
    kCtx.stroke();

    const knobOut = fs.createWriteStream(path.join(publicDir, 'opto_knob_gold.png'));
    knobCanvas.createPNGStream().pipe(knobOut);


    // --- 2. Generate Rectangular VU Meter (Transparent Edge) ---
    console.log('Generating opto_vu_meter.png...');
    const vuWidth = 600;
    const vuHeight = 450;
    const padding = 30; // Room for drop shadow
    const vuCanvas = createCanvas(vuWidth, vuHeight);
    const vCtx = vuCanvas.getContext('2d');

    // Outer Drop Shadow
    vCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    vCtx.shadowBlur = 30;
    vCtx.shadowOffsetY = 15;
    
    // Draw Bezel Shape
    vCtx.beginPath();
    vCtx.roundRect(padding, padding, vuWidth - padding*2, vuHeight - padding*2, 20);
    vCtx.fillStyle = 'black';
    vCtx.fill();
    vCtx.shadowColor = 'transparent';

    // Fill Bezel with Metal Texture
    vCtx.save();
    vCtx.clip();
    vCtx.drawImage(metalTex, 0, 0, metalTex.width, metalTex.height, 0, 0, vuWidth, vuHeight);
    // Darken it
    vCtx.fillStyle = 'rgba(0,0,0,0.4)';
    vCtx.fill();
    vCtx.restore();

    // Inner Cutout (The Paper Area)
    const innerPaddingX = 60;
    const innerPaddingYTop = 60;
    const innerPaddingYBot = 100;
    
    vCtx.beginPath();
    vCtx.roundRect(innerPaddingX, innerPaddingYTop, vuWidth - innerPaddingX*2, vuHeight - innerPaddingYTop - innerPaddingYBot, 15);
    
    // Inner Shadow effect on Bezel
    vCtx.save();
    vCtx.clip();
    vCtx.drawImage(paperTex, 0, 0, paperTex.width, paperTex.height, 0, 0, vuWidth, vuHeight);
    
    // Amber Light Gradient
    const glow = vCtx.createRadialGradient(vuWidth / 2, vuHeight - 100, 0, vuWidth / 2, vuHeight - 100, 300);
    glow.addColorStop(0, 'rgba(255, 200, 50, 0.6)'); // Bright amber
    glow.addColorStop(1, 'rgba(150, 80, 0, 0.9)');   // Dark edges
    vCtx.fillStyle = glow;
    vCtx.fill();
    
    // Draw Scale Arcs inside the cutout
    vCtx.translate(vuWidth / 2, vuHeight - 120); 
    
    vCtx.beginPath();
    vCtx.arc(0, 0, 200, -Math.PI * 0.8, -Math.PI * 0.2);
    vCtx.strokeStyle = '#111';
    vCtx.lineWidth = 3;
    vCtx.stroke();
    
    vCtx.beginPath();
    vCtx.arc(0, 0, 200, -Math.PI * 0.4, -Math.PI * 0.2);
    vCtx.strokeStyle = '#cc0000';
    vCtx.lineWidth = 5;
    vCtx.stroke();

    // Ticks
    vCtx.textAlign = 'center';
    vCtx.textBaseline = 'middle';
    vCtx.font = 'bold 16px "Times New Roman", serif';
    const ticks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3];
    const minAngle = -Math.PI * 0.75;
    const maxAngle = -Math.PI * 0.25;
    const rangeAngle = maxAngle - minAngle;

    ticks.forEach((tick, i) => {
        const t = (i) / (ticks.length - 1);
        const angle = minAngle + t * rangeAngle;
        const isRed = tick > 0;
        
        vCtx.save();
        vCtx.rotate(angle);
        vCtx.beginPath();
        vCtx.moveTo(200, 0);
        vCtx.lineTo(215, 0);
        vCtx.strokeStyle = isRed ? '#cc0000' : '#111';
        vCtx.lineWidth = tick % 5 === 0 || tick === 0 ? 4 : 2;
        vCtx.stroke();
        
        if (tick % 5 === 0 || tick === -3 || tick === -7 || tick === 3) {
            vCtx.translate(235, 0);
            vCtx.rotate(-angle);
            vCtx.fillStyle = isRed ? '#cc0000' : '#111';
            vCtx.fillText(Math.abs(tick).toString(), 0, 0);
        }
        vCtx.restore();
    });

    vCtx.fillStyle = '#111';
    vCtx.font = 'bold 36px "Times New Roman", serif';
    vCtx.fillText('VU', 0, -50);
    
    vCtx.restore(); // Remove clip

    // Bezel Inner Shadow (drawn over the paper)
    vCtx.beginPath();
    vCtx.roundRect(innerPaddingX, innerPaddingYTop, vuWidth - innerPaddingX*2, vuHeight - innerPaddingYTop - innerPaddingYBot, 15);
    vCtx.lineWidth = 12;
    vCtx.strokeStyle = 'rgba(0,0,0,0.8)';
    vCtx.stroke();
    vCtx.lineWidth = 4;
    vCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    vCtx.stroke();

    // Lower cover plate (Hides needle base)
    const plateY = vuHeight - innerPaddingYBot - 20;
    vCtx.beginPath();
    vCtx.roundRect(innerPaddingX, plateY, vuWidth - innerPaddingX*2, innerPaddingYBot + 20, 10);
    vCtx.save();
    vCtx.clip();
    vCtx.drawImage(metalTex, 0, -plateY, metalTex.width, metalTex.height, 0, -plateY, vuWidth, vuHeight);
    vCtx.fillStyle = 'rgba(0,0,0,0.6)';
    vCtx.fill();
    // Screw hole center
    vCtx.beginPath();
    vCtx.arc(vuWidth/2, plateY + 30, 12, 0, Math.PI*2);
    vCtx.fillStyle = '#111';
    vCtx.fill();
    vCtx.beginPath();
    vCtx.arc(vuWidth/2, plateY + 30, 12, 0, Math.PI*2);
    vCtx.strokeStyle = '#444';
    vCtx.lineWidth = 2;
    vCtx.stroke();
    // Screw slot
    vCtx.beginPath();
    vCtx.moveTo(vuWidth/2 - 8, plateY + 22);
    vCtx.lineTo(vuWidth/2 + 8, plateY + 38);
    vCtx.strokeStyle = '#000';
    vCtx.lineWidth = 3;
    vCtx.stroke();
    vCtx.restore();

    // Draw bezel edge highlight
    vCtx.beginPath();
    vCtx.roundRect(padding, padding, vuWidth - padding*2, vuHeight - padding*2, 20);
    vCtx.lineWidth = 2;
    vCtx.strokeStyle = 'rgba(255,255,255,0.2)';
    vCtx.stroke();

    const vuOut = fs.createWriteStream(path.join(publicDir, 'opto_vu_meter.png'));
    vuCanvas.createPNGStream().pipe(vuOut);

    console.log('Opto Kit generation complete.');
}

generateOptoKit().catch(console.error);
