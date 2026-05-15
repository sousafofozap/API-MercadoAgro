# MercadoAgro Mobile API

API RESTful do MercadoAgro voltada para consumo por aplicativo mobile. A aplicacao centraliza autenticacao, gestao de conta, publicacao de anuncios e consulta publica de itens do marketplace agro.

Esta implementacao mantem os endpoints tecnicos originais em ingles (`/users`, `/listings`) e tambem expoe uma camada compativel com o contrato inicial em PT-BR (`/usuarios`, `/anuncios`).

## Visao Geral

- API stateless com `NestJS + Fastify`
- Persistencia em `PostgreSQL` via `Prisma`
- Autenticacao com JWT access token e refresh token rotativo
- Perfis funcionais separados entre `anunciante` e `comprador`
- Avaliacoes, conversas e mensagens para o fluxo de negociacao
- Upload multipart de fotos dos anuncios
- Rate limit global e reforcado em rotas publicas/sensiveis
- Validacao de entrada com `class-validator`
- Auditoria de eventos relevantes de autenticacao
- Swagger opcional por ambiente
- Envelope de erro padronizado em PT-BR

## Endpoints Principais

### Autenticacao

- `POST /v1/auth/register`: cria uma conta
- `POST /v1/auth/verify-email`: confirma o e-mail da conta
- `POST /v1/auth/resend-verification`: reenvia verificacao
- `POST /v1/auth/login`: autentica e devolve tokens
- `POST /v1/auth/refresh`: rotaciona refresh token
- `POST /v1/auth/logout`: revoga refresh token ativo
- `POST /v1/auth/forgot-password`: inicia redefinicao de senha
- `POST /v1/auth/reset-password`: conclui redefinicao de senha
- `GET /v1/auth/me`: retorna payload autenticado

O `register`, `login`, `reset-password`, `refresh` e `logout` aceitam aliases do contrato PT-BR.

### Usuarios

- `GET /v1/usuarios/me`: perfil autenticado no contrato PT-BR
- `PUT /v1/usuarios/me`: atualiza perfil usando `nome`, `telefone`, `avatar_url`, `perfil`
- `DELETE /v1/usuarios/me`: solicita exclusao da conta
- `GET /v1/usuarios/:id/avaliacoes`: lista avaliacoes publicas

Aliases tecnicos equivalentes:

- `GET /v1/users/me`
- `PUT /v1/users/me`
- `DELETE /v1/users/me`

### Avaliacoes

- `POST /v1/avaliacoes`: cria avaliacao autenticada
- `GET /v1/avaliacoes/:usuarioId`: lista avaliacoes publicas de um usuario
- `GET /v1/usuarios/:id/avaliacoes`: alias do contrato PT-BR

### Anuncios

- `GET /v1/anuncios`: lista anuncios no contrato PT-BR
- `GET /v1/anuncios/:id`: detalhe publico
- `GET /v1/anuncios/me`: anuncios do usuario autenticado
- `POST /v1/anuncios`: cria anuncio usando payload PT-BR
- `PUT /v1/anuncios/:id`: edita anuncio proprio
- `DELETE /v1/anuncios/:id`: remove anuncio proprio
- `POST /v1/anuncios/:id/fotos`: adiciona foto por URL ou `multipart/form-data`
- `DELETE /v1/anuncios/:id/fotos/:fotoId`: remove foto

Aliases tecnicos equivalentes:

- `GET /v1/listings`
- `GET /v1/listings/:id`
- `GET /v1/listings/me`
- `POST /v1/listings`
- `PUT /v1/listings/:id`
- `DELETE /v1/listings/:id`
- `POST /v1/listings/:id/photos`
- `DELETE /v1/listings/:id/photos/:photoId`

### Conversas

- `GET /v1/conversas`: lista conversas do usuario autenticado
- `POST /v1/conversas`: cria ou reabre conversa a partir de `anuncio_id`
- `GET /v1/conversas/:id/mensagens`: lista mensagens
- `POST /v1/conversas/:id/mensagens`: envia mensagem
- `WS /v1/ws?token=ACCESS_TOKEN`: canal em tempo real para novas mensagens

## Exemplos do Contrato PT-BR

### Cadastro

```json
{
  "nome": "Joao Silva",
  "email": "joao@email.com",
  "senha": "Senha@Segura123",
  "telefone": "65999990000",
  "perfil": "anunciante",
  "cpf_cnpj": "52998224725",
  "aceite_termos": true,
  "aceite_privacidade": true
}
```

Resposta inclui os campos historicos e aliases PT-BR:

```json
{
  "id": "uuid-v4",
  "message": "Cadastro realizado. Confirme o e-mail antes de acessar a plataforma.",
  "nome": "Joao Silva",
  "email": "joao@email.com",
  "perfil": "anunciante",
  "role": "USER",
  "criado_em": "2026-03-27T10:00:00.000Z"
}
```

### Login

```json
{
  "email": "joao@email.com",
  "senha": "Senha@Segura123"
}
```

Resposta devolve `camelCase` e `snake_case`:

```json
{
  "usuario": {
    "id": "uuid-v4",
    "nome": "Joao Silva",
    "email": "joao@email.com",
    "perfil": "anunciante"
  },
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "access_token": "jwt",
  "refresh_token": "jwt",
  "token_type": "Bearer",
  "expira_em": 900
}
```

### Criar Anuncio

```json
{
  "titulo": "Trator John Deere 6110J - Seminovo 2022",
  "tipo_maquina": "trator",
  "marca": "John Deere",
  "modelo": "6110J",
  "ano_fabricacao": 2022,
  "condicao": "seminova",
  "preco": 320000,
  "descricao": "Trator em otimo estado, revisado e pronto para safra.",
  "horimetro_horas": 1200,
  "potencia_cv": 110,
  "acessorios": ["cabine", "ar_condicionado", "GPS"],
  "foto_capa": "https://cdn.mercadoagro.com.br/fotos/capa.jpg",
  "localizacao": {
    "cidade": "Balsas",
    "estado": "MA",
    "lat": -7.5321,
    "lng": -46.0323
  }
}
```

### Listar Anuncios

```http
GET /v1/anuncios?tipo_maquina=trator&condicao=seminova&preco_min=50000&page=1&per_page=20
```

Resposta:

```json
{
  "data": [
    {
      "id": "uuid-v4",
      "titulo": "Trator John Deere 6110J - Seminovo 2022",
      "tipo_maquina": "trator",
      "condicao": "seminova",
      "preco": 320000,
      "destaque": false,
      "foto_capa": "https://cdn.mercadoagro.com.br/fotos/capa.jpg",
      "localizacao": {
        "cidade": "Balsas",
        "estado": "MA"
      },
      "anunciante": {
        "id": "uuid-v4",
        "nome": "Joao Silva",
        "foto_url": null,
        "nota_media": null
      },
      "criado_em": "2026-03-27T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "per_page": 20,
    "pages": 1
  }
}
```

### Upload de Foto

Por URL:

```json
{
  "foto_url": "https://cdn.mercadoagro.com.br/fotos/trator-1.jpg",
  "ordem": 1
}
```

Ou por multipart:

```http
POST /v1/anuncios/{id}/fotos
Content-Type: multipart/form-data

foto=<arquivo jpg/png/webp>
ordem=1
```

O upload multipart salva em `uploads/` e retorna uma URL publica. Em Render, esse disco e efemero; para producao, configure storage persistente como S3, R2 ou equivalente.

### Avaliar Usuario

```json
{
  "avaliado_id": "uuid-do-anunciante",
  "anuncio_id": "uuid-do-anuncio",
  "nota": 5,
  "comentario": "Negociacao transparente e maquina conforme anunciado."
}
```

### Conversa e Mensagem

```json
{
  "anuncio_id": "uuid-do-anuncio",
  "mensagem_inicial": "Ola, a maquina ainda esta disponivel?"
}
```

Mensagem por WebSocket em `/v1/ws?token=ACCESS_TOKEN`:

```json
{
  "conversa_id": "uuid-da-conversa",
  "conteudo": "Tenho interesse. Podemos conversar?"
}
```

### Erro Padronizado

```json
{
  "erro": "VALIDATION_ERROR",
  "mensagem": "email must be an email",
  "status": 400,
  "timestamp": "2026-05-15T12:00:00.000Z",
  "path": "/v1/auth/register",
  "detalhes": ["email must be an email"]
}
```

## Segurança Implementada

- Hash de senha com `Argon2id`
- Access token curto e refresh token rotativo
- Revogacao de refresh token e deteccao de reuso
- Login exige e-mail verificado
- Validacao real de CPF/CNPJ
- Validacao global com whitelist e bloqueio de campos desconhecidos
- Consultas via Prisma, evitando SQL manual concatenado
- Rate limiting com Redis opcional e fallback em memoria
- Health check publico simples e readiness detalhado protegido por `ADMIN`
- Swagger desativavel por `SWAGGER_ENABLED`
- Envelope de erro padronizado nos 4xx/5xx
- Escapamento de HTML nos e-mails
- `npm audit` zerado

## Variaveis de Ambiente

Consulte `.env.example`. Pontos importantes:

- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` precisam ter 32+ caracteres
- `SWAGGER_ENABLED=false` recomendado em producao
- `REDIS_ENABLED=true` recomendado em producao com `REDIS_URL`
- `MAIL_DRIVER=smtp` exige `SMTP_HOST`, `SMTP_USER` e `SMTP_PASS`
- `GEO_CANDIDATE_LIMIT` limita o custo da busca geografica em memoria
- `UPLOAD_MAX_BYTES` define o tamanho maximo por imagem multipart
- `UPLOAD_PUBLIC_BASE_URL` pode fixar a URL publica das imagens enviadas
- `TERMS_VERSION` registra a versao aceita no cadastro

## Deploy

O projeto esta preparado para Render + Neon.

Comandos principais:

```bash
npm install
npm run build
npm run prisma:migrate:deploy
npm start
```

No Render, use:

- Build command: `npm install && npm run build`
- Start command: `npm run prisma:migrate:deploy && npm start`
- Health check path: `/v1/health`

## Qualidade

Comandos locais:

```bash
npm run typecheck
npm test
npx prisma validate
npm audit --omit=dev --audit-level=moderate
```

Tambem ha workflow de CI em `.github/workflows/ci.yml`.

## Escopo Ainda Fora do MVP

O contrato inicial em PDF tambem previa:

- Modulo de impulsionamento/destaque
- Storage persistente/CDN para substituir o upload local em disco
- Job de anonimizacao LGPD apos solicitacao de exclusao
- Canal formal para titulares de dados e documentacao de DPO

Esses itens seguem como evolucao do produto.
