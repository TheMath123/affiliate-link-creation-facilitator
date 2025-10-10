# Affiliate Link Creation Facilitator – Arquitetura e Fluxos

## Objetivo do sistema

Automatizar a coleta de informações de produtos de marketplaces (Mercado Livre, AliExpress e Shopee) para acelerar a produção de páginas e materiais de afiliados. O sistema entrega título, descrição, imagens, preço e impostos estimados em uma interface única, replicável e centrada na experiência do afiliado.

## Visão macro da arquitetura

```
[Interface React] --(form submit)--> [Server Action scrapeProduct]
  |                                   |
  |                                   v
  |                            [/api/scrape]
  |                                   |
  |                                   v
  |                          [lib/scrapers/index]
  |                                   |
  |            +----------------------+----------------+----------------+
  |            v                                       v                v
  |   [lib/scrapers/mercado-livre]          [lib/scrapers/aliexpress]  [lib/scrapers/shopee]
  |                                   |
  |                                   v
  |                           [lib/ai/gemini]
  |                                   |
  |                                   v
[ProductResult + History] <--(payload)-- [Gemini Structured Output]
```

- **Camada de apresentação:** componentes React com Tailwind e Radix UI controlam o formulário, resultados e histórico.
- **Camada de orquestração:** server action (`src/actions/scraper.ts`) intermediando chamadas da UI para a API interna.
- **Camada de API:** rota `POST /api/scrape` valida entrada, lida com erros e delega para os scrapers.
- **Camada de scraping:** módulos especializados por marketplace obtêm o HTML com `fetch` e delegam a extração para Gemini.
- **Persistência local:** histórico de consultas em `localStorage` para facilitar reuso de produtos.

## Fluxos principais

### 1. Extração de produto

1. Usuário submete URL no `ScraperForm` (`src/components/scraper-form.tsx`).
2. Server action `scrapeProduct` (`src/actions/scraper.ts`) monta uma requisição HTTP para `APP_URL/api/scrape`.
3. Rota `POST /api/scrape` (`src/app/api/scrape/route.ts`):
   - Garante que o corpo contenha `url` válida.
   - Chama `scrapeProduct` da biblioteca (`src/lib/scrapers/index.ts`).
4. `src/lib/scrapers/index.ts` detecta a origem e delega para `mercado-livre.ts`, `aliexpress.ts` ou `shopee.ts`.
5. Scraper específico: realiza `fetch` com cabeçalhos que imitam navegadores reais, passa HTML e contexto para `extractProductWithGemini` (`src/lib/ai/gemini.ts`) e valida o JSON retornado.
6. Resposta retorna como `ScrapedProduct` (`src/types/product.ts`). A UI atualiza o estado e renderiza `ProductResult`.
7. Dados são persistidos em `localStorage` e emitido evento `history-updated` para sincronizar o componente `ScraperHistory`.

### 2. Histórico local

- `ScraperForm` salva até 10 itens recentes em `localStorage`.
- `ScraperHistory` lê os itens no `useEffect` inicial e reage a eventos `storage`/`history-updated`.
- Usuário pode selecionar item para rehidratar o formulário, abrir link original ou limpar/excluir registros.

## Contratos de dados

### ScrapedProduct (`src/types/product.ts`)

```ts
export interface ScrapedProduct {
  title: string;
  description?: string;
  price?: number | string;
  estimatedTax?: number | string;
  images: string[];
  url: string;
  source: "Mercado Livre" | "AliExpress" | "Shopee" | "Desconhecido";
}
```

- `price` e `estimatedTax` são opcionais e podem ser número ou string conforme disponibilidade do marketplace.
- `images` sempre retorna array (possivelmente vazio) com URLs absolutas.

### Resposta da API

- Sucesso: retorna `ScrapedProduct` em JSON.
- Erro: `{ error: string }` com códigos HTTP adequados (400 validação, 500 falhas internas).

## Detalhes dos scrapers

### Mercado Livre (`src/lib/scrapers/mercado-livre.ts`)

- Usa `User-Agent` de Chrome desktop e `Accept-Language` em pt-BR para capturar conteúdo localizado.
- Recupera o HTML bruto do produto e envia para o Gemini com instruções específicas para Mercado Livre.
- Recebe JSON estruturado, normaliza campos opcionais e delega a decisão de descrição/imagens ao modelo.
- Erros de rede ou de parsing do modelo são propagados como `Error`, tratados na camada de API.

### AliExpress (`src/lib/scrapers/aliexpress.ts`)

- Define cabeçalhos que simulam navegador e captura o HTML público do produto.
- Orienta o Gemini a focar em informações oficiais (título, preço, impostos, imagens de alta resolução).
- O JSON retornado é higienizado e validado antes de ser repassado à API.
- Continua resiliente a variações de markup, delegando ajustes ao modelo sem necessidade de atualizar seletores.

### Shopee (`src/lib/scrapers/shopee.ts`)

- Reproduz cabeçalhos de navegador e coleta o HTML da página de produto da Shopee Brasil.
- Instrui o Gemini a retornar título, descrição, imagens, preço e possíveis impostos como strings com símbolo de moeda.
- Implementa fallback local para preço/impostos usando metatags (`og:price:amount`, `product:tax:amount`) e trechos JSON embutidos.
- Normaliza moedas, preserva sinais e garante que o valor final seja exibido mesmo quando o modelo não encontrar campos.

### Módulo Gemini (`src/lib/ai/gemini.ts`)

- Singleton do `GoogleGenerativeAI` instanciado com `GEMINI_API_KEY`.
- Aplica prompt-base em português, exige retorno 100% JSON e limita o payload de HTML enviado.
- Faz pós-processamento: valida campos obrigatórios, deduplica imagens, garante fallback de URL.
- Lança erros explícitos quando o modelo não retorna JSON parseável ou omite dados essenciais (ex.: título).

## Camada de apresentação

- `HomeContent`: coordena formulário e histórico, controla produto selecionado.
- `ScraperForm`: formulário controlado, feedback com Sonner, salva histórico.
- `ProductResult`: renderiza título, descrição, imagens, botões de cópia (`navigator.clipboard`).
- `ImageGallery`: galeria com modal (Radix Dialog) e download direto das imagens.
- `ScraperHistory`: lista itens, permite selecionar, abrir ou excluir.
- UI base (`components/ui`): abstrações de botão, card, dialog, input e toasts.

## Configuração e variáveis de ambiente

- `APP_URL`: origem base usada pela server action para invocar `api/scrape`. Necessário em ambientes onde `fetch` do servidor precisa de URL absoluta (ex.: Vercel serverless).
- `GEMINI_API_KEY`: credencial obrigatória para o módulo `lib/ai/gemini.ts` consumir o modelo `gemini-1.5-flash` (ou outro definido em `GEMINI_MODEL`).
- `GEMINI_MODEL`: opcional, sobrescreve o nome do modelo usado pelo Gemini (default: `gemini-1.5-flash`).
- `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN`, `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL`: habilitam logging centralizado com Better Stack/Logtail.
- `env.ts` usa `@t3-oss/env-nextjs` + Zod para validação em build/runtime.

## Tratamento de erros e resiliência

- Validação de URL no endpoint antes de executar scraping.
- Try/catch nos scrapers: falha no `fetch` resulta em erro HTTP 500 com mensagem amigável.
- UI usa toasts para informar sucesso/erro e permanecer responsiva.
- Requisições bloqueiam formulário com spinner (`Loader2`) para prevenir múltiplas submissões.

## Observabilidade

- Integração opcional com Logtail via `@logtail/next` (ver `next.config.ts`).
- Falhas do Gemini propagam mensagens claras para o server action e viram HTTP 500 quando atingem a API.
- Usuário final recebe feedback visual imediato pelo Sonner.

## Limitações conhecidas

- Ausência de autenticação: qualquer usuário com acesso ao front-end pode disparar scrapers.
- Dependência de estrutura HTML dos marketplaces; mudanças significativas exigem ajustes.
- Histórico persistido apenas localmente, não há sincronização entre dispositivos.
- Falta suíte de testes automatizados (unitários e de integração).
- `price` e `estimatedTax` ainda podem chegar como strings não uniformes; normalização futura é desejável.

## Extensibilidade

1. **Novos marketplaces:** adicionar módulo em `src/lib/scrapers`, exportar função assíncrona e atualizar roteamento em `index.ts`.
2. **Normalização de preços:** introduzir helpers em `src/lib/utils.ts` para garantir formato monetário consistente.
3. **Persistência server-side:** substituir ou complementar `localStorage` com banco (ex.: Supabase) expondo API autenticada.
4. **Automação de QA:** criar testes com Playwright/Cypress para validar scraping end-to-end em ambientes controlados.

## Fluxo de deploy sugerido

1. Garantir variáveis no `.env.local` e `.env.production`.
2. `npm run lint` para assegurar conformidade com Biome.
3. `npm run build` para verificar emissão do Next.js.
4. Deploy via Vercel ou adaptado para infraestrutura própria (Next.js App Router).

## Glossário rápido

- **Scraper:** módulo que baixa e interpreta HTML para extrair dados estruturados.
- **Server Action:** função marcada com `"use server"` executada no lado servidor do Next.js.
- **Gemini:** família de modelos do Google utilizada para extrair dados estruturados a partir do HTML bruto.
- **Better Stack/Logtail:** plataforma SaaS de logging centralizado.

## Referências cruzadas

- README com instruções rápidas: `README.md`.
- Componentes React principais: `src/components/`.
- Scrapers por marketplace: `src/lib/scrapers/`.
- Rota API: `src/app/api/scrape/route.ts`.
- Tipos compartilhados: `src/types/product.ts`.
- Configuração Tailwind e PostCSS: `postcss.config.mjs`, estilos globais em `src/app/globals.css`.
