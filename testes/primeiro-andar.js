/* Matriz rápida e focada da expansão E01–E45: três corpos, dois pavimentos, NPCs e elevador. */
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
const RAIZ=path.resolve(__dirname,'..');
function servidor(){return new Promise(res=>{const s=http.createServer((req,rsp)=>{const f=path.join(RAIZ,decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/,'/index.html'));if(!f.startsWith(RAIZ)||!fs.existsSync(f)){rsp.writeHead(404);return rsp.end();}const ext=path.extname(f),tipos={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpeg':'image/jpeg'};rsp.writeHead(200,{'Content-Type':tipos[ext]||'application/octet-stream'});fs.createReadStream(f).pipe(rsp);}).listen(0,'127.0.0.1',()=>res(s));});}
function chromiumPath(){if(process.env.CHROMIUM)return process.env.CHROMIUM;const base=path.join(process.env.HOME||'','Library/Caches/ms-playwright');if(fs.existsSync(base)){for(const d of fs.readdirSync(base).filter(x=>/^chromium-\d+$/.test(x)).sort().reverse()){for(const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing','chrome-mac/Chromium.app/Contents/MacOS/Chromium']){const p=path.join(base,d,sub);if(fs.existsSync(p))return p;}}}}
(async()=>{
  const srv=await servidor(),url=process.env.ORVALHO_URL||`http://127.0.0.1:${srv.address().port}/`,browser=await require('./navegador').abrir(chromium,true);
  const falhas=[],resultados={data:new Date().toISOString(),corpos:{}};
  function ok(c,m){console.log((c?'  ✔ ':'  ✘ ')+m);if(!c)falhas.push(m);}
  for(const corpo of ['jujuba','gota','esguio']){
    console.log(`\n${corpo}`); const page=await browser.newPage({viewport:{width:1280,height:800}}),erros=[];
    page.on('pageerror',e=>erros.push(e.message));page.on('console',m=>{if(m.type()==='error')erros.push(m.text());});
    await page.goto(url);await page.evaluate(c=>{localStorage.clear();localStorage.setItem('orvalho-avatar-cor','azul');localStorage.setItem('orvalho-avatar-corpo',c);},corpo);await page.reload();
    await page.click('#btn-entrar');await page.waitForTimeout(1000);await page.evaluate(()=>Orvalho.jogo.irPara('hall-inovale'));await page.waitForTimeout(1800);
    const base=await page.evaluate(()=>{const d=Orvalho.jogo._debug(),ids=d.amb.interativos.map(i=>i.id);return{raio:d.raio,npcs:d.amb.def.npcs.map(n=>n.nome),empresas:['busqme','nexus-core','quatroin','mocaplus'].filter(x=>ids.includes(x)),extras:ids.filter(x=>['busqme','nexus-core','quatroin','mocaplus'].includes(x)).length,incubacao:ids.includes('salas-incubacao'),piso:d.amb.alturaPiso(25,16,4.2),banheiro:d.amb.alturaPiso(22.3,18.7,0),acesso:d.amb.alturaPiso(32.5,18.8,0)};});
    ok(base.piso===4.2&&base.banheiro===0&&base.acesso===0,`${corpo}: pisos do térreo e 1º andar reconhecidos`);
    ok(base.npcs.join('|')==='Keila|Dagliê|Danimara',`${corpo}: Keila, Dagliê e Danimara cadastradas`);
    ok(base.empresas.length===0&&base.extras===0&&base.incubacao,`${corpo}: Incubadora sem empresas nomeadas (só sinalização institucional)`);
    const salas=await page.evaluate(()=>{const d=Orvalho.jogo._debug(),rs=[[.5,12,10,19.5],[46.6,.2,51.5,11.9],[42,14.7,54.9,19.8]];
      const out=rs.map(r=>{let best={folga:-1,p:null,piso:null};for(let x=r[0];x<=r[2];x+=.25)for(let z=r[1];z<=r[3];z+=.25){const f=d.amb.colisao.folga({x,z},4.2);if(f>best.folga)best={p:[x,z],folga:f,piso:d.amb.alturaPiso(x,z,4.2)};}return best;});
      out.push({p:[14.6,13.05],folga:d.amb.colisao.folga({x:14.6,z:13.05},4.2),piso:d.amb.alturaPiso(14.6,13.05,4.2)});return out;});
    ok(salas.every(s=>s.piso===4.2&&s.folga>=base.raio-.002),`${corpo}: ACIOC, Incubadora, Administrativo e corredor comportam o colisor`);
    await page.evaluate(()=>Orvalho.jogo.usarElevador());await page.waitForSelector('.elevador-ui:not([hidden])');
    const bloqueados=await page.locator('.elevador-andares button:disabled').count();await page.click('[data-piso="1"]');await page.waitForTimeout(2050);
    const alto=await page.evaluate(()=>Orvalho.jogo._debug().st.y);ok(alto>4.15&&bloqueados===3,`${corpo}: elevador sobe e bloqueia pavimentos indisponíveis`);
    await page.evaluate(()=>{const d=Orvalho.jogo._debug();Object.assign(d.st,{x:44.3,y:4.2,z:15.6,rumo:1.57,vx:0,vz:0});d.player.root.position.set(44.3,4.2,15.6);d.cam.yaw=-1.2;});await page.waitForTimeout(700);
    await page.screenshot({path:path.join(__dirname,`primeiro-andar-matriz-${corpo}.png`)});
    await page.evaluate(()=>Orvalho.jogo.usarElevador());await page.waitForSelector('.elevador-ui:not([hidden])');await page.click('[data-piso="0"]');await page.waitForTimeout(2050);
    const baixo=await page.evaluate(()=>({y:Orvalho.jogo._debug().st.y,amb:Orvalho.jogo.ambienteAtual()}));ok(baixo.y<.03&&baixo.amb==='hall-inovale',`${corpo}: elevador retorna sem trocar o ambiente`);
    ok(!erros.length,`${corpo}: console sem erros${erros.length?': '+erros.join(' | '):''}`);
    resultados.corpos[corpo]={...base,salas,bloqueados,alto,baixo,erros};await page.close();
  }
  fs.writeFileSync(path.join(__dirname,'relatorio-primeiro-andar.json'),JSON.stringify({...resultados,falhas},null,2));
  await browser.close();srv.close();console.log(`\n${falhas.length?'✘ '+falhas.length+' falha(s)':'✔ matriz do primeiro andar passou'}\n`);process.exit(falhas.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
