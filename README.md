## Visão geral

Aplicação Next.js que facilita a criação de material para links de afiliado a partir de produtos do Mercado Livre, AliExpress e Shopee. A interface permite colar a URL de um produto, coleta metadados relevantes por meio de scraping e disponibiliza título, descrição e galeria de imagens preparados para reutilização.

- **Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Radix UI, Sonner, Biome.
- **Extração:** Gemini 1.5 Flash analisa o HTML bruto e retorna JSON estruturado.
- **Deploy alvo:** Vercel (ou qualquer plataforma compatível com Next.js App Router).
- **Público:** afiliados que precisam montar páginas rapidamente com informações confiáveis do produto original.

## Como funciona

1. Usuário informa a URL do produto (mercadolivre.com, aliexpress.com ou shopee.) no formulário principal.
2. O componente `ScraperForm` aciona a server action `scrapeProduct` (`src/actions/scraper.ts`).
3. A server action chama a rota interna `POST /api/scrape`, que valida a URL e delega para `src/lib/scrapers`.
4. O `scrapeProduct` da camada de biblioteca identifica a origem e aciona o scraper específico (`mercado-livre.ts`, `aliexpress.ts` ou `shopee.ts`).
5. Cada scraper faz `fetch` da página, envia o HTML para o Gemini e recebe JSON com título, descrição, imagens, preço e impostos.
6. A resposta é exibida em `ProductResult` e armazenada no histórico local (`localStorage`).

Mais detalhes sobre a arquitetura e os fluxos estão em `docs/architecture.md`.

## Execução local

```bash
npm install
cp .env.example .env.local # defina APP_URL, GEMINI_API_KEY e chaves da Better Stack
npm run dev
```

- A aplicação assume que `APP_URL` aponta para a origem onde o app está rodando (por exemplo `http://localhost:3000`).
- `GEMINI_API_KEY` habilita chamadas ao modelo da família Gemini para extração.
- `GEMINI_MODEL` (opcional) permite trocar o modelo padrão (`gemini-1.5-flash`).
- `NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN` e `NEXT_PUBLIC_BETTER_STACK_INGESTING_URL` são necessários quando o logging centralizado estiver habilitado (via `@logtail/next`).

## Scripts úteis

- `npm run dev`: inicia o servidor de desenvolvimento com Turbopack.
- `npm run build`: build de produção.
- `npm run start`: inicia a versão compilada.
- `npm run lint`: validação com Biome.
- `npm run format`: formatação automática.

## Testes e verificação

No momento o projeto não possui suíte automatizada; execute `npm run lint` antes de criar commits e valide manualmente os fluxos principais:

- Extração de produto do Mercado Livre, AliExpress e Shopee.
- Persistência e remoção no histórico local.
- Visualização e cópia de título/descrição/imagens.

## Estrutura de diretórios

```
src/
	actions/           # Server actions chamadas pela camada de UI
	app/               # App Router do Next.js (páginas, rota API)
	components/        # Componentes React (UI, formulário, histórico, galeria)
	lib/               # Scrapers específicos por origem e utilidades
	types/             # Definição de tipos compartilhados
```

Consulte `docs/architecture.md` para uma documentação aprofundada.
