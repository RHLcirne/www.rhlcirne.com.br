# Gestão de Pessoas · Grupo L. Cirne — Arquitetura ERP

## O que está pronto vs. o que falta (leitura obrigatória)

Este pacote entrega uma **fundação de produção real e funcional** — não um
esqueleto. O que está implementado, testado sintaticamente e pronto para
rodar:

- Schema PostgreSQL completo (todas as 12 tabelas pedidas + auditoria via trigger)
- Backend Node/Express com JWT, bcrypt, bloqueio por tentativas, RBAC
  **dinâmico** (lê a tabela `modulos_permissoes`, não é hardcoded)
- Escopo de visibilidade por perfil implementado e testado logicamente:
  Admin Master/RH → grupo todo; Líder → só subordinados (`gestor_id`);
  Colaborador → só a própria ficha, via `/api/colaborador/meus-dados`
- 3 módulos completos ponta-a-ponta como **padrão de referência**:
  usuários/colaboradores, atestados, pesquisas de clima (com anonimato
  preservado mesmo para o RH)
- Painel de engine de módulos (ativar/desativar módulo, editar matriz CRUD
  por perfil, campos customizados da ficha)
- Cliente de API para o front-end (`frontend/api-client.js`)

O que **não** está implementado nesta entrega — e por quê: seu arquivo
original tem ~19 módulos (treinamentos, PDI, 9-Box, mapa de liderança,
carreira, painel executivo, relatórios, central de alertas, SAC, onboarding,
desligamentos, materiais...). Cada um tem sua própria tela, regras e campos.
Implementar todos com o mesmo rigor (backend + RBAC + refatoração do
front) é um volume de código que não cabe com qualidade em uma única
entrega — e não seria seguro simplesmente gerar 19 módulos "no automático"
sem revisão. A seção **"Como estender aos módulos restantes"** abaixo
mostra o padrão exato para replicar, módulo por módulo, com o mesmo nível
de segurança.

## Decisão de arquitetura: Opção A (Full-Stack Integrado)

Escolhida em vez da Opção B (single-file) porque:
- O sistema terá múltiplas empresas, milhares de registros de colaboradores
  e dados sensíveis (salário, CPF, atestados médicos) — precisa de um banco
  real com transações e auditoria, não de um protótipo de arquivo único.
- RBAC granular por módulo exige que a lógica de permissão viva no
  **servidor**, não no navegador (qualquer regra só no front-end é
  contornável abrindo o DevTools).
- Node/Express + PostgreSQL é o par mais direto de manter para um time que
  vai crescer o sistema aos poucos, módulo por módulo.

## Estrutura de pastas

```
lcirne-erp/
├── database/
│   └── schema.sql          # DDL completo + seed (perfis, módulos, admin inicial)
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── config/db.js            # pool PostgreSQL + suporte a auditoria
│       ├── middleware/auth.js      # verificação JWT
│       ├── middleware/rbac.js      # exigirPerfil() e exigirPermissaoModulo()
│       ├── controllers/            # lógica de negócio
│       └── routes/                 # mapeamento de endpoints
└── frontend/
    └── api-client.js        # substitui localStorage/arrays por fetch()
```

## Como rodar localmente

```bash
# 1) Banco de dados
createdb lcirne_rh
psql lcirne_rh -f database/schema.sql

# 2) Backend
cd backend
cp .env.example .env        # edite DATABASE_URL e JWT_SECRET
npm install
npm run dev                  # http://localhost:3333

# 3) Testar login (usuário criado no seed)
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin.master","senha":"TrocarSenha#2026"}'
```

O seed cria o usuário `admin.master` com senha temporária
`TrocarSenha#2026` e `precisa_trocar_senha = TRUE` — a API já força a troca
no primeiro uso via `POST /api/auth/trocar-senha`. **Troque essa senha antes
de qualquer uso além de desenvolvimento local.**

## Autenticação e RBAC — como funciona de ponta a ponta

1. `POST /api/auth/login` valida `login`/`senha` (bcrypt) e devolve um JWT
   contendo `sub` (id do usuário). O front-end guarda esse token **em
   memória** (`api-client.js`), nunca em `localStorage`, para reduzir a
   superfície de roubo de sessão via XSS.
2. Toda rota protegida passa por `middleware/auth.js`, que valida o JWT e
   **também confirma no banco que o usuário segue ativo** — isso é o que
   garante que bloquear alguém no painel de RH derruba a sessão dele na
   hora, mesmo com token ainda válido.
3. Duas camadas de autorização, compostas:
   - `exigirPerfil(...perfis)` — bloqueia rota inteira por papel (ex: só
     `admin_master`/`gestor_rh` gerenciam usuários).
   - `exigirPermissaoModulo(chave, acao)` — consulta a tabela
     `modulos_permissoes` em tempo real. É isso que faz o painel
     "Configuração de Módulos" (ativar/desativar módulo, editar CRUD por
     perfil) ter efeito de verdade na API, e não só no menu do front-end.
4. Escopo de dados (quem vê o quê) é aplicado dentro de cada controller —
   ver `aplicarEscopo()`/`whereEscopo()` em `colaboradores.controller.js` e
   `atestados.controller.js`. Um colaborador comum não consegue, por
   nenhum caminho de API, ler a ficha de outra pessoa: o endpoint
   `/api/colaborador/meus-dados` usa exclusivamente `req.user.colaboradorId`
   extraído do token, nunca um `:id` vindo da URL.

## Como estender aos módulos restantes

Para cada módulo que falta (treinamentos, PDI, 9-Box, mapa de liderança,
carreira, painel executivo, relatórios, alertas, SAC, onboarding,
desligamentos, materiais, comportamental), repita este padrão, usando
`atestados` ou `pesquisas` como modelo mais próximo:

1. **Tabela(s) no `schema.sql`** — siga o padrão de FK para `colaboradores`
   e `empresas`, adicione índice no campo de busca mais comum, e registre
   o módulo na tabela `modulos` (já existe uma linha para cada um deles no
   seed — só falta a tabela de dados e as rotas).
2. **Controller** — copie a estrutura de `atestados.controller.js`:
   função de escopo (`whereEscopo`) + `listar`/`criar`/`atualizar`.
3. **Rotas** — copie `atestados.routes.js`, trocando a chave do módulo em
   `exigirPermissaoModulo('<chave_do_modulo>', 'ler'|'criar'|...)`.
4. **Registrar em `server.js`** — uma linha `app.use('/api', xRoutes)`.
5. **Front-end** — em `api-client.js`, adicione as funções equivalentes
   (`listarTreinamentos()`, etc.) e, no HTML original, troque a leitura do
   array em memória (ex: `TREINAMENTOS.filter(...)`) por
   `await api.listarTreinamentos()` dentro da função `render<Modulo>()`
   correspondente — o mapeamento `RENDERERS`/`WIRERS` no fim do arquivo
   já indica exatamente quais funções tocar em cada módulo.

## Refatoração do front-end existente — pontos de entrada exatos

No seu arquivo, os pontos que precisam mudar são:

- **Login** (`onSubmitLogin`, ~linha 2690): hoje compara `senha` em texto
  puro contra o array `USUARIOS`. Trocar por `await api.login(login, pass)`
  e usar o `usuario` retornado para popular `currentUser`.
- **Persistência** (`salvarEstado`, usa `window.localStorage` a partir da
  linha ~7994): deixa de gravar o estado inteiro do app a cada ação; cada
  módulo passa a chamar o endpoint específico (`api.criarAtestado(...)`
  etc.) no momento da ação, e a UI re-renderiza com a resposta do servidor
  em vez de reler o array local.
- **Escopo** (`colaboradoresEscopo()`, `meuColaborador()`): trocam a
  filtragem de um array em memória por `await api.listarColaboradores()` /
  `await api.meusDados()` — o filtro por perfil deixa de ser
  responsabilidade do front-end (que só decide o que *mostrar*) e passa a
  ser garantido pelo backend (que decide o que é *permitido ler*).

Essa troca é incremental: dá para migrar módulo por módulo, mantendo o
resto do app funcionando com os arrays em memória enquanto cada tela é
convertida.

## Segurança — decisões já tomadas e o que falta configurar

Já implementado: hash bcrypt (nunca senha em texto puro), bloqueio por
tentativas, RBAC em duas camadas, escopo de dados no backend, auditoria via
trigger, headers de segurança (`helmet`), CORS restrito por variável de
ambiente, rate limit no login.

Ainda por sua conta antes de produção: HTTPS/TLS (normalmente feito no
load balancer/reverse proxy, não no Node), rotação do `JWT_SECRET`,
backup automatizado do PostgreSQL, e política de upload de arquivos
(atestados/fotos) — os campos `arquivo_url`/`foto_url` no schema assumem
que os arquivos ficam em um storage externo (S3 ou similar); este pacote
não inclui o serviço de upload em si.
