// Teste do container no site real (build + astro preview), sem GTM e sem lead real.
// Uso: npm run build && node docs/gtm/testar.mjs [porta] [container.json]
//   porta padrão 4406; container padrão docs/gtm/GTM-modelo-dmove-astro-v2.json (ou o JSON do cliente)
//   Testa todo form[data-form-id] de todas as páginas do dist/ e, se houver, o popup do WhatsApp.
// Playwright: usa o do site; se ele não tiver, aponte PLAYWRIGHT_DE para o package.json de um projeto que tenha.
// - Bloqueia GTM/GA/Ads/Meta/Clarity; o n8n e o wa.me respondem por mock: nenhum lead sai da máquina.
// - Um mini-avaliador reproduz o GTM: a cada evento do site calcula as variáveis (cJS/dlv/cookie/awec),
//   avalia os gatilhos CUSTOM_EVENT do container e lista as tags que disparariam.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE || join(DIR, '..', '..');
const { chromium } = createRequire(process.env.PLAYWRIGHT_DE || join(SITE, 'package.json'))('playwright');
const PORT = Number(process.argv[2] || 4406);
const BASE = `http://127.0.0.1:${PORT}`;
const cv = JSON.parse(readFileSync(process.argv[3] || join(DIR, 'GTM-modelo-dmove-astro-v2.json'), 'utf8')).containerVersion;

const p = (x, k) => x.parameter?.find((q) => q.key === k)?.value;
const defs = cv.variable.map((v) => ({ name: v.name, type: v.type, code: p(v, 'javascript'), key: p(v, 'name'), value: p(v, 'value'),
  awec: v.type === 'awec' ? { email: p(v, 'email'), phone_number: p(v, 'phone_number') } : null }));
const gatilhos = cv.trigger.filter((t) => t.type === 'CUSTOM_EVENT').map((t) => ({ id: t.triggerId, name: t.name,
  conds: [...(t.customEventFilter || []), ...(t.filter || [])].map((f) => ({ type: f.type, a: p(f, 'arg0'), b: p(f, 'arg1') })) }));
const tagsAtivas = cv.tag.filter((t) => !t.paused).map((t) => ({ name: t.name, fire: t.firingTriggerId }));

const preview = spawn(process.execPath, [join(SITE, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'preview', '--port', String(PORT), '--host', '127.0.0.1'], { cwd: SITE, stdio: 'ignore' });
const encerrar = () => { preview.kill(); try { execSync(`lsof -ti tcp:${PORT} | xargs kill 2>/dev/null`); } catch {} };
for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

let falhas = 0;
const check = (ok, msg) => { console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`); if (!ok) falhas++; };
const BLOQUEAR = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|google\.com\/(ccm|pagead)|facebook\.(com|net)|clarity\.ms/;
const browser = await chromium.launch();

async function abrir(url) {
  const ctx = await browser.newContext();
  const hooks = [], av = [];
  await ctx.route(BLOQUEAR, (r) => r.abort());
  await ctx.route(/cloudflare\.com\/cdn-cgi\/trace|ipify\.org/, (r) => r.abort());
  await ctx.route(/\/webhook(-test)?\//, (r) => { hooks.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, body: '{}' }); });
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 204, body: '' }));
  await ctx.exposeBinding('__gtmReport', (_s, json) => av.push(JSON.parse(json)));
  await ctx.addInitScript(({ defs, gatilhos, tagsAtivas }) => {
    const modelo = {};
    const byName = Object.fromEntries(defs.map((d) => [d.name, d]));
    const cookie = (n) => { const m = document.cookie.match('(^|;)\\s*' + n + '\\s*=\\s*([^;]+)'); return m ? decodeURIComponent(m.pop()) : undefined; };
    const valor = (nome) => {
      if (nome === '_event') return modelo.event;
      const d = byName[nome];
      if (!d) return undefined;
      if (d.type === 'v') return modelo[d.key];
      if (d.type === 'k') return cookie(d.key);
      if (d.type === 'c') return d.value;
      if (d.type === 'awec') return { email: tpl(d.awec.email), phone_number: tpl(d.awec.phone_number) };
      if (d.type === 'jsm') {
        const code = d.code.replace(/\{\{([^{}]+)\}\}/g, (_m, n) => `__v(${JSON.stringify(n)})`);
        return new Function('__v', `return (${code});`)(valor)();
      }
    };
    const tpl = (s) => { const m = /^\{\{([^{}]+)\}\}$/.exec(s || ''); return m ? valor(m[1]) : s; };
    const casa = (c) => { const a = String(tpl(c.a));
      return c.type === 'EQUALS' ? a === c.b : c.type === 'CONTAINS' ? a.includes(c.b) : c.type === 'MATCH_REGEX' ? new RegExp(c.b).test(a) : false; };
    let dl = window.dataLayer || [];
    const instalar = (arr) => {
      if (arr.__h) return arr; arr.__h = true;
      const orig = arr.push.bind(arr);
      arr.push = (...itens) => {
        for (const o of itens) {
          if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
          const { eventCallback, eventTimeout, ...resto } = o;
          Object.assign(modelo, resto);
          if (o.event && !String(o.event).startsWith('gtm.')) {
            const vars = {};
            for (const d of defs) if (['jsm', 'v', 'k', 'awec'].includes(d.type)) { try { vars[d.name] = valor(d.name); } catch (e) { vars[d.name] = 'ERRO ' + e.message; } }
            const ids = gatilhos.filter((g) => g.conds.every(casa)).map((g) => g.id);
            window.__gtmReport(JSON.stringify({ event: o.event, push: resto, vars, tags: tagsAtivas.filter((t) => t.fire.some((i) => ids.includes(i))).map((t) => t.name), pe: window.__page_event_id }));
          }
          if (typeof eventCallback === 'function') setTimeout(eventCallback, 50);
        }
        return orig(...itens);
      };
      return arr;
    };
    instalar(dl);
    Object.defineProperty(window, 'dataLayer', { get: () => dl, set: (v) => { dl = instalar(v); }, configurable: true });
  }, { defs, gatilhos, tagsAtivas });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }); // o load espera iframes externos (mapa)
  await page.waitForTimeout(500);
  return { ctx, page, hooks, av };
}
const ultimo = async (av, ev) => { for (let i = 0; i < 60; i++) { const a = av.filter((x) => x.event === ev).at(-1); if (a) return a; await new Promise((r) => setTimeout(r, 100)); } };
const LEAD = ['03 | Google Ads | Lead', '02 | Meta | Lead', '02 | GA4 | generate_lead'].sort().join();
const CONTACT = ['03 | Google Ads | Contact', '03 | Meta | Contact', '03 | GA4 | whatsapp_click'].sort().join();

async function formulario(url, formId, rotulo) {
  console.log(`\n${rotulo} (${url}, form ${formId})`);
  const { ctx, page, hooks, av } = await abrir(`${url}?utm_source=google&utm_campaign=teste-gtm&gclid=TESTE`);
  const f = `form[data-form-id="${formId}"]`;
  const tem = async (n) => (await page.locator(`${f} [name="${n}"]`).count()) > 0;
  if (await tem('empresa')) await page.fill(`${f} [name="empresa"]`, 'Agro Teste');
  await page.fill(`${f} [name="nome"]`, ' Ana  Maria Souza ');
  await page.fill(`${f} [name="telefone"]`, '(17) 99754-6177');
  await page.fill(`${f} [name="email"]`, 'Ana.Souza@Teste.com');
  if (await tem('tipo_evento')) await page.selectOption(`${f} [name="tipo_evento"]`, 'Corporativo');
  if (await tem('data_evento')) await page.$eval(`${f} [name="data_evento"]`, (el) => { el.value = '20/12/2026'; });
  if (await tem('convidados')) await page.fill(`${f} [name="convidados"]`, '150');
  for (const s of await page.$$(`${f} select[required]`)) if (!(await s.inputValue())) await s.selectOption({ index: 1 });
  // o Pixel cria o _fbp depois do carregamento: o site tem de ler no envio
  await page.evaluate(() => { document.cookie = '_fbp=fb.1.1700000000000.123456789;path=/'; });
  // clica no botão como o usuário (o template escuta o clique; sites mais antigos, o evento submit)
  const botao = page.locator(`${f} .form-submit, ${f} [type="submit"]`).first();
  if (await botao.count()) await botao.click(); else await page.$eval(f, (el) => el.requestSubmit());
  const a = await ultimo(av, 'form_submit');
  check(!!a, 'form_submit disparou');
  if (!a) { await ctx.close(); return; }
  check(a.push.form_source === 'form' && !/Souza|99754/.test(JSON.stringify(a.push)), `form_submit com form_source=form e sem PII (${JSON.stringify(a.push)})`);
  check(a.vars['cJS - Email'] === 'ana.souza@teste.com', `cJS - Email = ${a.vars['cJS - Email']}`);
  check(a.vars['cJS - Telefone'] === '+5517997546177', `cJS - Telefone = ${a.vars['cJS - Telefone']}`);
  check(a.vars['cJS - First Name'] === 'ana' && a.vars['cJS - Last Name'] === 'maria souza', `nome = ${a.vars['cJS - First Name']} / ${a.vars['cJS - Last Name']}`);
  check(a.vars['Dados Fornecidos pelo Usuário']?.email === 'ana.souza@teste.com', 'Dados Fornecidos pelo Usuário preenchida');
  check(a.vars['event_id_server'] && a.vars['event_id_server'] === hooks[0]?.event_id, `event_id igual no GTM e no n8n (${a.vars['event_id_server']})`);
  check(hooks[0]?.fbp === 'fb.1.1700000000000.123456789' && !!hooks[0]?.external_id, `payload do n8n com fbp, external_id e event_id (${hooks[0]?.fbp})`);
  check(hooks[0]?.utm_source === 'google' && hooks[0]?.utm_campaign === 'teste-gtm' && hooks[0]?.gclid === 'TESTE' && !!hooks[0]?.landing_page, 'payload do n8n com UTMs, gclid e landing_page em campos separados');
  const fonteEsperada = `Landing page/${url.replace(/\//g, '') || 'home'}`;
  check(hooks[0]?.Fonte === fonteEsperada, `Fonte só com o rótulo (${hooks[0]?.Fonte})`);
  check(a.vars['utm_source'] === 'google' && a.vars['utm_campaign'] === 'teste-gtm' && !!a.vars['cookie - _external_id'], 'UTMs e _external_id lidos dos cookies');
  check(a.tags.slice().sort().join() === LEAD, `tags: ${a.tags.join(' | ')}`);
  const fs = await ultimo(av, 'form_start');
  check(fs?.tags.includes('04 | GA4 | form_start'), 'form_start → GA4 form_start');
  await ctx.close();
}

// páginas do dist/ e os formulários de cada uma (lidos do HTML gerado)
const paginas = [];
const varrer = (dir, rota) => { for (const e of readdirSync(dir, { withFileTypes: true })) {
  if (e.isDirectory()) varrer(join(dir, e.name), `${rota}${e.name}/`);
  else if (e.name === 'index.html') {
    const html = readFileSync(join(dir, e.name), 'utf8');
    paginas.push({ rota, forms: [...html.matchAll(/data-form-id="([^"]+)"/g)].map((m) => m[1]), wa: html.includes('id="wa-toggle"') });
  } } };
varrer(join(SITE, 'dist'), '/');

try {
  let n = 0;
  for (const pg of paginas) for (const id of new Set(pg.forms)) await formulario(pg.rota, id, `${++n}. Formulário`);
  if (!n) console.log('\n(nenhum form[data-form-id] no dist/)');
  const comWa = paginas.find((pg) => pg.wa);
  if (!comWa) { console.log('\n(sem popup do WhatsApp no dist/)'); throw 'fim'; }
  console.log(`\nPopup do WhatsApp (${comWa.rota})`);
  const { ctx, page, hooks, av } = await abrir(`${comWa.rota}?utm_source=meta`);
  await page.evaluate(() => { document.cookie = '_fbp=fb.1.1700000000000.123456789;path=/'; });
  await page.click('#wa-toggle');
  const c = await ultimo(av, 'whatsapp_click');
  check(c?.push.click_type === 'abrir_popup' && c.tags.slice().sort().join() === CONTACT, `abrir popup → Contact (${c?.tags.join(' | ')})`);
  const responder = async (v) => { await page.waitForSelector('#wa-input:visible', { timeout: 8000 }); await page.fill('#wa-input', v); await page.keyboard.press('Enter'); };
  await responder('Bruno Lima'); await responder('17997546177'); await responder('bruno@teste.com');
  await page.waitForSelector('#wa-chips:visible .wa-chip'); await page.click('#wa-chips .wa-chip >> nth=0');
  await page.waitForSelector('#wa-input-date:visible'); await page.fill('#wa-input-date', '20/12/2026'); await page.keyboard.press('Enter');
  await page.waitForSelector('#wa-chips:visible .wa-chip'); await page.click('#wa-chips .wa-chip >> nth=1');
  const a = await ultimo(av, 'form_submit');
  check(a?.push.form_source === 'whatsapp' && !/Bruno|bruno/.test(JSON.stringify(a.push)), 'form_submit com form_source=whatsapp e sem PII');
  check(a?.vars['cJS - Email'] === 'bruno@teste.com' && a?.vars['cJS - Telefone'] === '+5517997546177' && a?.vars['cJS - First Name'] === 'bruno', `PII do popup: ${a?.vars['cJS - Email']} ${a?.vars['cJS - Telefone']} ${a?.vars['cJS - First Name']}`);
  check(a?.tags.slice().sort().join() === LEAD, `tags: ${a?.tags.join(' | ')}`);
  check(a?.vars['event_id_server'] === hooks[0]?.event_id, 'event_id igual no GTM e no n8n');
  check(hooks[0]?.fbp === 'fb.1.1700000000000.123456789' && !!hooks[0]?.external_id, 'payload do popup com fbp e external_id');
  check(hooks[0]?.utm_source === 'meta', 'payload do popup com utm_source em campo separado');
  check(hooks[0]?.Fonte === `Landing page/${comWa.rota.replace(/\//g, '') || 'home'}`, `Fonte do popup só com o rótulo (${hooks[0]?.Fonte})`);
  await page.click('.wa-cta');
  const cc = av.filter((x) => x.event === 'whatsapp_click').at(-1);
  check(cc?.push.click_type === 'continuar_conversa' && cc.tags.join() === '03 | GA4 | whatsapp_click', `"Continuar no WhatsApp" → só GA4 (${cc?.tags.join(' | ')})`);
  await ctx.close();
} catch (e) { if (e !== 'fim') throw e; } finally {
  await browser.close();
  encerrar();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
