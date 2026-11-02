/* Rig do VR: um Group com a câmera (e, nas próximas etapas, os controles). Movimento e giro mexem no rig, nunca na câmera:
   o three escreve a pose rastreada da cabeça em camera.position/quaternion, relativa ao rig, a cada quadro.
   O rig só gira em torno do eixo y, então cabeça no mundo = rig.position + Ry(rig.rotation.y) · camera.position.

   Colisão pela cabeça real: se a pessoa anda fisicamente (ou se inclina) contra uma parede, o mesmo resolver do desktop
   (colisor do corpo escolhido, filtrado pela cota do piso) empurra o ponto da cabeça para fora, e o rig recua essa diferença.
   alturaPiso continua a fonte de verdade da cota: o rig sobe e desce com a escada; null (vazio) recusa o passo.

   Locomoção (locomocao.js): deslocar() move o rig antes do passo, e a colisão da cabeça decide o que vale (a mesma do andar
   físico: escada, paredes, vidros, guarda-corpos, vazio). elevar() soma a postura "sentado"; salto() soma o pulo à vista.
   API: O.xr.criarRig(camera) → { rig, centrar(), pronto(), passo(dt, amb, st, raio), olho(v3), poseRecebida(), alturaExtra(m),
        girar(rad), deslocar(dx, dz), levarCabecaA(x, z), rumo(), olhosNoRig(), alturaRastreada(), elevar(m), salto(m), assento(m), dispose() } */
(function(O){
  O.xr = O.xr || {};

  O.xr.criarRig = function(camera){
    var rig = new THREE.Group(); rig.name = 'xr-rig';
    var extra = 0;                 // 'local': a origem fica nos olhos → o rig sobe a altura de olhos estimada
    var elevacao = 0, pulo = 0, assento = 0, fixo = false;   // fixo: sentado num assento (sem colisão, como o boneco sentado no desktop)   // postura "sentado", altura do pulo (locomocao.js) e vista baixada no assento (raio.js)
    var temPose = false, centrar = true;
    var f = new THREE.Vector3(), p = { x: 0, z: 0 }, q = { x: 0, z: 0 };

    /* direção do olhar no chão, no mesmo padrão do rumo do boneco (frente = (sin a, cos a)) */
    function yawLocal(){ f.set(0, 0, -1).applyQuaternion(camera.quaternion); return Math.atan2(f.x, f.z); }
    function girarXZ(x, z, a, out){ var c = Math.cos(a), s = Math.sin(a); out.x = x * c + z * s; out.z = -x * s + z * c; return out; }
    var tmp = { x: 0, z: 0 };
    function cabecaXZ(out){ girarXZ(camera.position.x, camera.position.z, rig.rotation.y, tmp); out.x = rig.position.x + tmp.x; out.z = rig.position.z + tmp.z; return out; }

    /* põe a cabeça em (st.x, st.z), olhando para st.rumo (entrada no VR, reset do sistema, botão de recentralizar) */
    function centrarEm(st){
      rig.rotation.y = st.rumo - yawLocal();
      girarXZ(camera.position.x, camera.position.z, rig.rotation.y, tmp);
      rig.position.set(st.x - tmp.x, st.y + extra + elevacao + pulo + assento, st.z - tmp.z);
    }

    return {
      rig: rig,
      /* pede um novo centramento assim que a sessão entregar uma pose válida */
      centrar: function(){ centrar = true; },
      /* true quando já há pose e nenhum centramento pendente (a cabeça está onde deve estar) */
      pronto: function(){ return temPose && !centrar; },
      /* chamado depois de cada render em VR: só então camera.position tem a pose rastreada */
      poseRecebida: function(){ temPose = true; },
      alturaExtra: function(m){ extra = m || 0; },
      /* gira o rig em torno da cabeça (eixo vertical que passa por ela): a cabeça não sai do lugar, só a direção muda.
         Usado pelo giro automático do modo teste e, na locomoção, pelo giro por passos e suave. */
      /* move o rig no chão; a colisão da cabeça no passo seguinte recusa o que não pode */
      deslocar: function(dx, dz){ rig.position.x += dx; rig.position.z += dz; },
      /* põe a cabeça em (x, z) sem mudar a direção (teleporte) */
      levarCabecaA: function(x, z){ cabecaXZ(p); rig.position.x += x - p.x; rig.position.z += z - p.z; },
      /* para onde a cabeça olha no chão (mesmo padrão do rumo do boneco: frente = (sin a, cos a)) */
      rumo: function(){ return rig.rotation.y + yawLocal(); },
      /* altura dos olhos acima do piso do jogador, sem o pulo (reference space + 'local' + postura) */
      olhosNoRig: function(){ return camera.position.y + extra + elevacao; },
      /* altura real da cabeça rastreada acima do chão do reference space (para medir a postura sentada) */
      alturaRastreada: function(){ return camera.position.y + extra; },
      elevar: function(m){ elevacao = m || 0; },
      salto: function(m){ pulo = m || 0; },
      /* sentado num assento: baixa (m < 0) a vista; 0 volta */
      assento: function(m){ assento = m || 0; },
      /* sentado: o jogador fica no assento e a cabeça não passa pela colisão (o próprio assento a empurraria para fora) */
      fixar: function(v){ fixo = !!v; },
      girar: function(a){
        if (!a) return;
        cabecaXZ(p); var hx = p.x, hz = p.z;
        rig.rotation.y += a;
        cabecaXZ(p); rig.position.x += hx - p.x; rig.position.z += hz - p.z;
      },
      passo: function(dt, amb, st, raio){
        if (!temPose) { rig.position.set(st.x, st.y + extra + elevacao + pulo + assento, st.z); return; }
        if (centrar) { centrarEm(st); centrar = false; }
        if (fixo) { rig.position.y = st.y + extra + elevacao + pulo + assento; st.rumo = rig.rotation.y + yawLocal(); return; }   // sentado: a posição do jogador é a do assento
        cabecaXZ(p);
        var hx = p.x, hz = p.z;
        var piso = amb.alturaPiso ? amb.alturaPiso(p.x, p.z, st.y) : 0;
        if (piso == null) { p.x = st.x; p.z = st.z; piso = st.y; }      // sem piso nesta altura (borda do vazio): não avança
        amb.colisao.resolver(p, raio, piso);
        var pisoR = amb.alturaPiso ? amb.alturaPiso(p.x, p.z, piso) : 0;
        if (pisoR == null) { p.x = st.x; p.z = st.z; pisoR = st.y; }
        /* o rig absorve o que a colisão recusou: a cabeça fica onde o corpo pode estar */
        rig.position.x += p.x - hx; rig.position.z += p.z - hz;
        st.x = p.x; st.z = p.z;
        st.y += (pisoR - st.y) * (1 - Math.exp(-dt * 18));
        if (Math.abs(st.y - pisoR) < 0.002) st.y = pisoR;
        rig.position.y = st.y + extra + elevacao + pulo + assento;
        st.rumo = rig.rotation.y + yawLocal();                          // "frente" do jogador = para onde a cabeça olha
      },
      /* cabeça no mundo (para portas automáticas, etiquetas dos NPCs e, adiante, a interação) */
      olho: function(out){
        cabecaXZ(q);
        return out.set(q.x, rig.position.y + camera.position.y, q.z);
      },
      dispose: function(){ if (rig.parent) rig.parent.remove(rig); }
    };
  };
})(window.Orvalho);
