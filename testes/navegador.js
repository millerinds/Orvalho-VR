/* Como os testes abrem o Chromium (só desenvolvimento).
   - Padrão: as mesmas opções de sempre. Nesta máquina Windows o WebGL sai por software ("Microsoft Basic Render Driver", o WARP do
     Direct3D; em outras máquinas pode ser o SwiftShader): lento, mas reprodutível.
   - GPU=1: usa a placa de vídeo da máquina pelo ANGLE (Windows: D3D11; macOS: Metal; Linux: GL), com o headless novo.
     Se a GPU não pegar (o Chromium cai para o SwiftShader) ou o navegador não abrir com essas opções, avisa e segue por software.
   Os números de GPU servem para os testes rodarem mais rápido; NÃO representam o Quest (outra GPU, outro navegador).
   Uso: GPU=1 npm run teste:vr   (Git Bash)  ·  $env:GPU='1'; npm run teste:vr   (PowerShell) */
const fs = require('fs'), path = require('path');

const PADRAO = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const ANGLE = { win32: 'd3d11', darwin: 'metal', linux: 'gl' }[process.platform] || 'default';
const GPU_ARGS = ['--use-gl=angle', '--use-angle=' + ANGLE, '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization'];
const querGpu = () => /^(1|sim|true|on)$/i.test(process.env.GPU || '');

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const bases = [path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'), path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const arquivo = path.join(base, d, sub); if (fs.existsSync(arquivo)) return arquivo;
    }
  }
  return undefined;
}

/* qual WebGL a página recebeu (string do renderer pelo WEBGL_debug_renderer_info) */
async function rendererGl(browser) {
  const p = await browser.newPage();
  try {
    return await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      if (!gl) return 'sem WebGL';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
  } finally { await p.close(); }
}
const ehSoftware = r => /swiftshader|llvmpipe|software|basic render/i.test(r || '');

/* abre o Chromium; headless = false abre janela. Devolve o browser e imprime o modo de WebGL em uso */
async function abrir(chromium, headless) {
  const exe = chromiumPath();
  if (querGpu()) {
    try {
      const b = await chromium.launch({ executablePath: exe, headless, args: GPU_ARGS });
      const r = await rendererGl(b);
      if (!ehSoftware(r)) { console.log(`[navegador] GPU=1 · WebGL pela GPU: ${r}`); b.__modo = { gpu: true, renderer: r }; return b; }
      console.log(`[navegador] GPU=1, mas o WebGL saiu por software (${r}); seguindo por software.`);
      await b.close();
    } catch (e) { console.log(`[navegador] GPU=1 não abriu (${e.message.split('\n')[0]}); seguindo por software.`); }
  }
  const b = await chromium.launch({ executablePath: exe, headless, args: PADRAO });
  const r = await rendererGl(b);
  console.log(`[navegador] modo padrão · WebGL: ${r}`);
  b.__modo = { gpu: false, renderer: r };
  return b;
}

module.exports = { abrir, chromiumPath, rendererGl, querGpu };
