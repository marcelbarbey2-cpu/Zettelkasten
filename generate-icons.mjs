// Generates PWA icons as SVG files (browsers accept SVG in manifests)
import { writeFileSync } from 'fs'

function makeSvg(size) {
  const pad = Math.round(size * 0.15)
  const cx  = size / 2
  const cy  = size / 2
  const r   = Math.round(size * 0.12)
  // ◈ approximated as a rotated square with inner square
  const s   = Math.round(size * 0.28)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size*0.22)}" fill="oklch(0.97 0.012 75)"/>
  <g transform="translate(${cx},${cy}) rotate(45)">
    <rect x="${-s}" y="${-s}" width="${s*2}" height="${s*2}" rx="${Math.round(s*0.18)}" fill="none" stroke="oklch(0.68 0.14 65)" stroke-width="${Math.round(size*0.055)}"/>
    <rect x="${-s*0.48}" y="${-s*0.48}" width="${s*0.96}" height="${s*0.96}" rx="${Math.round(s*0.1)}" fill="oklch(0.68 0.14 65)"/>
  </g>
</svg>`
}

writeFileSync('public/icon-192.svg', makeSvg(192))
writeFileSync('public/icon-512.svg', makeSvg(512))
console.log('Icons generated.')
