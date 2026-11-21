import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('assets/icons/interior.svg', root), 'utf8');
const symbols = source.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  .replace(/id="([^"]+)"/g, 'id="fv-$1"');

const script = `/* Iconos internos FV+. Fuente: assets/icons/interior.svg.
   Generado por scripts/build-interior-icons.mjs; sin peticiones al dibujar consultas. */
(function () {
  if (document.getElementById('fvInteriorSprite')) return;
  var interior = document.getElementById('nvApp') || document.getElementById('adminApp');
  if (!interior) return;
  var sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.id = 'fvInteriorSprite';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('focusable', 'false');
  sprite.setAttribute('width', '0');
  sprite.setAttribute('height', '0');
  sprite.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
  sprite.innerHTML = ${JSON.stringify('<defs>' + symbols + '</defs>')};
  interior.appendChild(sprite);
})();
`;

await writeFile(new URL('js/shared/interior-icons.js', root), script);
console.log('Generado: ' + fileURLToPath(new URL('js/shared/interior-icons.js', root)));
