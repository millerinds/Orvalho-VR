/* Servidor HTTPS local para testar o VR no Quest pela rede de casa, sem cabo e sem modo desenvolvedor (não vai para o site).
   O WebXR só existe em contexto seguro: http://<IP-local> não serve, https://<IP-local> com certificado autoassinado sim
   (depois de aceitar o aviso do navegador; confirmar no aparelho, ver README → "Testar no Quest pelo Wi-Fi").
   - Escuta em 0.0.0.0:8443 e serve a pasta do projeto com o mesmo código de `npm run servir`.
   - O certificado e a chave ficam em .certs/ (fora do Git) e são gerados na primeira execução com o pacote `selfsigned`
     (devDependency). O SAN inclui localhost, 127.0.0.1 e todos os IPv4 desta máquina; se o IP mudar (outro Wi-Fi, DHCP),
     o certificado é refeito sozinho e o Quest volta a mostrar o aviso uma vez.
   - Só aqui (nunca no site nem no `npm run servir`): a página de testes do VR em /t (= /vr-teste.html) e o endpoint que grava as
     medições do modo teste em testes/medicoes-vr/<data>.jsonl (testes/vr-teste-servidor.js; só aceita a rede local).
   Uso: npm run servir:https            (porta: npm run servir:https -- 9443)
        ORVALHO_IP=192.168.0.50 npm run servir:https   força o IP mostrado, se a escolha automática errar */
const https = require('https'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { atender, RAIZ } = require('./servir');
const vrTeste = require('./vr-teste-servidor');

const PORTA = +process.argv[2] || 8443;
const PASTA = path.join(RAIZ, '.certs');
const CERT = path.join(PASTA, 'orvalho-local.crt'), CHAVE = path.join(PASTA, 'orvalho-local.key'), META = path.join(PASTA, 'orvalho-local.json');
/* adaptadores que não são a rede de casa (VPNs, máquinas virtuais): ficam no SAN, mas não são o IP sugerido */
const VIRTUAL = /radmin|zerotier|hamachi|tailscale|wireguard|openvpn|vpn|vethernet|hyper-v|wsl|virtualbox|vmware|docker|loopback|bluetooth|teredo|npcap/i;

function ipsLocais() {
  const lista = [];
  for (const [nome, ends] of Object.entries(os.networkInterfaces())) {
    for (const e of ends || []) {
      const v4 = e.family === 'IPv4' || e.family === 4;
      if (v4 && !e.internal && !e.address.startsWith('169.254.')) lista.push({ nome, ip: e.address });
    }
  }
  const privado = ip => /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  const nota = a => (VIRTUAL.test(a.nome) ? 0 : 4) + (privado(a.ip) ? 2 : 0) + (/^192\.168\./.test(a.ip) ? 1 : 0) + (/wi-?fi|wlan|ethernet/i.test(a.nome) ? 1 : 0);
  return lista.sort((a, b) => nota(b) - nota(a));
}

async function certificado(ips) {
  const precisa = ['127.0.0.1', ...ips.map(a => a.ip)];
  try {
    const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
    const valido = new Date(meta.validoAte) - Date.now() > 7 * 86400e3;
    if (valido && fs.existsSync(CERT) && fs.existsSync(CHAVE) && precisa.every(ip => meta.ips.includes(ip)))
      return { cert: fs.readFileSync(CERT), key: fs.readFileSync(CHAVE), novo: false };
  } catch (e) { /* sem certificado ainda: gera abaixo */ }

  let selfsigned;
  try { selfsigned = require('selfsigned'); }
  catch (e) { console.error('Falta o pacote "selfsigned". Rode `npm install` na pasta do projeto.'); process.exit(1); }
  const inicio = new Date(Date.now() - 86400e3), fim = new Date(inicio.getTime() + 366 * 86400e3);
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'Orvalho local' }, { name: 'organizationName', value: 'Orvalho (desenvolvimento)' }], {
    keyType: 'rsa', keySize: 2048, algorithm: 'sha256', notBeforeDate: inicio, notAfterDate: fim,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, ...precisa.map(ip => ({ type: 7, ip }))] }
    ]
  });
  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(CERT, pems.cert);
  fs.writeFileSync(CHAVE, pems.private, { mode: 0o600 });
  fs.writeFileSync(META, JSON.stringify({ geradoEm: new Date().toISOString(), validoAte: fim.toISOString(), ips: precisa }, null, 2));
  return { cert: pems.cert, key: pems.private, novo: true };
}

(async () => {
  const ips = ipsLocais();
  const forcado = process.env.ORVALHO_IP;
  if (forcado && !ips.some(a => a.ip === forcado)) ips.unshift({ nome: 'ORVALHO_IP', ip: forcado });
  const principal = forcado || (ips[0] && ips[0].ip);
  const { cert, key, novo } = await certificado(ips);
  const digital = new crypto.X509Certificate(cert).fingerprint256.split(':').slice(0, 6).join(':');

  const servidor = https.createServer({ cert, key }, (req, rsp) => { if (!vrTeste.tratar(req, rsp)) atender(req, rsp); });
  servidor.on('error', e => {
    console.error(e.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso. Feche o outro servidor ou use: npm run servir:https -- 9443` : e);
    process.exit(1);
  });
  servidor.listen(PORTA, '0.0.0.0', () => {
    const l = s => console.log(s);
    l('');
    l(`  Orvalho em HTTPS (certificado autoassinado ${novo ? 'gerado agora' : 'reaproveitado'} em .certs/, digital ${digital}…)`);
    l('');
    if (principal) l(`  ► Abra no Quest Browser:  https://${principal}:${PORTA}/?vr-log=1`);
    else l('  ✘ Nenhum IPv4 de rede encontrado. O PC está conectado ao Wi-Fi/cabo da rede de casa?');
    if (principal) l(`  ► Testes de medição (salve nos favoritos):  https://${principal}:${PORTA}/t`);
    l(`    Medições gravadas em testes/medicoes-vr/<data>.jsonl  (resumo: npm run medicoes:vr)`);
    l(`    Neste PC:               https://localhost:${PORTA}/?vr-log=1`);
    const outros = ips.filter(a => a.ip !== principal);
    if (outros.length) l('    Outros IPs desta máquina (VPN/virtual; use só se o de cima não abrir): ' + outros.map(a => `${a.ip} (${a.nome})`).join(', '));
    l('');
    l('  No aviso "Sua conexão não é particular": Avançado → Continuar para o site.');
    l(`  Se o Quest não abrir a página: libere a porta ${PORTA} no Firewall do Windows (README → "Testar no Quest pelo Wi-Fi").`);
    l('  Ctrl+C para parar.');
    l('');
  });
})().catch(e => { console.error(e); process.exit(1); });
