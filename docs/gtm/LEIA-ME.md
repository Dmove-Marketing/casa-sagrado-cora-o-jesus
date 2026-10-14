# GTM padrão Dmove para sites Astro (v2)

| Arquivo | Para quê |
|---|---|
| `GTM-modelo-dmove-astro-v2.json` | **O container.** Importar no GTM do cliente e preencher as constantes |
| `testar.mjs` | `npm run test:gtm`: testa o container contra o site, sem GTM e sem lead real |
| `gerar.mjs` | Regenera o JSON a partir do v1 (`node docs/gtm/gerar.mjs`). Só para quem mantém o modelo |
| `originais/` | v1 (BP Office, 12/10/2026), base do v2 |

O contrato com o site (o que o container lê e de onde) está em `docs/tracking-gtm.md`.

## O que tem no container

17 tags, 6 gatilhos, 27 variáveis.

| Conversão | Evento do site | Tags |
|---|---|---|
| **Lead** (primária) | `form_submit` (formulário ou popup do WhatsApp) | Google Ads Lead (Enhanced Conversions, `orderId` = event_id), Meta Lead (`eventID` = event_id, dedup com o CAPI), GA4 `generate_lead` (`form_source`, `form_id`, `tipo_evento`, UTMs) |
| **Contact** (secundária) | `whatsapp_click` com `click_type` `abrir_popup` ou `link_direto` | Google Ads Contact, Meta Contact |
| Só GA4 | `whatsapp_click` (todos), `form_start`, `form_error` | GA4 `whatsapp_click`, `form_start`, `form_error` |
| Navegação | Todas as páginas; 90% de rolagem | Google Tag (`send_page_view=false`), GA4 page_view, Meta PageView (com `external_id`), Remarketing, Vinculador; View Content no Ads, Meta e GA4 |

Microsoft Clarity vem **pausado**: ative se o cliente tiver projeto.

## Cliente novo

1. GTM do cliente → Administrador → **Importar contêiner** → `GTM-modelo-dmove-astro-v2.json`.
   - Container **novo e vazio**: qualquer opção.
   - Container que já tem o modelo antigo do WordPress: **Substituir** (overwrite). Apaga o que não está no arquivo: tags HTML de cookies, gatilhos "Form id contém…" e "DOM Pronto", variáveis "Conversão Otimizada". Exporte o container antes, como backup.
2. Em **Variáveis**, preencher as constantes:

   | Constante | Onde achar |
   |---|---|
   | `META - Pixel` | Gerenciador de Eventos → Fontes de dados |
   | `GA4 - ID da Métrica` | GA4 → Admin → Fluxos de dados → `G-…` |
   | `Google Ads - Id da Conversão` | Ads → Metas → Conversões → ação → Configurar tag → "ID da conversão" (só números) |
   | `Google Ads - Lead` / `Contact` / `ViewContent` | Mesma tela, "Rótulo da conversão" de cada ação |
   | `Microsoft Clarity - ID` | Clarity → Settings → Overview (opcional) |

3. Preview → checklist abaixo → **Publicar**.

Antes do import, rode `npm run test:gtm` no site: tem de terminar em "Tudo certo".

## Checklist no Preview / Tag Assistant

- [ ] Abrir o site com `?utm_source=teste&utm_campaign=teste&gclid=teste`: **um** page_view no GA4 DebugView; Meta PageView disparou.
- [ ] Rolar até 90%: View Content no Ads, Meta e GA4.
- [ ] Formulário: no `form_submit`, dispararam Ads Lead, Meta Lead e GA4 generate_lead. **Nenhuma tag** em "Envio de formulário".
- [ ] Aba Variáveis desse evento: `cJS - Email`, `cJS - Telefone` (+55…) e "Dados Fornecidos pelo Usuário" preenchidos.
- [ ] Abrir o popup do WhatsApp: `whatsapp_click` dispara Ads Contact, Meta Contact e GA4 whatsapp_click.
- [ ] Concluir o popup: `form_submit` com `form_source = whatsapp` dispara as 3 de Lead; PII é a do popup.
- [ ] "Continuar no WhatsApp": só GA4 whatsapp_click.
- [ ] Meta → Testar eventos: Lead do navegador e do servidor (n8n) com o mesmo `event_id`, marcado como **Deduplicado**.

Lead de teste vai ao n8n e ao CRM do cliente: avise o comercial antes.

## Nas plataformas

- **Google Ads:** Lead **primária**, contagem "Uma". Contact e View Content **secundárias**. Ativar Conversões otimizadas para leads (método: Gerenciador de tags). Se o volume de Lead for baixo demais para o lance aprender, Contact pode virar primária com valor bem menor que o Lead (ex.: 100 × 10).
- **GA4:** `generate_lead` como evento-chave. Dimensões personalizadas (escopo de evento): `form_source`, `form_id`, `tipo_evento`, `click_type`, `link_location`. Não importar `generate_lead` no Google Ads como primária (contaria duas vezes).
- **Meta / n8n:** o CAPI manda `Lead` com o `event_id` do payload, para todos os `form_id` (formulários e `form_whatsapp`), `action_source = website`, `em`/`ph` com hash, `external_id`, `fbc`/`fbp`. O n8n **não** manda `Contact`.

## Mudanças do v1 para o v2 (14/10/2026, validado no Elago)

- PII lida do formulário que enviou, pelo `data-form-id` + `name` canônico. O v1 só achava campos com `id="form-field-*"`, e muitos formulários não têm.
- Gatilho "whatsapp_click - Contact" filtra `click_type` `abrir_popup|link_direto`: o "Continuar no WhatsApp" de quem já virou Lead não conta como Contact.
- `tipo_evento` no GA4 generate_lead e no Meta Lead (`tipo_evento` e `content_category`).
- GA4 `form_start` e `form_error` (funil do formulário).
- Saíram os itens do BP Office (área do cliente, unidade, serviço) e o template "Unique Event ID", que não era usado.
