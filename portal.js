// Portal Gestão de Pessoas · Grupo L. Cirne — usa apenas a API autenticada.
// Todo texto vindo do servidor passa por esc(). O token JWT fica só em memória
// (atualizar a página exige novo login — escolha deliberada de segurança).
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');
  let sessao = null;
  const ehRH = () => ['admin_master', 'gestor_rh'].includes(sessao.usuario.perfil);
  const PERFIS = { admin_master: 'Administrador Master', gestor_rh: 'Gestor/RH', lider_gestor: 'Líder/Gestor de Setor', colaborador: 'Colaborador' };
  const FAIXAS = { consolidado: 'Consolidado', desenvolvido: 'Desenvolvido', emdesenvolvimento: 'Em desenvolvimento', atencao: 'Requer atenção' };
  const ALERTAS = { inconsistencia_partes: 'Respostas inconsistentes entre as duas partes', respostas_de_vitrine: 'Padrão de respostas "de vitrine"', pares_divergentes: 'Divergência entre questões espelho' };
  const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

  // Qualquer 401 (sessão expirada / usuário bloqueado) volta ao login.
  async function chamar(fn) {
    try { return await fn(); } catch (e) {
      if (e.status === 401 && sessao) { sessao = null; api.logout(); telaLogin('Sessão encerrada. Entre novamente.'); }
      throw e;
    }
  }
  const erroBox = (el, e) => { el.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; };

  /* ---------------- login / troca de senha ---------------- */
  function telaLogin(aviso) {
    app.innerHTML = `<div class="login"><h1>Gestão de Pessoas</h1><p>Grupo L. Cirne · acesso restrito</p>
      ${aviso ? `<div class="msg err">${esc(aviso)}</div>` : ''}
      <label>Usuário</label><input id="lg" class="full" autocomplete="username" autofocus>
      <label>Senha</label><input id="sn" class="full" type="password" autocomplete="current-password">
      <div id="er"></div><div style="margin-top:16px"><button id="ok" class="btn pri full">Entrar</button></div>
      <details style="margin-top:14px;font-size:12px;color:var(--ink-soft)"><summary>Esqueci minha senha</summary>
        <p>Procure o RH: ele redefine sua senha e informa uma senha temporária.</p></details></div>`;
    const entrar = async () => {
      try {
        const r = await api.login($('#lg').value.trim(), $('#sn').value);
        sessao = r;
        r.precisaTrocarSenha ? telaTrocaSenha(true) : shell();
      } catch (e) { erroBox($('#er'), e); }
    };
    $('#ok').onclick = entrar;
    app.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') entrar(); }));
  }

  function telaTrocaSenha(obrigatoria) {
    app.innerHTML = `<div class="login"><h1>${obrigatoria ? 'Defina sua nova senha' : 'Trocar senha'}</h1>
      <p>${obrigatoria ? 'Por segurança, troque a senha temporária antes de continuar.' : ''} Mínimo de 8 caracteres.</p>
      <label>Senha atual</label><input id="a" class="full" type="password" autocomplete="current-password">
      <label>Nova senha</label><input id="n" class="full" type="password" autocomplete="new-password">
      <label>Repita a nova senha</label><input id="n2" class="full" type="password" autocomplete="new-password">
      <div id="er"></div><div class="row" style="margin-top:16px">
      ${obrigatoria ? '' : '<button id="cancela" class="btn">Cancelar</button>'}<button id="ok" class="btn pri grow">Salvar</button></div></div>`;
    if (!obrigatoria) $('#cancela').onclick = shell;
    $('#ok').onclick = async () => {
      if ($('#n').value !== $('#n2').value) return erroBox($('#er'), new Error('As senhas novas não conferem.'));
      try { await chamar(() => api.trocarSenha($('#a').value, $('#n').value)); sessao.precisaTrocarSenha = false; shell(); }
      catch (e) { erroBox($('#er'), e); }
    };
  }

  /* ---------------- estrutura ---------------- */
  function itensMenu() {
    const p = sessao.usuario.perfil; const it = [];
    it.push(['meus', 'Meus dados'], ['pdi', p === 'colaborador' ? 'Meu PDI' : 'PDI']);
    if (p !== 'colaborador') it.push(['lid-meu', 'Meu mapa de liderança'], ['lid-mapas', ehRH() ? 'Mapas e planos' : 'Mapas da minha equipe']);
    if (ehRH()) it.push(['lid-cons', 'Consolidado do grupo'], ['lid-edit', 'Questões e regras'], ['colab', 'Colaboradores'], ['usuarios', 'Usuários e senhas']);
    return it;
  }
  function shell(ativa) {
    const itens = itensMenu(); const atual = ativa || itens[0][0];
    app.innerHTML = `<div class="shell"><aside class="side"><div class="brand">Gestão de Pessoas<small>Grupo L. Cirne</small></div>
      ${itens.map(([k, t]) => `<button class="nav ${k === atual ? 'on' : ''}" data-k="${k}">${esc(t)}</button>`).join('')}
      <div class="who"><b>${esc(sessao.usuario.login)}</b><br>${esc(PERFIS[sessao.usuario.perfil] || sessao.usuario.perfil)}<br>
      <a href="#" id="tsn">Trocar senha</a> · <a href="#" id="sair">Sair</a></div></aside><main id="conteudo"></main></div>`;
    app.querySelectorAll('.nav').forEach((b) => b.onclick = () => shell(b.dataset.k));
    $('#sair').onclick = (e) => { e.preventDefault(); api.logout(); sessao = null; telaLogin(); };
    $('#tsn').onclick = (e) => { e.preventDefault(); telaTrocaSenha(false); };
    ({ meus: telaMeusDados, pdi: telaPdi, 'lid-meu': telaMeuMapa, 'lid-mapas': telaMapas, 'lid-cons': telaConsolidado, 'lid-edit': telaEditor, colab: telaColaboradores, usuarios: telaUsuarios })[atual]($('#conteudo'));
  }
  const cab = (t, s) => `<h2>${esc(t)}</h2><p class="sub">${esc(s || '')}</p>`;
  const barras = (dims) => dims.map((d) => `<div style="margin:9px 0"><div class="row"><span class="grow">${esc(d.nome)}</span><b>${d.pct}%</b></div><div class="bar"><i style="width:${d.pct}%"></i></div></div>`).join('');

  /* ---------------- meus dados / PDI (todos os perfis) ---------------- */
  async function telaMeusDados(el) {
    el.innerHTML = cab('Meus dados', 'Somente você e o RH têm acesso a estas informações.') + '<div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const f = await chamar(() => api.meusDados());
      if (!f) { c.innerHTML = '<div class="card sub">Seu usuário ainda não está vinculado a uma ficha de colaborador. Procure o RH.</div>'; return; }
      const linhas = [['Nome', f.nome], ['Empresa', f.empresa_nome], ['Unidade', f.unidade_nome], ['Cargo', f.cargo], ['Departamento', f.departamento],
        ['Gestor direto', f.gestor_nome], ['Admissão', fmtData(f.data_admissao)], ['Telefone', f.telefone], ['E-mail pessoal', f.email_pessoal], ['Situação', f.status]];
      c.innerHTML = `<div class="card"><table>${linhas.map(([k, v]) => `<tr><th style="width:170px">${esc(k)}</th><td>${esc(v || '—')}</td></tr>`).join('')}</table></div>`;
    } catch (e) { erroBox(c, e); }
  }
  async function telaPdi(el) {
    const eu = sessao.usuario.perfil === 'colaborador';
    el.innerHTML = cab(eu ? 'Meu PDI' : 'PDI', 'Plano de Desenvolvimento Individual: objetivos e ações combinados com seu gestor.') + '<div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const lista = await chamar(() => api.listarPdi());
      if (!lista.length) { c.innerHTML = '<div class="card sub">Nenhuma ação de PDI registrada.</div>'; return; }
      c.innerHTML = `<div class="card"><table><tr>${eu ? '' : '<th>Pessoa</th>'}<th>Objetivo</th><th>Ações</th><th>Prazo</th><th>Situação</th></tr>${lista.map((x) =>
        `<tr>${eu ? '' : `<td>${esc(x.colaborador_nome)}</td>`}<td>${esc(x.objetivo)}</td><td>${esc(x.acoes)}</td><td>${fmtData(x.prazo)}</td><td><span class="tag">${esc(x.status)}</span></td></tr>`).join('')}</table></div>`;
    } catch (e) { erroBox(c, e); }
  }

  /* ---------------- liderança: meu mapa ---------------- */
  async function telaMeuMapa(el) {
    el.innerHTML = cab('Meu mapa de liderança', 'Situações do dia a dia para mapear seu estilo de liderança e apoiar seu desenvolvimento.') + '<div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const r = await chamar(() => api.meuMapaLideranca());
      if (!r) return fazer();
      const { mapa, plano } = r;
      c.innerHTML = `<div class="card"><div class="row"><h3 style="margin:0" class="grow">Resultado geral: ${mapa.geralPct}%</h3><span class="tag">${esc(FAIXAS[mapa.faixaChave] || mapa.faixaChave)}</span></div>
        <div class="sub" style="margin:4px 0 8px">Realizado em ${fmtData(mapa.criadoEm)}</div>${barras(mapa.dimensoes)}</div>
        <div class="card"><h3 style="margin-top:0">Plano de desenvolvimento</h3>${
          !plano || plano.status === 'em_revisao' ? '<p class="sub">Seu plano está em revisão pelo RH e ficará disponível aqui após a aprovação.</p>'
          : plano.acoes.map((a) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><b>${esc(a.titulo)}</b> <span class="tag">${esc(a.tipo_acao)}</span> <span class="tag">${a.prazo_dias} dias</span><div class="sub" style="margin:2px 0 0">${esc(a.descricao)}</div></div>`).join('') || '<p class="sub">Sem ações sugeridas.</p>'}</div>
        <button id="refaz" class="btn">Refazer o mapa</button>`;
      $('#refaz', el).onclick = () => { if (confirm('Refazer o mapa cria um novo resultado. Continuar?')) fazer(); };
    } catch (e) { erroBox(c, e); }
    function fazer() { c.innerHTML = ''; LiderancaRH.abrirQuestionario(c, () => {}).catch((e) => erroBox(c, e)); }
  }

  /* ---------------- liderança: mapas e planos ---------------- */
  async function telaMapas(el) {
    el.innerHTML = cab(ehRH() ? 'Mapas e planos' : 'Mapas da minha equipe', 'Resultados do mapa de liderança e planos de desenvolvimento.') + '<div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const mapas = await chamar(() => api.listarMapasLideranca());
      if (!mapas.length) { c.innerHTML = '<div class="card sub">Nenhum mapa aplicado ainda.</div>'; return; }
      c.innerHTML = `<div class="card"><table><tr><th>Líder</th><th>Data</th><th>Geral</th><th>Faixa</th>${ehRH() ? '<th>Confiabilidade</th>' : ''}</tr>${mapas.map((m) => `
        <tr class="click" data-id="${m.id}"><td>${esc(m.colaboradorNome)}</td><td>${fmtData(m.criadoEm)}</td><td><b>${m.geralPct}%</b></td><td>${esc(FAIXAS[m.faixaChave] || '')}</td>
        ${ehRH() ? `<td><span class="tag ${m.confiabilidade === 'alta' ? 'ok' : m.confiabilidade === 'media' ? 'warn' : 'bad'}">${esc(m.confiabilidade)}</span></td>` : ''}</tr>`).join('')}</table></div>`;
      c.querySelectorAll('tr.click').forEach((tr) => tr.onclick = () => detalhe(+tr.dataset.id));
    } catch (e) { erroBox(c, e); }

    async function detalhe(id) {
      c.innerHTML = 'Carregando…';
      try {
        const { mapa, plano } = await chamar(() => api.detalheMapaLideranca(id));
        const rh = ehRH();
        c.innerHTML = `<button id="volta" class="btn" style="margin-bottom:12px">← Voltar</button>
          <div class="card"><div class="row"><h3 class="grow" style="margin:0">${esc(mapa.colaboradorNome)} · ${mapa.geralPct}%</h3><span class="tag">${esc(FAIXAS[mapa.faixaChave] || '')}</span></div>
          <div class="sub" style="margin:4px 0 8px">${fmtData(mapa.criadoEm)}${rh ? ` · confiabilidade <b>${esc(mapa.confiabilidade)}</b> · índice de vitrine ${mapa.indiceVitrine ?? '—'}%` : ''}</div>
          ${rh && mapa.alertas?.length ? `<div class="msg err"><b>Atenção ao interpretar:</b><br>${mapa.alertas.map((a) => esc(ALERTAS[a] || a)).join('<br>')}<br><small>Valide com conversa individual e feedback 360° antes de decisões.</small></div>` : ''}
          ${barras(mapa.dimensoes)}</div>
          ${rh ? '<div class="card" id="pl"></div>' : ''}`;
        $('#volta', c).onclick = () => telaMapas(el);
        if (rh) planoRH(id, plano);
      } catch (e) { erroBox(c, e); }
    }

    function planoRH(mapaId, plano) {
      const pl = $('#pl', c); const st = plano.status;
      const editavel = st !== 'no_pdi';
      pl.innerHTML = `<div class="row"><h3 class="grow" style="margin:0">Plano de desenvolvimento</h3><span class="tag ${st === 'no_pdi' ? 'ok' : 'warn'}">${{ rascunho: 'rascunho', aprovado: 'aprovado', no_pdi: 'enviado ao PDI' }[st]}</span></div>
        <p class="sub" style="margin:4px 0 8px">Gerado pelas regras fixas. Desmarque o que não se aplica e ajuste antes de aprovar. O líder só vê depois da aprovação.</p>
        ${plano.acoes.map((a) => `<div style="padding:9px 0;border-top:1px solid var(--line)"><div class="row">
          <input type="checkbox" data-inc="${a.id}" ${a.incluir ? 'checked' : ''} ${editavel ? '' : 'disabled'}>
          <input class="grow" data-tit="${a.id}" value="${esc(a.titulo)}" ${editavel ? '' : 'disabled'}>
          <input type="number" min="1" max="365" style="width:76px" data-pz="${a.id}" value="${a.prazo_dias}" ${editavel ? '' : 'disabled'}><span class="sub">dias</span></div>
          <div class="sub" style="margin:4px 0 0 26px">${esc(a.descricao)}</div></div>`).join('')}
        <div id="msg"></div>
        ${editavel ? `<div class="row" style="margin-top:12px"><button id="salva" class="btn">Salvar ajustes</button>
          ${st === 'rascunho' ? '<button id="regera" class="btn">Regerar pelas regras</button>' : ''}
          ${st === 'rascunho' ? '<button id="aprova" class="btn pri">Aprovar plano</button>' : '<button id="pdi" class="btn pri">Enviar ao PDI</button>'}</div>` : ''}`;
      if (!editavel) return;
      const coletar = () => plano.acoes.map((a) => ({ id: a.id, incluir: $(`[data-inc="${a.id}"]`, pl).checked, titulo: $(`[data-tit="${a.id}"]`, pl).value, prazoDias: +$(`[data-pz="${a.id}"]`, pl).value }));
      const recarrega = async () => { const r = await chamar(() => api.detalheMapaLideranca(mapaId)); planoRH(mapaId, r.plano); };
      const agir = (sel, fn, ok) => { const b = $(sel, pl); if (b) b.onclick = async () => { try { await chamar(fn); await recarrega(); $('#msg', pl).innerHTML = `<div class="msg ok">${ok}</div>`; } catch (e) { erroBox($('#msg', pl), e); } }; };
      agir('#salva', () => api.editarPlanoLideranca(mapaId, { acoes: coletar() }), 'Ajustes salvos.');
      agir('#regera', () => api.regerarPlanoLideranca(mapaId), 'Plano regerado pelas regras atuais.');
      agir('#aprova', () => api.editarPlanoLideranca(mapaId, { acoes: coletar(), aprovar: true }), 'Plano aprovado. O líder já pode vê-lo.');
      agir('#pdi', () => api.enviarPlanoAoPdi(mapaId), 'Ações enviadas ao PDI.');
    }
  }

  /* ---------------- liderança: consolidado / editor ---------------- */
  async function telaConsolidado(el) {
    el.innerHTML = cab('Consolidado do grupo', 'Onde a liderança do grupo mais precisa de desenvolvimento (último mapa de cada líder).') + '<div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const r = await chamar(() => api.consolidadoLideranca());
      c.innerHTML = `<div class="grid"><div class="card kpi"><b>${r.totalMapeados}</b><span>líderes mapeados</span></div>
        <div class="card kpi"><b>${r.lideresPendentes.length}</b><span>líderes sem mapa</span></div>
        <div class="card kpi"><b>${r.resultadosPoucoConfiaveis}</b><span>resultados pouco confiáveis</span></div></div>
        <div class="card"><h3 style="margin-top:0">Média por dimensão (da mais fraca à mais forte)</h3>${barras(r.dimensoes.map((d) => ({ nome: d.nome, pct: d.mediaPct })))}
        ${r.prioridadesDoGrupo.length ? `<p class="sub">Prioridades de treinamento coletivo: <b>${esc(r.prioridadesDoGrupo.join(', '))}</b></p>` : ''}</div>
        <div class="card"><h3 style="margin-top:0">Líderes que ainda não fizeram o mapa</h3>${r.lideresPendentes.map((l) => esc(l.nome)).join(' · ') || '<span class="sub">Todos mapeados.</span>'}</div>`;
    } catch (e) { erroBox(c, e); }
  }
  function telaEditor(el) {
    el.innerHTML = cab('Questões e regras', 'Edite as situações, as pegadinhas e as regras do plano. Questões já respondidas geram nova versão.') + '<div id="c"></div>';
    LiderancaRH.montarEditor($('#c', el));
  }

  /* ---------------- colaboradores ---------------- */
  async function telaColaboradores(el) {
    el.innerHTML = cab('Colaboradores', 'Cadastro da ficha. Crie o acesso em "Usuários e senhas".') + '<div id="f"></div><div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const [lista, emps] = await Promise.all([chamar(() => api.listarColaboradores()), chamar(() => api.listarEmpresas())]);
      $('#f', el).innerHTML = `<div class="card"><h3 style="margin-top:0">Novo colaborador</h3><div class="row">
        <div><label>Nome</label><input id="cn"></div><div><label>Empresa</label><select id="ce">${emps.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
        <div><label>Cargo</label><input id="cc"></div><div><label>Departamento</label><input id="cd"></div>
        <div><label>Gestor direto</label><select id="cg"><option value="">—</option>${lista.map((l) => `<option value="${l.id}">${esc(l.nome)}</option>`).join('')}</select></div></div>
        <div id="cm"></div><button id="cs" class="btn pri" style="margin-top:12px">Cadastrar</button></div>`;
      $('#cs', el).onclick = async () => {
        try {
          await chamar(() => api.criarColaborador({ nome: $('#cn').value.trim(), empresaId: +$('#ce').value, cargo: $('#cc').value || null, departamento: $('#cd').value || null, gestorId: $('#cg').value ? +$('#cg').value : null }));
          telaColaboradores(el);
        } catch (e) { erroBox($('#cm', el), e); }
      };
      c.innerHTML = `<div class="card"><table><tr><th>Nome</th><th>Cargo</th><th>Empresa</th><th>Status</th></tr>${lista.map((l) => `<tr><td>${esc(l.nome)}</td><td>${esc(l.cargo)}</td><td>${esc(l.empresa_nome)}</td><td>${esc(l.status)}</td></tr>`).join('')}</table></div>`;
    } catch (e) { erroBox(c, e); }
  }

  /* ---------------- usuários e senhas ---------------- */
  async function telaUsuarios(el) {
    el.innerHTML = cab('Usuários e senhas', 'Crie acessos, bloqueie e redefina senhas. A senha temporária aparece uma única vez.') + '<div id="f"></div><div id="seg"></div><div id="c">Carregando…</div>';
    const c = $('#c', el);
    try {
      const [us, cols] = await Promise.all([chamar(() => api.listarUsuarios()), chamar(() => api.listarColaboradores())]);
      const perfisPermitidos = Object.keys(PERFIS).filter((p) => sessao.usuario.perfil === 'admin_master' || p !== 'admin_master');
      $('#f', el).innerHTML = `<div class="card"><h3 style="margin-top:0">Novo usuário</h3><div class="row">
        <div><label>Login</label><input id="ul"></div><div><label>E-mail</label><input id="ue" type="email"></div>
        <div><label>Perfil</label><select id="up">${perfisPermitidos.map((p) => `<option value="${p}" ${p === 'colaborador' ? 'selected' : ''}>${PERFIS[p]}</option>`).join('')}</select></div>
        <div><label>Colaborador (ficha)</label><select id="uc"><option value="">—</option>${cols.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div></div>
        <div id="um"></div><button id="us" class="btn pri" style="margin-top:12px">Criar acesso</button></div>`;
      $('#us', el).onclick = async () => {
        try {
          const r = await chamar(() => api.criarUsuario({ login: $('#ul').value.trim(), email: $('#ue').value.trim() || null, perfilChave: $('#up').value, colaboradorId: $('#uc').value ? +$('#uc').value : null }));
          await telaUsuarios(el); segredo(el, `Acesso criado para ${r.login}`, r.senhaTemporaria);
        } catch (e) { erroBox($('#um', el), e); }
      };
      c.innerHTML = `<div class="card"><table><tr><th>Login</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th></th></tr>${us.map((u) => `<tr>
        <td>${esc(u.login)}</td><td>${esc(u.perfil_nome)}</td><td><span class="tag ${u.status === 'ativo' ? 'ok' : 'bad'}">${esc(u.status)}</span></td><td>${fmtData(u.ultimo_login)}</td>
        <td><div class="row"><button class="btn" data-st="${u.id}" data-to="${u.status === 'ativo' ? 'bloqueado' : 'ativo'}">${u.status === 'ativo' ? 'Bloquear' : 'Desbloquear'}</button><button class="btn" data-rs="${u.id}" data-lg="${esc(u.login)}">Redefinir senha</button></div></td></tr>`).join('')}</table></div>`;
      c.querySelectorAll('[data-st]').forEach((b) => b.onclick = async () => { try { await chamar(() => api.alterarStatusUsuario(+b.dataset.st, b.dataset.to)); telaUsuarios(el); } catch (e) { erroBox($('#seg', el), e); } });
      c.querySelectorAll('[data-rs]').forEach((b) => b.onclick = async () => {
        if (!confirm(`Redefinir a senha de ${b.dataset.lg}? A senha atual deixa de funcionar.`)) return;
        try { const r = await chamar(() => api.redefinirSenhaUsuario(+b.dataset.rs)); segredo(el, `Nova senha temporária de ${b.dataset.lg}`, r.senhaTemporaria); } catch (e) { erroBox($('#seg', el), e); }
      });
    } catch (e) { erroBox(c, e); }
  }
  function segredo(el, titulo, senha) {
    $('#seg', el).innerHTML = `<div class="card"><b>${esc(titulo)}</b><div class="secret" style="margin:8px 0">${esc(senha)}</div>
      <div class="sub">Anote e repasse por canal seguro. Não será exibida novamente; o usuário deverá trocá-la no primeiro acesso.</div></div>`;
  }

  telaLogin();
})();
