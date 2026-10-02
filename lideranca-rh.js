// =========================================================
// lideranca-rh.js — telas do módulo Liderança (depende de api-client.js)
//   LiderancaRH.montarEditor(el)        -> painel do RH: questões, regras do plano, parâmetros
//   LiderancaRH.abrirQuestionario(el, cb) -> questionário do líder (uma questão por vez)
// Todo texto vindo do banco é escapado (esc) — o RH edita conteúdo que outros usuários leem.
// =========================================================
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  if (!document.getElementById('lrh-css')) {
    const st = document.createElement('style');
    st.id = 'lrh-css';
    st.textContent = `
    .lrh{font-family:Inter,system-ui,sans-serif;color:var(--ink,#232323)}
    .lrh .tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--line,#e3e1da)}
    .lrh .tab{padding:9px 14px;border:none;background:none;cursor:pointer;font-weight:600;font-size:13px;color:var(--ink-soft,#5b5b57);border-bottom:2px solid transparent}
    .lrh .tab.on{color:var(--ink,#232323);border-color:var(--ink,#232323)}
    .lrh .card{background:#fff;border:1px solid var(--line,#e3e1da);border-radius:10px;padding:14px 16px;margin-bottom:10px}
    .lrh .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .lrh .grow{flex:1;min-width:0}
    .lrh .tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:#eee;color:#444}
    .lrh .tag.peg{background:#fff1d6;color:#8a5a00}.lrh .tag.off{background:#f3d9d9;color:#a11}.lrh .tag.ver{background:#dbeafe;color:#1d4ed8}
    .lrh .btn{padding:7px 12px;border-radius:7px;border:1px solid var(--line-strong,#c9c7bd);background:#fff;cursor:pointer;font-size:12.5px;font-weight:600}
    .lrh .btn.pri{background:var(--ink,#232323);color:#fff;border-color:var(--ink,#232323)}
    .lrh .btn.dan{color:#a11}
    .lrh input,.lrh select,.lrh textarea{padding:8px 10px;border:1.5px solid var(--line-strong,#c9c7bd);border-radius:7px;font:inherit;font-size:13px;background:#fff}
    .lrh textarea{width:100%;min-height:70px}
    .lrh .aviso{background:#fff8e1;border:1px solid #f0d78a;border-radius:8px;padding:10px 12px;font-size:12.5px;margin-bottom:12px}
    .lrh .erros{background:#fdeceb;border:1px solid #f6c9c4;color:#a11;border-radius:8px;padding:10px 12px;font-size:12.5px;margin:10px 0}
    .lrh .ajuda{font-size:12px;color:var(--ink-soft,#5b5b57);line-height:1.45}
    .lrh .opt{display:grid;grid-template-columns:1fr 78px 74px 30px;gap:6px;align-items:center;margin-bottom:6px}
    .lrh .lrh-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
    .lrh .lrh-box{background:#fff;border-radius:12px;max-width:760px;width:100%;max-height:92vh;overflow:auto;padding:22px}
    .lrh .bar{height:10px;border-radius:5px;background:#eee;overflow:hidden}.lrh .bar i{display:block;height:100%}
    .lrh label{font-size:12px;font-weight:600;color:var(--ink-soft,#5b5b57);display:block;margin:10px 0 4px}`;
    document.head.appendChild(st);
  }

  /* ======================  EDITOR DO RH  ====================== */
  function montarEditor(el) {
    el.innerHTML = '<div class="lrh"><div class="tabs">' +
      ['questoes:Questões', 'regras:Regras do plano', 'params:Parâmetros'].map((t, i) => `<button class="tab${i ? '' : ' on'}" data-t="${t.split(':')[0]}">${t.split(':')[1]}</button>`).join('') +
      '</div><div id="lrh-corpo"></div></div>';
    const corpo = el.querySelector('#lrh-corpo');
    const estado = { banco: null, dim: '', aba: 'questoes' };
    el.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
      estado.aba = b.dataset.t; desenhar();
    }));
    async function recarregar() { estado.banco = await api.bancoLideranca(); desenhar(); }
    function desenhar() { ({ questoes: abaQuestoes, regras: abaRegras, params: abaParams })[estado.aba](); }

    function abaQuestoes() {
      const { dimensoes, questoes, avisos } = estado.banco;
      const dimPorId = Object.fromEntries(dimensoes.map((d) => [d.id, d]));
      const lista = questoes.filter((q) => !estado.dim || String(q.dimensao_id) === estado.dim);
      corpo.innerHTML = `
        ${avisos.length ? `<div class="aviso"><b>Atenção ao banco:</b><br>${avisos.map(esc).join('<br>')}</div>` : ''}
        <div class="row" style="margin-bottom:12px">
          <select id="f-dim"><option value="">Todas as dimensões</option>${dimensoes.map((d) => `<option value="${d.id}" ${String(d.id) === estado.dim ? 'selected' : ''}>${esc(d.chave)} · ${esc(d.nome)}</option>`).join('')}</select>
          <span class="ajuda grow">${lista.filter((q) => q.ativo).length} ativas de ${lista.length}</span>
          <button class="btn pri" id="nova">+ Nova questão</button>
        </div>
        ${lista.map((q) => `
          <div class="card" style="${q.ativo ? '' : 'opacity:.55'}">
            <div class="row">
              <span class="tag">${esc(dimPorId[q.dimensao_id]?.chave)}</span><span class="tag">Parte ${q.parte}</span>
              ${q.tipo === 'pegadinha' ? '<span class="tag peg">pegadinha</span>' : ''}
              ${q.par_id ? '<span class="tag">com espelho</span>' : ''}
              ${q.substitui_id ? '<span class="tag ver">nova versão</span>' : ''}
              ${q.ativo ? '' : '<span class="tag off">inativa</span>'}
              <span class="grow"></span>
              <button class="btn" data-ed="${q.id}">Editar</button>
              <button class="btn" data-at="${q.id}" data-v="${q.ativo}">${q.ativo ? 'Desativar' : 'Ativar'}</button>
              <button class="btn dan" data-ex="${q.id}">Excluir</button>
            </div>
            <div style="margin:8px 0 6px;font-size:13.5px">${esc(q.texto)}</div>
            ${q.opcoes.map((o) => `<div class="ajuda">• ${esc(o.texto)} <b>(${o.pontos} pt${o.vitrine ? ' · vitrine' : ''})</b></div>`).join('')}
          </div>`).join('')}`;
      corpo.querySelector('#f-dim').onchange = (e) => { estado.dim = e.target.value; abaQuestoes(); };
      corpo.querySelector('#nova').onclick = () => formQuestao(null);
      corpo.querySelectorAll('[data-ed]').forEach((b) => b.onclick = () => formQuestao(questoes.find((q) => q.id === +b.dataset.ed)));
      corpo.querySelectorAll('[data-at]').forEach((b) => b.onclick = async () => { await api.ativarQuestaoLideranca(+b.dataset.at, b.dataset.v !== 'true'); recarregar(); });
      corpo.querySelectorAll('[data-ex]').forEach((b) => b.onclick = async () => {
        if (!confirm('Excluir esta questão?')) return;
        try { await api.excluirQuestaoLideranca(+b.dataset.ex); recarregar(); } catch (e) { alert(e.message); }
      });
    }

    function modal(html) {
      const m = document.createElement('div'); m.className = 'lrh-modal';
      m.innerHTML = `<div class="lrh-box">${html}</div>`;
      m.addEventListener('mousedown', (e) => { if (e.target === m) m.remove(); });
      el.querySelector('.lrh').appendChild(m); return m;
    }
    const mostrarErros = (m, e) => { m.querySelector('#erros').innerHTML = e.detalhes?.length ? `<div class="erros"><b>Corrija antes de salvar:</b><br>${e.detalhes.map(esc).join('<br>')}</div>` : `<div class="erros">${esc(e.message)}</div>`; };

    function formQuestao(q) {
      const { dimensoes, questoes } = estado.banco;
      const ops = q ? q.opcoes.map((o) => ({ ...o })) : [{ texto: '', pontos: 5 }, { texto: '', pontos: 3 }, { texto: '', pontos: 1 }, { texto: '', pontos: 2 }];
      const m = modal(`
        <h3 style="margin-top:0">${q ? 'Editar questão' : 'Nova questão'}</h3>
        ${q?.respondida ? '<div class="aviso">Esta questão já foi respondida em mapas existentes. Ao salvar, será criada uma <b>nova versão</b> e a atual será desativada — os mapas antigos não mudam.</div>' : ''}
        <div class="row"><div><label>Dimensão</label><select id="q-dim">${dimensoes.map((d) => `<option value="${d.id}" ${q?.dimensao_id === d.id ? 'selected' : ''}>${esc(d.chave)} · ${esc(d.nome)}</option>`).join('')}</select></div>
        <div><label>Parte</label><select id="q-parte"><option value="1" ${q?.parte === 1 ? 'selected' : ''}>1</option><option value="2" ${q?.parte === 2 ? 'selected' : ''}>2</option></select></div>
        <div><label>Tipo</label><select id="q-tipo"><option value="normal">Normal</option><option value="pegadinha" ${q?.tipo === 'pegadinha' ? 'selected' : ''}>Pegadinha</option></select></div></div>
        <div id="dica" class="ajuda" style="margin-top:8px"></div>
        <label>Situação (enunciado)</label><textarea id="q-texto">${esc(q?.texto || '')}</textarea>
        <label>Questão-espelho (mede consistência com esta) — opcional</label><select id="q-par"></select>
        <label>Opções — pontos de 1 a 5${''} · marque <b>vitrine</b> na que "soa certa" mas é a errada</label>
        <div id="ops"></div><button class="btn" id="add-op">+ opção</button>
        <div id="erros"></div>
        <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="cancela">Cancelar</button><button class="btn pri" id="salva">Salvar</button></div>`);
      const $ = (s) => m.querySelector(s);
      function pintarPar() {
        const d = +$('#q-dim').value;
        $('#q-par').innerHTML = '<option value="">— nenhuma —</option>' + questoes.filter((x) => x.dimensao_id === d && x.ativo && x.id !== q?.id)
          .map((x) => `<option value="${x.id}" ${q?.par_id === x.id ? 'selected' : ''}>#${x.ordem} ${esc(x.texto.slice(0, 70))}…</option>`).join('');
      }
      function pintarDica() {
        $('#dica').innerHTML = $('#q-tipo').value === 'pegadinha'
          ? '<b>Pegadinha:</b> inclua uma opção de <b>vitrine</b> (o que um livro de liderança diria, mas que é errado neste contexto — vale no máximo 3 pts) e uma resposta de 5 pts que não seja a de vitrine. Quem escolhe a vitrine repetidamente é sinalizado ao RH.'
          : '<b>Normal:</b> a melhor resposta vale 4 ou 5 pts; deixe ao menos 2 pts de diferença entre a melhor e a pior.';
      }
      function pintarOps() {
        $('#ops').innerHTML = ops.map((o, i) => `<div class="opt">
          <input data-i="${i}" data-c="texto" value="${esc(o.texto)}" placeholder="Texto da opção">
          <select data-i="${i}" data-c="pontos">${[1, 2, 3, 4, 5].map((p) => `<option ${o.pontos === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
          <label style="margin:0;display:flex;gap:4px;align-items:center"><input type="checkbox" data-i="${i}" data-c="vitrine" ${o.vitrine ? 'checked' : ''}>vitrine</label>
          <button class="btn dan" data-rm="${i}">×</button></div>`).join('');
        m.querySelectorAll('[data-c]').forEach((f) => f.oninput = f.onchange = () => {
          const o = ops[+f.dataset.i]; o[f.dataset.c] = f.dataset.c === 'vitrine' ? f.checked : f.dataset.c === 'pontos' ? +f.value : f.value;
        });
        m.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { ops.splice(+b.dataset.rm, 1); pintarOps(); });
      }
      pintarPar(); pintarDica(); pintarOps();
      $('#q-dim').onchange = pintarPar; $('#q-tipo').onchange = pintarDica;
      $('#add-op').onclick = () => { if (ops.length < 6) { ops.push({ texto: '', pontos: 3 }); pintarOps(); } };
      $('#cancela').onclick = () => m.remove();
      $('#salva').onclick = async () => {
        try {
          await api.salvarQuestaoLideranca({ id: q?.id, dimensaoId: +$('#q-dim').value, parte: +$('#q-parte').value, tipo: $('#q-tipo').value,
            texto: $('#q-texto').value, parId: $('#q-par').value ? +$('#q-par').value : null, opcoes: ops });
          m.remove(); recarregar();
        } catch (e) { mostrarErros(m, e); }
      };
    }

    async function abaRegras() {
      const regras = await api.regrasLideranca();
      const { dimensoes, faixas } = estado.banco;
      const rotulo = (r) => ({ dimensao: `${r.dim_chave}: ${r.pct_min}–${r.pct_max}%`, consistencia: 'Respostas inconsistentes', vitrine: 'Padrão de vitrine', faixa: `Faixa: ${r.faixa_chave}` }[r.gatilho]);
      corpo.innerHTML = `<div class="row" style="margin-bottom:12px"><span class="ajuda grow">Regras fixas: quando o gatilho ocorre no mapa, a ação entra no rascunho do plano (o RH revisa antes de aprovar).</span><button class="btn pri" id="nova-r">+ Nova regra</button></div>` +
        regras.map((r) => `<div class="card" style="${r.ativo ? '' : 'opacity:.55'}"><div class="row"><span class="tag">${esc(rotulo(r))}</span><span class="tag">prioridade ${r.prioridade}</span><span class="tag">${r.prazo_dias} dias</span><span class="grow"></span>
          <button class="btn" data-er="${r.id}">Editar</button><button class="btn dan" data-xr="${r.id}">Excluir</button></div>
          <div style="margin:8px 0 2px;font-weight:600;font-size:13.5px">${esc(r.titulo)}</div><div class="ajuda">${esc(r.descricao)}</div></div>`).join('');
      corpo.querySelector('#nova-r').onclick = () => formRegra(null);
      corpo.querySelectorAll('[data-er]').forEach((b) => b.onclick = () => formRegra(regras.find((r) => r.id === +b.dataset.er)));
      corpo.querySelectorAll('[data-xr]').forEach((b) => b.onclick = async () => { if (confirm('Excluir regra?')) { await api.excluirRegraLideranca(+b.dataset.xr); abaRegras(); } });

      function formRegra(r) {
        const m = modal(`<h3 style="margin-top:0">${r ? 'Editar regra' : 'Nova regra'}</h3>
          <div class="row"><div><label>Gatilho</label><select id="r-g">${[['dimensao', 'Dimensão fraca'], ['consistencia', 'Inconsistência'], ['vitrine', 'Padrão de vitrine'], ['faixa', 'Faixa geral']].map(([v, t]) => `<option value="${v}" ${r?.gatilho === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Dimensão</label><select id="r-d">${dimensoes.map((d) => `<option value="${d.id}" ${r?.dimensao_id === d.id ? 'selected' : ''}>${esc(d.chave)}</option>`).join('')}</select></div>
          <div><label>% de</label><input id="r-min" type="number" min="0" max="100" style="width:70px" value="${r?.pct_min ?? 0}"></div>
          <div><label>% até</label><input id="r-max" type="number" min="0" max="100" style="width:70px" value="${r?.pct_max ?? 59}"></div>
          <div><label>Faixa</label><select id="r-f">${faixas.map((f) => `<option value="${f.chave}" ${r?.faixa_chave === f.chave ? 'selected' : ''}>${esc(f.rotulo)}</option>`).join('')}</select></div></div>
          <label>Título da ação</label><input id="r-t" style="width:100%" value="${esc(r?.titulo || '')}">
          <label>Descrição</label><textarea id="r-ds">${esc(r?.descricao || '')}</textarea>
          <div class="row"><div><label>Tipo</label><select id="r-tp">${['treinamento', 'leitura', 'mentoria', 'pratica', 'conversa'].map((t) => `<option ${r?.tipo_acao === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Prazo (dias)</label><input id="r-pz" type="number" style="width:80px" value="${r?.prazo_dias ?? 60}"></div>
          <div><label>Prioridade</label><select id="r-pr">${[1, 2, 3].map((p) => `<option ${(r?.prioridade ?? 2) === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
          <div><label>Ativa</label><input id="r-at" type="checkbox" ${r?.ativo === false ? '' : 'checked'}></div></div>
          <div id="erros"></div><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="cancela">Cancelar</button><button class="btn pri" id="salva">Salvar</button></div>`);
        const $ = (s) => m.querySelector(s);
        $('#cancela').onclick = () => m.remove();
        $('#salva').onclick = async () => {
          try {
            await api.salvarRegraLideranca({ id: r?.id, gatilho: $('#r-g').value, dimensaoId: +$('#r-d').value, pctMin: +$('#r-min').value, pctMax: +$('#r-max').value,
              faixaChave: $('#r-f').value, titulo: $('#r-t').value, descricao: $('#r-ds').value, tipoAcao: $('#r-tp').value, prazoDias: +$('#r-pz').value, prioridade: +$('#r-pr').value, ativo: $('#r-at').checked });
            m.remove(); abaRegras();
          } catch (e) { mostrarErros(m, e); }
        };
      }
    }

    function abaParams() {
      const rot = { limiar_gap: 'Diferença entre partes que indica inconsistência (pontos %)', limiar_vitrine: '% de pegadinhas em vitrine que torna o resultado pouco confiável',
        max_dimensoes_plano: 'Máximo de dimensões no plano (evita plano inexequível)', pct_dimensao_reforco: 'Dimensão abaixo deste % entra no plano' };
      corpo.innerHTML = '<div class="card">' + estado.banco.config.map((c) => `<label>${esc(rot[c.chave] || c.chave)}</label><input type="number" data-k="${c.chave}" value="${Number(c.valor)}" style="width:100px">`).join('') +
        '<div id="erros"></div><div style="margin-top:14px"><button class="btn pri" id="salva-p">Salvar parâmetros</button></div></div>';
      corpo.querySelector('#salva-p').onclick = async () => {
        const cfg = {}; corpo.querySelectorAll('[data-k]').forEach((i) => cfg[i.dataset.k] = +i.value);
        try { await api.configLideranca(cfg); recarregar(); } catch (e) { corpo.querySelector('#erros').innerHTML = `<div class="erros">${esc(e.message)}</div>`; }
      };
    }
    recarregar();
  }

  /* ======================  QUESTIONÁRIO DO LÍDER  ====================== */
  async function abrirQuestionario(el, aoConcluir, colaboradorId) {
    const qs = await api.questionarioLideranca();
    const resp = {}; let i = 0;
    el.innerHTML = '<div class="lrh" id="qz"></div>';
    const raiz = el.querySelector('#qz');
    function tela() {
      const q = qs[i];
      raiz.innerHTML = `<div class="card"><div class="ajuda">Questão ${i + 1} de ${qs.length}</div>
        <div class="bar" style="margin:6px 0 14px"><i style="width:${(i / qs.length) * 100}%;background:#232323"></i></div>
        <div style="font-size:15px;margin-bottom:12px">${esc(q.texto)}</div>
        ${q.opcoes.map((o) => `<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;font-weight:400;color:inherit;margin:8px 0;cursor:pointer">
          <input type="radio" name="op" value="${o.id}" ${resp[q.id] === o.id ? 'checked' : ''}> <span>${esc(o.texto)}</span></label>`).join('')}
        <div id="erros"></div>
        <div class="row" style="margin-top:14px;justify-content:space-between">
          <button class="btn" id="ant" ${i === 0 ? 'disabled' : ''}>Anterior</button>
          <button class="btn pri" id="prox">${i === qs.length - 1 ? 'Concluir' : 'Próxima'}</button></div></div>`;
      raiz.querySelectorAll('[name=op]').forEach((r) => r.onchange = () => { resp[q.id] = +r.value; });
      raiz.querySelector('#ant').onclick = () => { i--; tela(); };
      raiz.querySelector('#prox').onclick = async () => {
        if (!resp[q.id]) { raiz.querySelector('#erros').innerHTML = '<div class="erros">Escolha uma opção para continuar.</div>'; return; }
        if (i < qs.length - 1) { i++; tela(); return; }
        try {
          const r = await api.aplicarMapaLideranca(Object.entries(resp).map(([questaoId, opcaoId]) => ({ questaoId: +questaoId, opcaoId })), colaboradorId);
          mostrarResultado(r);
        } catch (e) { raiz.querySelector('#erros').innerHTML = `<div class="erros">${esc(e.message)}</div>`; }
      };
    }
    function mostrarResultado(r) {
      raiz.innerHTML = `<div class="card"><h3 style="margin-top:0">Mapa concluído · ${r.geralPct}%</h3>
        <div class="ajuda" style="margin-bottom:12px">Seu plano de desenvolvimento será revisado pelo RH e ficará disponível aqui após a aprovação.</div>
        ${r.dimensoes.map((d) => `<div style="margin:8px 0"><div class="row"><span class="grow" style="font-size:13px">${esc(d.nome)}</span><b>${d.pct}%</b></div><div class="bar"><i style="width:${d.pct}%;background:#2563EB"></i></div></div>`).join('')}</div>`;
      if (aoConcluir) aoConcluir(r);
    }
    tela();
  }

  window.LiderancaRH = { montarEditor, abrirQuestionario };
})();
