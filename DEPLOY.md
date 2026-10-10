# Publicar Music Search Films no Vercel

## Antes de publicar

1. No Google Cloud, ative a **YouTube Data API v3** e crie uma chave nova.
2. Restrinja a chave à **YouTube Data API v3** em "Restrições de API". Como as
   chamadas são feitas pelo servidor Vercel, não use a restrição de site HTTP
   referrer nem uma restrição de endereço IP local.
3. A chave que estava anteriormente no JavaScript do navegador deve ser revogada
   no Google Cloud. Uma chave incluída no frontend fica pública e não deve ser
   reutilizada.

## Implantação

1. Envie este projeto para um repositório GitHub.
2. Em [vercel.com](https://vercel.com/), importe o repositório como um novo projeto.
   O Vercel publica `index.html`, `style.css` e `app.js` como site estático e
   detecta automaticamente a função em `api/youtube-search.js`.
3. Nas configurações do projeto, abra **Settings → Environment Variables** e crie:
   - Nome: `YOUTUBE_API_KEY`
   - Valor: a chave criada no Google Cloud.
   - Ambiente: Production (e Preview/Development se também for usar esses ambientes).
4. Salve e faça um novo deploy. A busca fica disponível no domínio `.vercel.app`
   atribuído ao projeto.
5. O site oferece instalação como PWA em navegadores compatíveis e mantém a
   interface disponível offline depois do primeiro carregamento. Instale pelo
   menu do navegador; a busca no YouTube e a reprodução de vídeos continuam
   precisando de conexão com a internet.
6. A lista de favoritas fica salva no armazenamento local do navegador. Os
   controles da tela de bloqueio dependem do suporte do navegador à Media
   Session API. O botão Picture-in-Picture usa a API Document Picture-in-Picture
   quando disponível; em navegadores incompatíveis, abra o vídeo no YouTube.

Não coloque a chave em `app.js`, `index.html`, no repositório ou em variáveis
prefixadas com `VITE_`/`NEXT_PUBLIC_`. O navegador chama `/api/youtube-search`;
a função serverless acrescenta a chave no servidor.

## Teste local

O Live Server serve apenas arquivos estáticos e não executa a função `/api`.
Para testar a aplicação localmente, instale/execute a CLI do Vercel, configure
`YOUTUBE_API_KEY` no ambiente local e rode `vercel dev` na pasta do projeto.

O Supabase não foi incluído: este site não precisa de banco de dados ou contas
de usuário para pesquisar e reproduzir vídeos.
