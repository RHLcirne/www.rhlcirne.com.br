// =========================================================
// api-client.js — camada de acesso à API, para substituir os
// arrays em memória / localStorage do protótipo original.
//
// Como usar: inclua este arquivo ANTES do <script> principal no HTML,
// ou cole no topo dele. Ele expõe um objeto global `api` com os mesmos
// tipos de operação que o front-end já faz hoje (ex: ler/gravar
// colaboradores, autenticar, etc.), só que via fetch para o backend.
// =========================================================

const API_BASE_URL = window.API_BASE_URL || '/api'; // mesma origem do portal

let _authToken = null; // mantido só em memória (nunca em localStorage) por segurança

function setAuthToken(token) { _authToken = token; }
function getAuthToken() { return _authToken; }

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (_authToken) headers.Authorization = `Bearer ${_authToken}`;

  const resp = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await resp.json(); } catch (e) { /* resposta sem corpo, ok */ }

  if (!resp.ok) {
    const msg = (data && data.erro) || `Erro ${resp.status} ao chamar ${path}`;
    const err = new Error(msg);
    err.status = resp.status;
    err.detalhes = (data && data.detalhes) || [];
    throw err;
  }
  return data;
}

const api = {
  // ---- Autenticação ----------------------------------------------------
  // Substitui a função onSubmitLogin() que hoje compara contra o array
  // USUARIOS em memória (linha ~2690 do arquivo original).
  async login(login, senha) {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { login, senha } });
    setAuthToken(data.token);
    return data; // { token, usuario, precisaTrocarSenha }
  },
  logout() { setAuthToken(null); },
  trocarSenha(senhaAtual, novaSenha) {
    return apiRequest('/auth/trocar-senha', { method: 'POST', body: { senhaAtual, novaSenha } });
  },
  esqueciSenha(login) {
    return apiRequest('/auth/esqueci-senha', { method: 'POST', body: { login } });
  },
  redefinirSenha(token, novaSenha) {
    return apiRequest('/auth/redefinir-senha', { method: 'POST', body: { token, novaSenha } });
  },

  // ---- Colaboradores -----------------------------------------------------
  // Substitui leituras diretas do array COLABORADORES / colaboradoresEscopo()
  listarColaboradores(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/colaboradores${qs ? `?${qs}` : ''}`);
  },
  buscarColaborador(id) { return apiRequest(`/colaboradores/${id}`); },
  // Substitui `meuColaborador()` que hoje procura currentUser.colaboradorId no array local
  meusDados() { return apiRequest('/colaborador/meus-dados'); },
  criarColaborador(dados) { return apiRequest('/colaboradores', { method: 'POST', body: dados }); },
  atualizarColaborador(id, dados) { return apiRequest(`/colaboradores/${id}`, { method: 'PUT', body: dados }); },

  listarEmpresas() { return apiRequest('/empresas'); },
  listarPdi() { return apiRequest('/pdi'); },

  // ---- Usuários / credenciais (tela ADM/RH) ------------------------------
  listarUsuarios() { return apiRequest('/usuarios'); },
  criarUsuario(dados) { return apiRequest('/usuarios', { method: 'POST', body: dados }); },
  atualizarUsuario(id, dados) { return apiRequest(`/usuarios/${id}`, { method: 'PUT', body: dados }); },
  alterarStatusUsuario(id, status) { return apiRequest(`/usuarios/${id}/status`, { method: 'PATCH', body: { status } }); },
  bloquearUsuario(id) { return apiRequest(`/usuarios/${id}/status`, { method: 'PATCH', body: { status: 'bloqueado' } }); },
  desbloquearUsuario(id) { return apiRequest(`/usuarios/${id}/status`, { method: 'PATCH', body: { status: 'ativo' } }); },
  redefinirSenhaUsuario(id) { return apiRequest(`/usuarios/${id}/redefinir-senha`, { method: 'POST' }); },

  // ---- Engine de módulos (Configurações) ---------------------------------
  listarModulos() { return apiRequest('/modulos') },
  alternarModulo(id, ativo) { return apiRequest(`/modulos/${id}/ativo`, { method: 'PATCH', body: { ativo } }); },
  matrizPermissoes() { return apiRequest('/modulos/permissoes'); },
  atualizarPermissao(id, permissoes) { return apiRequest(`/modulos/permissoes/${id}`, { method: 'PATCH', body: permissoes }); },

  // ---- Atestados ----------------------------------------------------------
  listarAtestados() { return apiRequest('/atestados'); },
  criarAtestado(dados) { return apiRequest('/atestados', { method: 'POST', body: dados }); },
  decidirAtestado(id, status) { return apiRequest(`/atestados/${id}/decisao`, { method: 'PATCH', body: { status } }); },

  // ---- Pesquisas de clima ---------------------------------------------------
  listarPesquisasAtivas() { return apiRequest('/pesquisas'); },
  perguntasPesquisa(id) { return apiRequest(`/pesquisas/${id}/perguntas`); },
  responderPesquisa(id, respostas) { return apiRequest(`/pesquisas/${id}/respostas`, { method: 'POST', body: { respostas } }); },
  resultadosPesquisa(id) { return apiRequest(`/pesquisas/${id}/resultados`); },
};

// ---- Liderança (motor com banco editável + pegadinhas + plano) -------------
Object.assign(api, {
  questionarioLideranca() { return apiRequest('/lideranca/questionario'); },
  aplicarMapaLideranca(respostas, colaboradorId) { return apiRequest('/lideranca/mapas', { method: 'POST', body: { respostas, colaboradorId } }); },
  meuMapaLideranca() { return apiRequest('/lideranca/meu-mapa'); },
  listarMapasLideranca() { return apiRequest('/lideranca/mapas'); },
  detalheMapaLideranca(id) { return apiRequest(`/lideranca/mapas/${id}`); },
  consolidadoLideranca(empresaId) { return apiRequest(`/lideranca/consolidado${empresaId ? `?empresaId=${empresaId}` : ''}`); },
  editarPlanoLideranca(mapaId, dados) { return apiRequest(`/lideranca/planos/${mapaId}`, { method: 'PUT', body: dados }); },
  regerarPlanoLideranca(mapaId) { return apiRequest(`/lideranca/planos/${mapaId}/regerar`, { method: 'POST' }); },
  enviarPlanoAoPdi(mapaId) { return apiRequest(`/lideranca/planos/${mapaId}/enviar-pdi`, { method: 'POST' }); },
  // painel do RH
  bancoLideranca() { return apiRequest('/lideranca/admin/banco'); },
  salvarQuestaoLideranca(q) { return apiRequest(q.id ? `/lideranca/admin/questoes/${q.id}` : '/lideranca/admin/questoes', { method: q.id ? 'PUT' : 'POST', body: q }); },
  ativarQuestaoLideranca(id, ativo) { return apiRequest(`/lideranca/admin/questoes/${id}/ativo`, { method: 'PATCH', body: { ativo } }); },
  excluirQuestaoLideranca(id) { return apiRequest(`/lideranca/admin/questoes/${id}`, { method: 'DELETE' }); },
  regrasLideranca() { return apiRequest('/lideranca/admin/regras'); },
  salvarRegraLideranca(r) { return apiRequest(r.id ? `/lideranca/admin/regras/${r.id}` : '/lideranca/admin/regras', { method: r.id ? 'PUT' : 'POST', body: r }); },
  excluirRegraLideranca(id) { return apiRequest(`/lideranca/admin/regras/${id}`, { method: 'DELETE' }); },
  configLideranca(cfg) { return apiRequest('/lideranca/admin/config', { method: 'PUT', body: cfg }); },
});

window.api = api;
