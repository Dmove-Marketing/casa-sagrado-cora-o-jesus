// Gera o modelo de GTM da Dmove para sites Astro (v2), a partir do v1 (BP Office, 12/10/2026).
// v2 (14/10/2026, validado no Elago): PII lida do formulário pelo data-form-id, Contact só em abrir_popup/link_direto,
// tipo_evento nos Leads, GA4 form_start/form_error. Sem área do cliente/unidade/serviço (eram do BP).
// Uso: node docs/gtm/gerar.mjs  →  docs/gtm/GTM-modelo-dmove-astro-v2.json      Como usar: docs/gtm/LEIA-ME.md
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ler = (f) => JSON.parse(readFileSync(join(DIR, 'originais', f), 'utf8'));
const modelo = ler('GTM-modelo-dmove-astro-v1.json').containerVersion;
const cv = JSON.parse(JSON.stringify(modelo));
const FP = String(Date.UTC(2026, 9, 14));

// Placeholders: no cliente, troque as constantes no GTM depois do import (ou copie este script e preencha aqui).
const VALORES = {
  'META - Pixel': '0000000000000000',
  'GA4 - ID da Métrica': 'G-0000000000',
  'Google Ads - Id da Conversão': '0000000000',
  'Google Ads - Lead': '0000000000',
  'Google Ads - Contact': '0000000000',
  'Google Ads - ViewContent': '0000000000',
  'Microsoft Clarity - ID': '0000000000',
};

const T = (key, value) => ({ type: 'TEMPLATE', key, value: String(value) });
const B = (key, value) => ({ type: 'BOOLEAN', key, value: String(!!value) });
const I = (key, value) => ({ type: 'INTEGER', key, value: String(value) });
const linhas = (rows, k = 'parameter', v = 'parameterValue') => rows.map(([a, b]) => ({ type: 'MAP', map: [T(k, a), T(v, b)] }));
const setParam = (item, novo) => {
  const i = item.parameter.findIndex((p) => p.key === novo.key);
  if (i >= 0) item.parameter[i] = novo; else item.parameter.push(novo);
};
const tg = (nome) => cv.tag.find((t) => t.name === nome);
const vr = (nome) => cv.variable.find((v) => v.name === nome);
const tr = (nome) => cv.trigger.find((t) => t.name === nome);
const base = () => ({ accountId: modelo.accountId, containerId: modelo.containerId, fingerprint: FP });
const evento = (nome) => [{ type: 'EQUALS', parameter: [T('arg0', '{{_event}}'), T('arg1', nome)] }];
const dlv = (id, nome) => ({ ...base(), variableId: String(id), name: `dlv - ${nome}`, type: 'v', formatValue: {},
  parameter: [I('dataLayerVersion', 2), B('setDefaultValue', false), T('name', nome)] });
const ga4 = (id, nome, gatilho, evento_, params) => ({ ...base(), tagId: String(id), name: nome, type: 'gaawe',
  firingTriggerId: [gatilho], tagFiringOption: 'ONCE_PER_EVENT', monitoringMetadata: { type: 'MAP' }, consentSettings: { consentStatus: 'NOT_SET' },
  parameter: [B('sendEcommerceData', false), { type: 'LIST', key: 'eventSettingsTable', list: linhas(params) },
    T('eventName', evento_), T('measurementIdOverride', '{{GA4 - ID da Métrica}}')] });

// ---------- 1) O que não existe no Elago: Área do Cliente, unidade e serviço (são do BP) ----------
cv.tag = cv.tag.filter((t) => t.name !== '04 | GA4 | area_cliente_click');
cv.trigger = cv.trigger.filter((t) => t.name !== 'area_cliente_click');
cv.variable = cv.variable.filter((v) => !['dlv - unidade', 'dlv - servico'].includes(v.name));
for (const t of cv.tag) for (const p of t.parameter || []) if (p.type === 'LIST')
  p.list = p.list.filter((m) => !m.map?.some((x) => /\{\{dlv - (unidade|servico)\}\}/.test(x.value)));

// ---------- 2) Variáveis novas ----------
cv.variable.push(dlv(90, 'tipo_evento'), dlv(91, 'error'));

// PII pelo DOM do formulário que enviou. form → form[data-form-id="<form_id>"] [name=…] (vale para os 3 formulários
// do site: lead-form, bio e form-orcamento, que têm IDs de campo diferentes); whatsapp → espelho [data-wa-form].
const campo = (nomeForm, nomeWa) => `
    var src = {{dlv - form_source}};
    var el = null;
    if (src === 'whatsapp') {
      var wa = document.querySelector('[data-wa-form]');
      el = wa ? wa.querySelector('[name="${nomeWa}"]') : null;
    } else if (src === 'form') {
      var f = document.querySelector('form[data-form-id="' + {{dlv - form_id}} + '"]');
      el = (f && f.querySelector('[name="${nomeForm}"]')) || document.querySelector('#form-field-${nomeForm}');
    }
    var v = el && el.value ? String(el.value).replace(/\\s+/g, ' ').trim() : '';`;
const JS = {
  'cJS - First Name': `function() {
  // Primeiro nome, em minúsculas
  try {${campo('nome', 'Nome')}
    if (!v) return undefined;
    return v.split(' ')[0].toLowerCase();
  } catch (e) {}
  return undefined;
}`,
  'cJS - Last Name': `function() {
  // Sobrenome (tudo depois do primeiro nome), em minúsculas
  try {${campo('nome', 'Nome')}
    var partes = v ? v.split(' ') : [];
    if (partes.length < 2) return undefined;
    partes.shift();
    return partes.join(' ').toLowerCase();
  } catch (e) {}
  return undefined;
}`,
  'cJS - Telefone': `function() {
  // Telefone em E.164 (+55DDDNÚMERO): 10 ou 11 dígitos ganham o 55; 12-13 começando com 55 já têm DDI
  try {${campo('telefone', 'WhatsApp')}
    var d = v.replace(/\\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    else if (!((d.length === 12 || d.length === 13) && d.indexOf('55') === 0)) return undefined;
    return '+' + d;
  } catch (e) {}
  return undefined;
}`,
  'cJS - Email': `function() {
  // E-mail em minúsculas, validado
  try {${campo('email', 'E-mail')}
    v = v.toLowerCase();
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v) ? v : undefined;
  } catch (e) {}
  return undefined;
}`,
};
for (const [nome, js] of Object.entries(JS)) { setParam(vr(nome), T('javascript', js)); vr(nome).fingerprint = FP; }
for (const [nome, valor] of Object.entries(VALORES)) setParam(vr(nome), T('value', valor));

// ---------- 3) Gatilhos ----------
// Contact = só abrir o popup ou link direto ao wa.me. O "continuar_conversa" (botão depois do lead) vai só ao GA4.
const contact = { ...base(), triggerId: '92', name: 'whatsapp_click - Contact', type: 'CUSTOM_EVENT', customEventFilter: evento('whatsapp_click'),
  filter: [{ type: 'MATCH_REGEX', parameter: [T('arg0', '{{dlv - click_type}}'), T('arg1', '^(abrir_popup|link_direto)$')] }] };
cv.trigger.push(contact,
  { ...base(), triggerId: '93', name: 'form_start', type: 'CUSTOM_EVENT', customEventFilter: evento('form_start') },
  { ...base(), triggerId: '94', name: 'form_error', type: 'CUSTOM_EVENT', customEventFilter: evento('form_error') });
tg('03 | Google Ads | Contact').firingTriggerId = ['92'];
tg('03 | Meta | Contact').firingTriggerId = ['92'];
// "03 | GA4 | whatsapp_click" segue no gatilho whatsapp_click (todos os click_type)

// ---------- 4) Tipo de evento nos Leads (social x corporativo x leilão é o que separa os funis do Elago) ----------
const glTab = tg('02 | GA4 | generate_lead').parameter.find((p) => p.key === 'eventSettingsTable');
glTab.list.push(...linhas([['tipo_evento', '{{dlv - tipo_evento}}']]));
const mlTab = tg('02 | Meta | Lead').parameter.find((p) => p.key === 'objectPropertyList');
mlTab.list.push(...linhas([['tipo_evento', '{{dlv - tipo_evento}}']], 'name', 'value'));
mlTab.list.push(...linhas([['content_category', '{{dlv - tipo_evento}}']], 'name', 'value'));

// ---------- 5) Funil do formulário no GA4 (não são conversões) ----------
cv.tag.push(
  ga4(95, '04 | GA4 | form_start', '93', 'form_start', [['form_source', '{{dlv - form_source}}'], ['form_id', '{{dlv - form_id}}'], ['project', '{{dlv - project}}']]),
  ga4(96, '04 | GA4 | form_error', '94', 'form_error', [['form_source', '{{dlv - form_source}}'], ['form_id', '{{dlv - form_id}}'], ['error', '{{dlv - error}}']]),
);

// ---------- 6) Metadados: template do Pixel só (o Unique Event ID não é usado), sem pastas ----------
cv.customTemplate = cv.customTemplate.filter((c) => c.name === 'Facebook Pixel');
delete cv.folder;
Object.assign(cv, { fingerprint: FP });
cv.container = { ...cv.container, name: 'Modelo Dmove Astro v2' };

const n = (k) => (a, b) => Number(a[k]) - Number(b[k]);
cv.tag.sort(n('tagId')); cv.trigger.sort(n('triggerId')); cv.variable.sort(n('variableId'));

// ---------- checagens ----------
const idsTrig = new Set([...cv.trigger.map((t) => t.triggerId), '2147479553', '2147479573']);
const nomesVar = new Set([...cv.variable.map((v) => v.name), ...cv.builtInVariable.map((b) => b.name), '_event']);
for (const t of cv.tag) for (const id of t.firingTriggerId) if (!idsTrig.has(id)) throw new Error(`${t.name}: gatilho ${id} não existe`);
const refs = JSON.stringify([cv.tag, cv.variable, cv.trigger]).match(/\{\{[^}]+\}\}/g) || [];
for (const r of new Set(refs)) if (!nomesVar.has(r.slice(2, -2))) throw new Error(`variável ${r} não existe`);
const pend = Object.entries(VALORES).filter(([, v]) => /^(G-)?0+$/.test(v)).map(([k]) => k);

const out = join(DIR, 'GTM-modelo-dmove-astro-v2.json');
writeFileSync(out, JSON.stringify({ exportFormatVersion: 2, exportTime: '2026-10-14 12:00:00', containerVersion: cv }, null, 2) + '\n');
console.log(`ok: ${cv.tag.length} tags, ${cv.trigger.length} gatilhos, ${cv.variable.length} variáveis → GTM-modelo-dmove-astro-v2.json`);
if (pend.length) console.log('Constantes a preencher no cliente:', pend.join(', '));
