# Padrão de Home de Triagem

Quando um cliente tem **mais de um funil** (ex.: casamentos + corporativo + debutantes), a página raiz (`/`) não é uma landing page completa — é uma **home de triagem**: uma página leve cujo único trabalho é descobrir o **tipo de evento** do visitante e **direcioná-lo para a LP certa**.

> Referência viva: `eventos.afrikanhouse.com.br` (repo `Dmove-Marketing/afrikan-house`), onde a home pergunta "Você procura um espaço para qual tipo de evento?" e oferece Casamento / Debutante / Corporativo, cada um com botão para a LP do funil.

---

## Quando usar

- **Cliente com 2+ funis** → home de triagem em `/`, e cada funil na sua LP (`/casamentos`, `/eventos-corporativos`, …).
- **Cliente com 1 funil só** → não precisa de home; a LP fica em `/` (ou a raiz redireciona pra ela, como está hoje no Casa Kefren).

## Objetivo

- **Roteamento:** levar o visitante à LP do funil certo com 1 clique.
- **Qualificação e tracking por funil:** saber por qual porta o tráfego entra (medir o clique em cada card).
- **Menos atrito:** a captação (formulário) acontece na LP do funil, não na home.

---

## Estrutura da página

1. **Logo** da marca (topo, imagem LCP → `priority`).
2. **Pergunta / headline:** "Você procura um espaço para qual tipo de evento?" (ou variação da marca).
3. **Grade de opções** — um card por funil, cada um com:
   - Imagem representativa do tipo de evento
   - Nome do tipo de evento (ex.: "Casamento")
   - CTA **"Solicitar orçamento"** → link para o **slug do funil**
4. **Rodapé:** copyright + "Desenvolvido por Dmove".

```
            [ LOGO ]
  Você procura um espaço para qual tipo de evento?

  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Casamento│  │Corporativo│ │Debutante │
  │ [imagem] │  │ [imagem] │  │ [imagem] │
  │ Solicitar│  │ Solicitar│  │ Solicitar│
  └──────────┘  └──────────┘  └──────────┘

        Desenvolvido por Dmove
```

---

## Regras do padrão (o "config de fundo")

- **Sem formulário na home.** A captação é nas LPs de cada funil.
- **`hideWhatsApp={true}`** — a home não exibe o widget de WhatsApp (é só roteador). *(Nota de implementação: o `Base.astro` do template precisa aceitar essa prop — ver abaixo.)*
- **Tracking ativo** (GTM injetado normalmente). **Meça o clique em cada card** com um evento de dataLayer (ex.: `escolha_funil` com o tipo), para saber a distribuição de interesse.
- **Cada card leva ao slug padrão** do funil (ver lista abaixo). Nada de link para site externo.
- **Leve e rápida** — é a primeira porta. Imagens dos cards otimizadas, LCP priorizado, pouco JS.
- **Imagens dos cards nomeadas por funil:** `card-casamentos_home`, `card-corporativo_home`, `card-debutante_home`, etc. (convenção já usada no afrikan).

## Slugs de destino (padrão)

`/casamentos` · `/eventos-corporativos` · `/eventos-corporativos-confraternizacoes` · `/debutantes` · `/aniversarios` · `/formaturas`

---

## Para quem cria o HTML no Claude Design

Monte a home como uma página curta:
- Logo + a pergunta + N cards (um por tipo de evento que o cliente atende).
- Cada card: imagem + nome do evento + botão "Solicitar orçamento".
- **O botão de cada card deve apontar para o slug do funil** (ex.: `href="/eventos-corporativos"`). Se não souber o slug, use o nome do evento e nós ajustamos.
- **Sem formulário, sem WhatsApp, sem GTM/analytics** no HTML (as regras gerais do Design Brief valem aqui também).
- Entregue as imagens dos cards nomeadas por tipo (`card-casamentos.jpg`, `card-corporativo.jpg`, …).

## Para a IA (implementação)

- A home é `src/pages/index.astro`, usando `<Base ... hideWhatsApp={true}>`.
- Os cards linkam para os slugs padrão dos funis existentes no projeto.
- Adicione um evento de dataLayer no clique de cada card (qual funil foi escolhido).
- Quando a home passar a existir, **remova o redirect temporário** `/` → `/<funil>` do `astro.config.mjs`.
- **Pré-requisito no template:** o `Base.astro` precisa aceitar a prop `hideWhatsApp` (renderizar o `WhatsAppWidget` só quando `!hideWhatsApp`). Se ainda não aceitar, adicione — é uma melhoria de template, não por projeto.
