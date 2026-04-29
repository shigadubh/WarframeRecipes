# Documentação do Warframe Craft Tracker

```markdown
# 📋 WARFRAME CRAFT TRACKER — DOCUMENTAÇÃO DO USUÁRIO

---

## O QUE É ESTE APP?

O **Warframe Craft Tracker** é uma ferramenta que te ajuda a controlar
quais peças você tem no jogo Warframe e o que ainda falta para fabricar
seus itens favoritos.

Com ele você consegue:

- Ver todas as receitas fabricáveis do jogo
- Marcar quais componentes você já possui
- Saber exatamente quantas peças faltam para cada receita
- Registrar quais itens você já fabricou
- Salvar tudo na nuvem e acessar de qualquer computador

---

## COMO FUNCIONA O SALVAMENTO?

O app usa **três camadas de proteção** para não perder seus dados:

```
CAMADA 1 — Navegador (localStorage)
  Salva instantaneamente a cada alteração.
  Funciona mesmo sem internet.
  ⚠️ Pode ser perdido se você limpar os dados do navegador.

CAMADA 2 — Backup local automático (IndexedDB)
  Cria até 5 backups automáticos a cada 60 segundos.
  Mais robusto que o localStorage.
  Usado para recuperar dados se a camada 1 falhar.

CAMADA 3 — Nuvem (Supabase / PostgreSQL)
  Sincroniza seus dados com um banco de dados online.
  Permite acessar de qualquer dispositivo.
  Requer conexão com a internet.
```

### Ordem de carregamento ao abrir o app

```
1. Carrega dados locais (instantâneo)
2. Conecta ao banco online
3. Puxa dados mais recentes da nuvem
4. Atualiza a tela com os dados sincronizados
```

> 💡 Mesmo sem internet o app funciona normalmente.
>    Quando a conexão voltar, sincroniza automaticamente.

---

## TELA DE LOGIN

Ao abrir o app pela primeira vez você verá a tela de login.

```
┌─────────────────────────────┐
│  ◇ WARFRAME CRAFT TRACKER   │
│                             │
│    BEM-VINDO, TENNO         │
│                             │
│  [ Seu nome de Tenno...   ] │
│  [ PIN (opcional)         ] │
│                             │
│  [       ENTRAR           ] │
└─────────────────────────────┘
```

### Campo de nome
- Digite o nome que quiser usar (até 20 caracteres)
- Se já existir uma conta com esse nome, o app reconhece automaticamente
- Se for um nome novo, cria a conta na hora

### Campo de PIN (opcional)
- Aparece automaticamente após digitar o nome
- Se for conta nova: você cria um PIN de 4 dígitos para proteger
- Se for conta existente com PIN: você precisa digitar para entrar
- Se não quiser PIN: deixe em branco e clique em Entrar

> ⚠️ Guarde bem o seu PIN. Não há recuperação de PIN disponível.

---

## CABEÇALHO (HEADER)

O cabeçalho aparece sempre no topo da tela com informações importantes.

```
[ ☁️ SYNC ✓ ] [ 💾 SALVO ] [ API ✓ ] [ SEUNOOME ] [ 👤 ]
```

---

### 👤 Botão Trocar Usuário

Salva e faz backup de tudo antes de deslogar.
Abre a tela de login para entrar com outro nome.

---

### LEGENDAS DOS BADGES DE STATUS

---

#### ☁️ SYNC — Sincronização com o banco online

```
┌──────────────────┬────────────────────────────────────────────────┐
│ Badge            │ Significado                                    │
├──────────────────┼────────────────────────────────────────────────┤
│ ☁️ SYNC (cinza) │ App iniciado, aguardando login                 │
│ ⏳ SYNC (amarelo)│ Sincronizando com o banco agora (aguarde)      │
│ ☁️ SYNC ✓ (verde)│ Dados enviados/recebidos com sucesso           │
│ ❌ SYNC FALHOU   │ Erro ao sincronizar — tente o botão ☁️ manual  │
│ 📴 OFFLINE       │ Sem internet — dados locais sendo usados       │
│ ❌ SEM CONEXÃO   │ Sem internet durante o login                   │
└──────────────────┴────────────────────────────────────────────────┘
```

**Responde à pergunta:** *"Meu inventário está salvo no banco online?"*

---

#### 💾 SALVO — Save no navegador

```
┌──────────────────┬────────────────────────────────────────────────┐
│ Badge            │ Significado                                    │
├──────────────────┼────────────────────────────────────────────────┤
│ 💾 SALVO (verde) │ Dados salvos no navegador — tudo certo         │
│ ⚠️  (amarelo)    │ Inventário ainda vazio, nada para salvar       │
└──────────────────┴────────────────────────────────────────────────┘
```

**Responde à pergunta:** *"Meus dados estão salvos no meu navegador?"*

---

#### API ✓ / CACHE ✓ — Fonte das receitas

```
┌──────────────────┬────────────────────────────────────────────────┐
│ Badge            │ Significado                                    │
├──────────────────┼────────────────────────────────────────────────┤
│ API ✓ (verde)    │ Receitas baixadas agora da internet            │
│                  │ Dados mais atualizados disponíveis             │
├──────────────────┼────────────────────────────────────────────────┤
│ CACHE ✓ (verde)  │ Receitas carregadas do cache local             │
│                  │ Cache tem menos de 24 horas — ainda válido     │
│                  │ App carrega mais rápido por não baixar nada    │
├──────────────────┼────────────────────────────────────────────────┤
│ OFFLINE (amarelo)│ Sem internet e cache com mais de 24 horas      │
│                  │ Usando dados antigos — receitas podem estar    │
│                  │ desatualizadas. Clique 🔄 quando tiver internet│
├──────────────────┼────────────────────────────────────────────────┤
│ ERRO (vermelho)  │ Sem internet e sem cache salvo                 │
│                  │ Impossível carregar receitas — recarregue      │
└──────────────────┴────────────────────────────────────────────────┘
```

**Responde à pergunta:** *"De onde vieram as receitas do jogo?"*

> 💡 A diferença entre API e CACHE não muda nada na sua experiência.
>    Ambos significam que as receitas estão disponíveis corretamente.
>    O cache é atualizado automaticamente a cada 24 horas.

---

## ABA RECEITAS

A aba principal. Exibe todos os itens fabricáveis do Warframe com
o seu progresso atual baseado no que você tem no inventário.

---

### Barra de controles

```
[ 🔍 Buscar receita... ] [ Todas Categorias ▼ ] [ Todo Progresso ▼ ]
```

| Controle           | O que faz                                        |
|--------------------|--------------------------------------------------|
| 🔍 Busca           | Filtra receitas pelo nome (aguarda você parar de digitar) |
| Todas Categorias   | Filtra por tipo de item                          |
| Todo Progresso     | Filtra pelo seu progresso na receita             |

#### Opções do filtro de Categoria

```
Todas Categorias      → Mostra tudo
Warframe              → Apenas Warframes normais
Warframe Prime        → Apenas Warframes Prime
Arma Primária         → Rifles, escopetas, arcos...
Arma Primária Prime   → Versões Prime das armas primárias
Arma Secundária       → Pistolas, lançadores...
Arma Secundária Prime → Versões Prime das armas secundárias
Corpo a Corpo         → Espadas, machados, lanças...
Corpo a Corpo Prime   → Versões Prime corpo a corpo
Sentinela             → Companheiros robóticos
Archwing              → Asas para combate espacial
Companheiro           → Pets e kubrows
Necramech             → Mechas para a Zona de Guerra
```

#### Opções do filtro de Progresso

```
Todo Progresso  → Mostra todas as receitas
Completo        → Você tem todos os componentes
Parcial         → Tem pelo menos 1 componente mas não todos
Nenhum          → Não tem nenhum componente ainda
Fabricável      → Tem todos os componentes e pode fabricar agora
Fabricado       → Já marcou como fabricado
```

---

### Barra de estatísticas

```
[ 📋 Total ] [ ✅ Completas ] [ 🔶 Fabricáveis ] [ 🔨 Fabricados ] [ 🧩 Componentes ]
```

| Card             | O que mostra                                          |
|------------------|-------------------------------------------------------|
| 📋 Total         | Quantidade total de receitas no banco de dados        |
| ✅ Completas     | Receitas onde você tem 100% dos componentes           |
| 🔶 Fabricáveis   | Receitas prontas para fabricar agora                  |
| 🔨 Fabricados    | Itens que você já marcou como fabricado               |
| 🧩 Componentes   | Quantos componentes você tem do total possível        |

---

### Cards de receita

Cada receita aparece como um card com as seguintes informações:

```
┌───────────────────────────────────────────┐
│  Ash Prime              [ 🔨 ] [ Parcial ] │  ← Header
│  Warframe Prime                            │
├───────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░  (barra de progresso)│  ← Body
│                                            │
│  [✓ Blueprint] [✓ Neuroptics]             │
│  [  Chassis  ] [  Systems   ]             │
│                                     2/4   │
├───────────────────────────────────────────┤
│  Pode fabricar: 1x                        │  ← Footer
└───────────────────────────────────────────┘
```

#### Badge de progresso (canto superior direito do card)

```
┌──────────────┬────────────────────────────────────────────────────┐
│ Badge        │ Significado                                        │
├──────────────┼────────────────────────────────────────────────────┤
│ Completo     │ Você tem 100% dos componentes no inventário        │
│ (verde)      │                                                    │
├──────────────┼────────────────────────────────────────────────────┤
│ Parcial      │ Você tem pelo menos 1 componente mas não todos     │
│ (laranja)    │                                                    │
├──────────────┼────────────────────────────────────────────────────┤
│ Faltam todos │ Nenhum componente desta receita no inventário      │
│ (vermelho)   │                                                    │
├──────────────┼────────────────────────────────────────────────────┤
│ Fabricado    │ Você marcou este item como fabricado               │
│ (vermelho)   │ O card fica com opacidade reduzida e nome riscado  │
└──────────────┴────────────────────────────────────────────────────┘
```

#### Badge 🔨 (switch de fabricação)

```
┌─────────────────┬──────────────────────────────────────────────────┐
│ Estado          │ Ação ao clicar                                   │
├─────────────────┼──────────────────────────────────────────────────┤
│ 🔨 (cinza)      │ Marca como fabricado SE tiver todos componentes  │
│                 │ Remove 1 unidade de cada componente              │
│                 │ Pede confirmação antes de executar               │
├─────────────────┼──────────────────────────────────────────────────┤
│ 🔨 FABRICADO    │ Desmarca a fabricação                            │
│ (vermelho)      │ Devolve 1 unidade de cada componente             │
│                 │ Pede confirmação antes de executar               │
└─────────────────┴──────────────────────────────────────────────────┘
```

> ⚠️ Você só consegue marcar como fabricado se tiver
>    todos os componentes no inventário com quantidade ≥ 1.

#### Barra de progresso — cores

```
Verde  → 100% dos componentes reunidos (pode fabricar)
Dourado→ 100% de um item Prime (pode fabricar)
Laranja→ Tem alguns componentes mas não todos
Vermelho→ Nenhum componente ainda
```

#### Tags de componentes no card

```
[ ✓ Blueprint ]  → Verde com check: você TEM este componente
[   Chassis   ]  → Cinza sem check: você NÃO TEM este componente
[   +3        ]  → Se tiver muitos componentes, agrupa o restante
```

#### Rodapé do card

```
Pode fabricar: 2x → Você tem componentes suficientes para 2 fabricações
                    (aparece quando qty de cada componente ≥ 1)
```

---

### Modal de detalhes da receita

Ao clicar em qualquer card, abre o modal com detalhes completos.

```
┌─────────────────────────────────────────┐
│  Ash Prime                          ✕   │
├─────────────────────────────────────────┤
│  WARFRAME PRIME                         │
│                                         │
│  ████████████░░░░░░  2/4                │
│                                         │
│  ✓ Ash Prime Blueprint  [2 no inv.][Remover]  │
│  ✓ Ash Prime Neuroptics [1 no inv.][Remover]  │
│  ✗ Ash Prime Chassis    [Faltando] [Adicionar]│
│  ✗ Ash Prime Systems    [Faltando] [Adicionar]│
│                                         │
│  ┌─ 🔒 COMPONENTES FALTANDO ──────────┐ │
│  │ Adicione todos para fabricar.      │ │
│  └────────────────────────────────────┘ │
│                                         │
│               📖 Wiki                   │
└─────────────────────────────────────────┘
```

#### Botões de cada componente

| Botão      | Cor     | O que faz                              |
|------------|---------|----------------------------------------|
| Adicionar  | Azul    | Adiciona 1 unidade ao inventário       |
| Remover    | Vermelho| Remove 1 unidade do inventário         |

#### Seção de fabricação (parte de baixo do modal)

```
┌──────────────────────────┬─────────────────────────────────────────┐
│ Estado                   │ O que aparece                           │
├──────────────────────────┼─────────────────────────────────────────┤
│ 🔒 COMPONENTES FALTANDO  │ Texto informando para adicionar itens   │
│ (fundo padrão)           │                                         │
├──────────────────────────┼─────────────────────────────────────────┤
│ ⚡ PRONTO PARA FABRICAR  │ Botão verde [🔨 FABRICAR]               │
│ (borda verde)            │ Mostra quantas fabricações possíveis    │
├──────────────────────────┼─────────────────────────────────────────┤
│ 🔨 FABRICADO             │ Data e hora da fabricação               │
│ (fundo vermelho escuro)  │ Botão [↩️ DESFAZER FABRICAÇÃO]          │
└──────────────────────────┴─────────────────────────────────────────┘
```

| Botão                  | O que faz                                        |
|------------------------|--------------------------------------------------|
| 🔨 FABRICAR            | Remove 1 de cada componente e marca fabricado    |
| ↩️ DESFAZER FABRICAÇÃO | Devolve 1 de cada componente e desmarca          |
| 📖 Wiki               | Abre a página do item na Warframe Wiki           |

---

## ABA INVENTÁRIO

Mostra todos os componentes que você adicionou com suas quantidades.

---

### Barra de controles

```
[ 🔍 Buscar item... ] [ ➕ ADICIONAR ITEM ] [ 💾 ] [ 🔄 ] [ ☁️ ]
```

| Botão          | O que faz                                              |
|----------------|--------------------------------------------------------|
| 🔍 Busca       | Filtra itens pelo nome ou receita (com debounce)       |
| ➕ ADICIONAR   | Abre lista de todos os componentes do jogo             |
| 💾             | Abre modal de Backup, Export e Import                  |
| 🔄             | Força download das receitas mais recentes da API       |
| ☁️             | Força sincronização manual com o banco online          |

---

### Barra de estatísticas

```
[ 📦 Itens Únicos ] [ 🔢 Total Peças ] [ 💾 Último Save ]
```

| Card           | O que mostra                                           |
|----------------|--------------------------------------------------------|
| 📦 Itens Únicos| Quantidade de componentes diferentes no inventário     |
| 🔢 Total Peças | Soma de todas as quantidades (ex: 3 Blueprint + 2 Chassis = 5) |
| 💾 Último Save | Há quanto tempo foi o último save local                |

---

### Lista de itens

Cada item do inventário aparece assim:

```
┌────────────────────────────────────────────────────────┐
│  Ash Prime Blueprint           [−] [ 2 ] [+]  [ ✗ ]   │
│  📦 Ash Prime                                          │
│  Receita: Ash Prime                                    │
└────────────────────────────────────────────────────────┘
```

| Elemento       | O que é                                                |
|----------------|--------------------------------------------------------|
| Nome           | Nome completo do componente                            |
| 📦 Receita pai | A qual item esse componente pertence                   |
| Receita        | Em qual receita esse componente é usado                |
| −              | Remove 1 unidade (se chegar a 0, remove o item)        |
| Número central | Quantidade atual no inventário                         |
| +              | Adiciona 1 unidade                                     |
| ✗              | Remove o item completamente do inventário              |

---

### Modal Adicionar Item

Aparece ao clicar em ➕ ADICIONAR ITEM.

```
┌─────────────────────────────────────────┐
│  ADICIONAR ITEM                     ✕   │
├─────────────────────────────────────────┤
│  [ 🔍 Buscar componente...           ]  │
│                                         │
│  Ash Prime Blueprint                    │
│  📦 Ash Prime              [Adicionar]  │
│                                         │
│  Ash Prime Chassis          (x2)        │
│  📦 Ash Prime              [ Remover ]  │
│                                         │
│  ...                                    │
│                                         │
│  Mostrando 80 de 1240. Refine a busca. │
└─────────────────────────────────────────┘
```

| Elemento                 | Significa                                      |
|--------------------------|------------------------------------------------|
| Item com fundo normal    | Você NÃO tem esse componente                   |
| Item com fundo verde     | Você JÁ TEM esse componente (mostra quantidade)|
| Botão [Adicionar] azul   | Coloca 1 unidade no inventário                 |
| Botão [Remover] vermelho | Tira do inventário                             |
| "(x2)" ao lado do nome   | Você já tem 2 unidades desse componente        |

> 💡 A busca funciona pelo nome do componente OU pelo nome da receita pai.
>    Exemplo: buscar "Ash" mostra todos os componentes do Ash e Ash Prime.

---

### Modal Dados & Backup

Aparece ao clicar em 💾.

```
┌─────────────────────────────────────────┐
│  DADOS & BACKUP                     ✕   │
├─────────────────────────────────────────┤
│  📊 STATUS                              │
│  Usuário: TENNO                         │
│  Itens: 12 | Fabricados: 3             │
│  Save local: Agora                      │
│  Último sync nuvem: 2min atrás          │
│  Backups locais: 3/5                    │
│─────────────────────────────────────────│
│  EXPORTAR                               │
│  [ { "user": "tenno", ... }           ] │
│  [ 📋 COPIAR ]                          │
│─────────────────────────────────────────│
│  IMPORTAR                               │
│  [ Cole aqui...                       ] │
│  [ ⬆️ IMPORTAR ]                        │
│─────────────────────────────────────────│
│  RESTAURAR BACKUP                       │
│  [#1 — Agora (12 itens)]               │
│  [#2 — 2h atrás (10 itens)]            │
└─────────────────────────────────────────┘
```

| Seção            | O que faz                                           |
|------------------|-----------------------------------------------------|
| STATUS           | Resumo dos seus dados e quando foi sincronizado     |
| EXPORTAR + COPIAR| Gera um JSON com todo seu inventário para backup    |
| IMPORTAR         | Cole um JSON exportado antes para restaurar dados   |
| RESTAURAR BACKUP | Clique em um backup para voltar ao estado daquele momento |

> ⚠️ IMPORTAR sobrescreve seu inventário atual.
>    O sistema cria um backup automático antes de importar.

> ⚠️ RESTAURAR BACKUP também sobrescreve o inventário atual.
>    Útil para desfazer uma importação errada.

---

## ATALHOS DE TECLADO

| Atalho    | O que faz                                           |
|-----------|-----------------------------------------------------|
| Ctrl + S  | Salva localmente + cria backup + sincroniza com nuvem |
| Esc       | Fecha qualquer modal aberto                         |

---

## DICAS DE USO

```
1. USE A BUSCA COM O NOME DO WARFRAME
   Ao buscar "Ash" na aba de receitas você vê todas as receitas
   relacionadas: Ash e Ash Prime.

2. FILTRE POR "FABRICÁVEL" PARA PRIORIZAR
   Mostra só os itens que você já tem todas as peças.
   Ideal para decidir o que fabricar primeiro.

3. USE O MODAL DE DETALHES PARA ADICIONAR PEÇAS
   Ao clicar em uma receita, você pode clicar em [Adicionar]
   ao lado de cada componente — mais rápido do que ir no inventário.

4. O CONTADOR "PODE FABRICAR: Nx" É IMPORTANTE
   Se aparecer "Pode fabricar: 3x" significa que você tem
   3 unidades de cada componente — pode fabricar 3 vezes.

5. FAÇA EXPORT REGULARMENTE
   Mesmo com o sync automático, ter um backup em JSON
   é uma segurança extra. Cole em um arquivo de texto.

6. O APP FUNCIONA SEM INTERNET
   Todos os dados ficam salvos no seu navegador.
   O sync com a nuvem acontece automaticamente quando
   a internet voltar.
```

---

## PERGUNTAS FREQUENTES

**P: Perco meus dados se fechar o navegador?**
R: Não. Os dados são salvos automaticamente no navegador
   e na nuvem. Fechar o navegador não apaga nada.

**P: Posso usar em outro computador?**
R: Sim. Entre com o mesmo nome de usuário e PIN.
   O app puxa seus dados da nuvem automaticamente.

**P: O que acontece se eu limpar os dados do navegador?**
R: Os dados locais são apagados, mas a nuvem mantém tudo.
   Basta entrar novamente com seu nome e PIN.

**P: As receitas são atualizadas automaticamente?**
R: Sim. O cache dura 24 horas. Após isso, na próxima vez
   que abrir o app, ele baixa as receitas mais recentes.
   Você também pode forçar a atualização com o botão 🔄.

**P: Por que aparece CACHE ✓ em vez de API ✓?**
R: Significa que as receitas foram carregadas do cache local
   (menos de 24h). É mais rápido e funciona sem internet.
   Não há diferença para o usuário — tudo funciona igual.

**P: Posso ter mais de um usuário?**
R: Sim. Cada nome de usuário tem seu próprio inventário
   separado. Use o botão 👤 para trocar de usuário.

**P: O PIN é obrigatório?**
R: Não. Mas é recomendado para proteger sua conta caso
   outra pessoa tente entrar com o mesmo nome.

---

*Warframe Craft Tracker — Feito pela comunidade, para a comunidade*
*Este projeto não é afiliado à Digital Extremes.*
```
