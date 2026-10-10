# Ampernet Frotas

SPA responsiva para demonstração e gestão operacional de frotas da Ampernet. O front-end usa HTML, CSS, Tailwind via CDN e JavaScript ES modules; não requer compilação.

## Identificação do usuário

Na primeira visita, informe somente o nome para abrir o painel. O nome fica salvo no `localStorage` deste navegador e aparece no painel e no perfil. Use o botão de perfil para sair e trocar o nome.

Este fluxo é apenas uma identificação visual local: não usa senha, e-mail ou confirmação, não valida a identidade e não constitui autenticação ou controle de acesso. Qualquer pessoa com acesso ao navegador pode informar um nome. Para dados corporativos compartilhados, implemente autenticação real e políticas RLS no Supabase antes de liberar acesso.

## Executar localmente

Como a aplicação usa módulos JavaScript, abra a pasta em um servidor HTTP local em vez de abrir `index.html` diretamente:

```powershell
python -m http.server 8000
```

Acesse `http://localhost:8000`. A frota, os motoristas, os abastecimentos e as manutenções começam vazios. Ao abrir esta versão, os cadastros locais da versão demonstrativa anterior são removidos. O nome da pessoa e os novos registros ficam no `localStorage` deste navegador.

## Módulos disponíveis

- Dashboard com indicadores, gráfico de custos dos seis meses, status da frota e atividades recentes.
- Veículos: cadastro, edição, exclusão, filtros, pesquisa e histórico de abastecimento/manutenção.
- Motoristas: cadastro e alertas de CNH vencida ou com vencimento em até 30 dias.
- Manutenção: ordens preventivas/corretivas, custos e próxima revisão por quilometragem.
- Abastecimento: lançamentos e cálculo da média de consumo usando a quilometragem e o abastecimento anterior do veículo.
- Relatórios por veículo, exportação CSV e impressão do navegador para salvar como PDF.
- Layout adaptável para desktop, tablet e celular.

A aplicação começa sem registros de demonstração e funciona sem Supabase. Os dados cadastrados ficam apenas neste navegador; não são enviados ao banco automaticamente.

## Supabase

1. Crie um projeto no Supabase e execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor.
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` em [`supabaseClient.js`](./supabaseClient.js). Use a chave `anon`/publishable, nunca a `service_role`.
3. Use `listVehicles`/`listDrivers`/`listMaintenance` para SELECT, `addVehicle`/`addDriver`/`addMaintenance` para INSERT e os métodos `update...` correspondentes para UPDATE.
4. Defina políticas RLS apropriadas à autenticação e aos usuários da sua organização antes de conectar dados corporativos. O schema habilita RLS e não cria políticas permissivas.

O cliente Supabase é carregado sob demanda por ES module via CDN quando uma dessas funções é chamada. A aplicação visual permanece em modo local por padrão; integrar a autenticação, carregar os dados remotos e substituir o armazenamento local requer políticas e decisões de acesso específicas do ambiente.

## Deploy na Vercel

Importe a pasta do projeto na Vercel ou execute `vercel` na raiz. É um site estático, sem etapa de build. `vercel.json` define URLs limpas sem redirecionamentos adicionais.

## Estrutura

```text
index.html             Estrutura da SPA e bibliotecas CDN
styles.css             Tema visual, componentes e responsividade
app.js                 Navegação, gráficos, formulários, dados e relatórios
supabaseClient.js      Cliente e exemplos assíncronos Supabase
supabase/schema.sql    Schema inicial para os módulos principais
vercel.json            Configuração de hospedagem estática
```
