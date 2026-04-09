# MercadoAgro Mobile API

API RESTful do MercadoAgro voltada para consumo por aplicativo mobile. A aplicacao centraliza autenticacao, gestao de conta, publicacao de anuncios e consulta publica de itens do marketplace agro.

## Visao Geral

O backend foi estruturado para operar como uma API stateless, com autenticacao baseada em JWT, persistencia em PostgreSQL e documentacao OpenAPI. A proposta e atender um fluxo mobile-first em que o usuario consegue:

- criar uma conta
- confirmar o e-mail
- autenticar-se e renovar sessao
- consultar os proprios dados
- listar anuncios publicos
- publicar anuncios autenticado

O projeto tambem inclui trilhas de auditoria, rate limiting, validacao de entrada e health check para suporte a entrega academica e a operacao da API em ambiente online.

## O Que a API Faz

### Autenticacao e Conta

- `POST /v1/auth/register`: cria uma nova conta publica
- `POST /v1/auth/verify-email`: confirma o e-mail da conta
- `POST /v1/auth/resend-verification`: reenvia o fluxo de verificacao
- `POST /v1/auth/login`: autentica o usuario e retorna `access token` e `refresh token`
- `POST /v1/auth/refresh`: rotaciona o refresh token com protecao contra reutilizacao concorrente
- `POST /v1/auth/logout`: revoga um refresh token ativo
- `GET /v1/auth/me`: devolve o payload autenticado atual
- `GET /v1/users/me`: retorna os dados persistidos da conta autenticada

### Marketplace

- `GET /v1/listings`: lista anuncios publicos com paginacao e busca textual
- `POST /v1/listings`: cria um anuncio autenticado

### Operacao e Observabilidade

- `GET /v1/health`: verifica disponibilidade da aplicacao, banco, Redis e mail driver
- `GET /docs`: expoe a interface Swagger
- `GET /docs-json`: expoe o documento OpenAPI em JSON

## Regras de Negocio Atuais

- contas publicas sempre sao criadas com o papel `USER`
- o papel `ADMIN` permanece separado para acoes administrativas futuras
- o login exige e-mail verificado
- qualquer usuario autenticado pode publicar anuncios
- anuncios publicos sao retornados somente quando estao com status `PUBLISHED`

## Seguranca Implementada

- hash de senha com `Argon2id`
- `access token` de curta duracao e `refresh token` rotativo
- revogacao de refresh token com protecao contra corrida
- validacao de DTOs com `class-validator`
- consultas ao banco via `Prisma`, reduzindo risco de SQL injection por concatenacao manual
- rate limiting global e reforcado em rotas publicas
- auditoria de eventos relevantes de autenticacao
- tratamento explicito de IP do cliente para cenarios com proxy

## Arquitetura da Solucao

- API: `NestJS + Fastify`
- Banco de dados: `PostgreSQL` no `Neon`
- ORM: `Prisma`
- Cache e rate limit: `Redis` opcional, com fallback em memoria quando desativado
- Documentacao: `Swagger/OpenAPI`
- Hospedagem alvo: `Render`

## Implantacao Online

O projeto esta preparado para rodar online com:

- `Render` como web service da API
- `Neon` como banco PostgreSQL

## Estado Atual da API

Hoje a API esta preparada para operacao online com Render + Neon. O banco fica no Neon e a camada HTTP pode ser publicada como web service no Render, mantendo a aplicacao acessivel por URL publica para o app mobile e para demonstracao academica.

## Qualidade e Auditoria

O projeto inclui base para evidencias de auditoria tecnica:

- logs de auditoria para eventos importantes de autenticacao
- migrations versionadas
- validacoes de integridade de entrada
- testes automatizados cobrindo:
  - criacao de conta com papel publico unico
  - protecao contra reuso concorrente de refresh token
  - resolucao de IP do cliente para rate limit e auditoria

## Usuarios de Demonstracao

- `admin@mercadoagro.local`
- `user@mercadoagro.local`

As senhas dessas contas sao controladas pelas variaveis:

- `SEED_ADMIN_PASSWORD`
- `SEED_USER_PASSWORD`

## Estrutura do Projeto

```text
src/
  app.module.ts
  main.ts
  common/
  config/
  modules/
    auth/
    health/
    listings/
    mail/
    prisma/
    redis/
    users/
prisma/
  migrations/
  schema.prisma
  seed.ts
test/
  run.js
```
