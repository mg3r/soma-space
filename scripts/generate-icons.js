const fs = require('fs');
const path = require('path');

// Generate spiral path points (clockwise from center, starting right)
function generateSpiralPath(turns = 4, maxRadius = 200) {
  const points = [];
  const steps = 200;
  
  for (let i = 0; i <= steps; i++) {
    // Start at angle 0 (pointing right), go counter-clockwise (negative angles)
    const t = -(i / steps) * turns * Math.PI * 2;
    const radius = (i / steps) * maxRadius;
    const x = radius * Math.cos(t);
    const y = -radius * Math.sin(t); // Flip on horizontal axis (negate y)
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  
  return points.join(' ');
}

// Generate SVG content
function generateSVG(size, strokeWidth = 2) {
  const spiralPath = generateSpiralPath(4, size * 0.4);
  const center = size / 2;
  
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#111111"/>
  <g transform="translate(${center}, ${center})">
    <path
      d="${spiralPath}"
      fill="none"
      stroke="white"
      stroke-width="${strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</svg>`;
}

async function generateIcons() {
  const appDir = path.join(__dirname, '../src/app');
  
  try {
    const sharp = require('sharp');
    
    // Generate SVG
    const svg512 = generateSVG(512, 3);
    fs.writeFileSync(path.join(appDir, 'icon.svg'), svg512);
    console.log('✅ Generated icon.svg');
    
    // Convert to PNG files
    const svgBuffer = Buffer.from(svg512);
    
    // icon.png (512x512)
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(appDir, 'icon.png'));
    console.log('✅ Generated icon.png (512x512)');
    
    // apple-icon.png (180x180)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(appDir, 'apple-icon.png'));
    console.log('✅ Generated apple-icon.png (180x180)');
    
    // favicon.ico (multiple sizes: 16, 32, 48)
    const favicon16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
    const favicon32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
    const favicon48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
    
    // For ICO, we'll create a simple 32x32 PNG and rename it
    // Most modern systems accept PNG as favicon
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(appDir, 'favicon.ico'));
    console.log('✅ Generated favicon.ico (32x32)');
    
    console.log('\n🎉 All icon files generated successfully!');
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('❌ sharp module not found. Installing...');
      console.log('Run: npm install --save-dev sharp');
      process.exit(1);
    } else {
      console.error('❌ Error generating icons:', error);
      process.exit(1);
    }
  }
}

generateIcons();
