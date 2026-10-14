# Tracking & GTM — contrato do site com o container padrão

O container padrão da Dmove para sites Astro é o **`docs/gtm/GTM-modelo-dmove-astro-v2.json`** (como importar: `docs/gtm/LEIA-ME.md`). Ele **lê sinais específicos do site**. Se o site não os produz, UTMs, Enhanced Conversions e dedup do CAPI chegam **vazios**: o GTM parece "não funcionar", mas o problema é o site não alimentá-lo. Este documento é o contrato. O `UTMCapture.astro`, o `forms.ts` e o `WhatsAppWidget.astro` deste template já cumprem tudo abaixo.

> O container antigo (`GTM-PKJ6HVMP`, feito para WordPress/Elementor) **não serve** para Astro: dispara o Lead no submit nativo **e** no `form_submit` (conta em dobro), regrava cookies por cima do site e deixa as Enhanced Conversions vazias.

## O que o GTM LÊ × o que o site DEVE produzir

| O GTM lê… | De onde | O site produz em… |
|---|---|---|
| `utm_source/medium/campaign/content/term` | **cookie** 1st-party | `UTMCapture` grava cookie (90d) |
| `gclid/gbraid/wbraid/fbclid/…` | cookie | `UTMCapture` grava cookie (90d) |
| `_external_id` | **cookie** 1st-party | `UTMCapture` gera UUID + grava (365d) |
| `event_id` (dedup Pixel × CAPI, `orderId` no Google Ads) | `window.__page_event_id` (reserva: `event_id` do dataLayer) | `UTMCapture` define UUID por pageview |
| E-mail, telefone, nome (Enhanced Conv., `form_source = form`) | `form[data-form-id="<form_id>"] [name=email\|telefone\|nome]`; reserva `#form-field-*` | campos com `name` canônico dentro do `<form data-form-id>` |
| E-mail, telefone, nome (`form_source = whatsapp`) | `[data-wa-form] [name="E-mail"\|"WhatsApp"\|"Nome"]` | `WhatsAppWidget` preenche o espelho antes do `form_submit` |
| Conversão **Lead** | dataLayer `form_submit` | `forms.ts` / `WhatsAppWidget` |
| Conversão **Contact** | dataLayer `whatsapp_click` com `click_type` `abrir_popup` ou `link_direto` | `WhatsAppWidget` (abrir o popup) |

## Por que COOKIE e não sessionStorage

O GTM lê UTM de cookie. Além disso, **cookie persiste** (90 dias): sobrevive a fechar a aba e voltar dias depois. `sessionStorage` morre com a aba e perde a atribuição.

## `event_id` e dedup Pixel × CAPI

`UTMCapture` gera um UUID por pageview em `window.__page_event_id` **e** o coloca no `dmove_tracking`. O Pixel (via GTM) usa `window.__page_event_id`; o `forms.ts`/`WhatsAppWidget` mandam o **mesmo** `event_id` no webhook (→ n8n → CAPI). Mesmo id nos dois lados = a Meta deduplica.

## dataLayer — eventos padrão (limpos, sem PII)

```js
// form_submit (form E WhatsApp — mesma estrutura) → Lead
{ event: 'form_submit', form_source: 'form' | 'whatsapp', form_id, project, tipo_evento, event_id }
// form_start:  { event:'form_start', form_source, form_id, project }
// form_error:  { event:'form_error', form_source, form_id, error }
// whatsapp_click → Contact (abrir_popup | link_direto); continuar_conversa só vai ao GA4
{ event: 'whatsapp_click', click_type: 'abrir_popup' | 'link_direto' | 'continuar_conversa', link_location, project }
// page_meta:   { event:'page_meta', page_path, ...utms, external_id, event_id }  (UTMCapture)
// escolha_funil (home de triagem): { event:'escolha_funil', funil }
```

Regras:
- **Nunca** PII no dataLayer: o GTM lê do DOM.
- Com redirect depois do envio, o `forms.ts` usa `eventCallback` (+ `setTimeout` de reserva) para o GTM disparar as tags antes de navegar. Siga o mesmo padrão em qualquer envio novo que navegue.
- Link para `wa.me` fora do widget (cards, botões): emita `whatsapp_click` com `click_type: 'link_direto'` e um `link_location` que identifique o botão.
- Não use o gatilho nativo "Envio de formulário" do GTM.

## QA de tracking (obrigatório antes do deploy)

`npm run test:gtm`: faz o build, sobe o preview e roda o container contra o site com Playwright, **sem GTM e sem lead real** (n8n e `wa.me` respondem por mock). Testa todo `form[data-form-id]` de todas as páginas e o popup do WhatsApp:
- `form_submit` sem PII e com `form_source`;
- e-mail, telefone (+55…) e nome lidos pelo container;
- `event_id` igual no GTM e no webhook;
- UTMs e `_external_id` lidos dos cookies;
- quais tags disparariam (Lead × Contact).

Tem de terminar em "Tudo certo". Para testar o container do cliente: `node docs/gtm/testar.mjs 4406 caminho/do/container.json`. Depois, validação no GTM Preview / Tag Assistant (checklist em `docs/gtm/LEIA-ME.md`). Lead de teste real no n8n só com o OK do usuário.

## Não capturado (limitações conhecidas)

- **Leads via WhatsApp direto** (`wa.me` sem passar pelo popup): sem PII, então sem Enhanced Conversions. Conta como Contact, não como Lead.
- Dois leads na mesma pageview (formulário + popup) saem com o mesmo `event_id`: a Meta deduplica o segundo.
