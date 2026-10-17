# Minhas Músicas

Aplicativo instalável (PWA) para organizar playlists pessoais e arquivos de
áudio no celular ou computador. Sem configurar o Supabase, a biblioteca e os
arquivos importados ficam apenas no navegador/dispositivo. Com Supabase, playlists,
curtidas e arquivos de áudio autorizados podem ser sincronizados após o login.

## Publicar

O app é estático e pode ser servido por HTTPS em Vercel, Netlify, GitHub Pages ou
outro host estático. HTTPS (ou `localhost` durante o desenvolvimento) é necessário
para instalar o PWA e usar o service worker.

## Habilitar sincronização Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No SQL Editor do projeto, execute [supabase/schema.sql](./supabase/schema.sql).
   Isso cria a tabela com Row Level Security e o bucket privado de áudio.
3. Copie a Project URL e a chave **anon/public** em Project Settings → API e
   preencha `url` e `anonKey` em `supabase-config.js`.
   A chave anon é usada no navegador; nunca use nem publique a chave `service_role`.
4. Em Authentication → URL Configuration, configure o Site URL e os Redirect URLs
   para o domínio publicado e para `http://localhost` durante desenvolvimento.
5. Em Authentication → Providers, habilite Email. As configurações de confirmação
   de e-mail e senha são controladas pelo projeto Supabase.
6. Publique ou atualize o site. Crie uma conta no app; use a mesma conta nos dois
   dispositivos para sincronizar. Ao entrar, as playlists locais são enviadas para
   sua conta e a biblioteca da conta é carregada.

O bucket `music-files` é privado. O limite de upload configurado no schema é 40 MB
por arquivo. Se o projeto exigir outro limite, ajuste tanto o bucket no Supabase
quanto `MAX_AUDIO_BYTES` em `app.js`.

## Playlists e arquivos

- Cole links diretos de playlist, faixa, álbum ou vídeo do Spotify/YouTube. O app
  incorpora o player oficial quando o link é compatível. Conteúdo desses serviços
  requer internet e pode exigir uma conta do próprio serviço.
- Dentro de uma playlist, use **Adicionar link de música** para incluir links de
  faixas, vídeos ou playlists do YouTube/Spotify. Ao selecionar um item, o player
  oficial correspondente aparece na playlist.
- O app não extrai nem baixa áudio de links do Spotify ou YouTube. O botão de
  download só aparece para arquivos de áudio pessoais/importados.
- Sem login, arquivos de áudio são guardados no IndexedDB do navegador e não são
  sincronizados. Com login, arquivos são enviados ao bucket privado do Supabase.
- A instalação PWA mantém a interface disponível offline; streaming dos players e
  sincronização exigem conexão. Arquivos locais guardados no IndexedDB podem tocar
  offline no dispositivo onde foram importados.
- Cores, imagem de fundo, playlists e arquivos locais são específicos do navegador
  até o login. As imagens de fundo escolhidas no dispositivo ficam no armazenamento
  local e não são enviadas ao Supabase.

## Desenvolvimento local

Sirva a pasta do projeto em `http://localhost` usando um servidor estático. Abrir
`index.html` diretamente como `file://` não habilita PWA, autenticação ou storage.
As chaves Supabase preenchidas em `supabase-config.js` são públicas; proteja o
banco e o bucket com as políticas RLS do schema.
