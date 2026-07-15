import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

type CdpResponse = {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: { message: string };
};

type BrowserHandle = {
  chrome: ChildProcessWithoutNullStreams;
  session: CdpSession;
  userDataDir: string;
};

const RUN_E2E = process.env.RUN_E2E === '1';
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const E2E_EMAIL = process.env.E2E_EMAIL || process.env.DEV_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD || process.env.DEV_PASSWORD;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function removeDirWithRetry(dir: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(250);
    }
  }
}

class CdpSession {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private eventHandlers = new Map<string, Array<(params: any) => void>>();

  constructor(private ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }

      if (message.method) {
        for (const handler of this.eventHandlers.get(message.method) || []) {
          handler(message.params);
        }
      }
    });
  }

  static connect(wsUrl: string) {
    return new Promise<CdpSession>((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        reject(new Error('WebSocket global indisponivel neste Node.'));
        return;
      }

      const ws = new WebSocket(wsUrl);
      ws.addEventListener('open', () => resolve(new CdpSession(ws)));
      ws.addEventListener('error', () => reject(new Error('Falha ao conectar no Chrome DevTools.')));
    });
  }

  send<T = any>(method: string, params: Record<string, any> = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`Timeout CDP em ${method}`));
      }, 15000);
    });
  }

  on(method: string, handler: (params: any) => void) {
    const handlers = this.eventHandlers.get(method) || [];
    handlers.push(handler);
    this.eventHandlers.set(method, handlers);
  }

  close() {
    this.ws.close();
  }
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate));
}

async function launchBrowser(startUrl: string): Promise<BrowserHandle> {
  const chromePath = findChromeExecutable();
  assert.ok(chromePath, 'Chrome ou Edge nao encontrado. Defina CHROME_PATH para rodar e2e.');

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'gestifique-e2e-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,1000',
    'about:blank',
  ]);

  const activePortFile = path.join(userDataDir, 'DevToolsActivePort');
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(activePortFile)) break;
    await sleep(100);
  }

  assert.ok(existsSync(activePortFile), 'Chrome nao abriu a porta de debug.');
  const [port] = (await import('node:fs')).readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
  const newTargetUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(startUrl)}`;
  let targetResponse = await fetch(newTargetUrl, { method: 'PUT' });
  if (!targetResponse.ok) targetResponse = await fetch(newTargetUrl);
  assert.equal(targetResponse.ok, true, 'Nao foi possivel criar aba no Chrome.');
  const target = await targetResponse.json() as { webSocketDebuggerUrl: string };
  const session = await CdpSession.connect(target.webSocketDebuggerUrl);

  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Network.enable');
  await session.send('Log.enable');

  return { chrome, session, userDataDir };
}

async function evaluate<T>(session: CdpSession, expression: string, awaitPromise = false): Promise<T> {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Erro ao avaliar script no navegador.');
  }

  return result.result?.value as T;
}

async function navigate(session: CdpSession, url: string) {
  await session.send('Page.navigate', { url });
  await waitFor(session, 'document.readyState === "complete"', 15000);
}

async function waitFor(session: CdpSession, expression: string, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await evaluate<boolean>(session, `Boolean(${expression})`).catch(() => false);
    if (ok) return;
    await sleep(150);
  }
  throw new Error(`Timeout aguardando: ${expression}`);
}

async function setInputValue(session: CdpSession, selector: string, value: string) {
  const ok = await evaluate<boolean>(session, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
      setter?.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert.equal(ok, true, `Campo nao encontrado: ${selector}`);
}

async function clickByText(session: CdpSession, text: string) {
  const ok = await evaluate<boolean>(session, `
    (() => {
      const text = ${JSON.stringify(text)};
      const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const el = elements.find((item) => (item.textContent || '').includes(text));
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()
  `);
  assert.equal(ok, true, `Elemento com texto "${text}" nao encontrado.`);
}

async function clickBySelector(session: CdpSession, selector: string) {
  const ok = await evaluate<boolean>(session, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()
  `);
  assert.equal(ok, true, `Elemento nao encontrado: ${selector}`);
}

async function apiGet<T>(session: CdpSession, endpoint: string): Promise<T> {
  return evaluate<T>(session, `
    fetch(${JSON.stringify(endpoint)}, { credentials: 'include' })
      .then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }))
      .then(({ status, body }) => {
        if (status >= 400) throw new Error(body?.message || 'HTTP ' + status);
        return body?.data;
      })
  `, true);
}

test('gestifique e2e smoke', { skip: !RUN_E2E || !E2E_EMAIL || !E2E_PASSWORD }, async (t) => {
  const browser = await launchBrowser(`${BASE_URL}/login`);
  const { session } = browser;
  const pageErrors: string[] = [];

  session.on('Runtime.exceptionThrown', (params) => {
    pageErrors.push(params.exceptionDetails?.text || 'Erro de runtime no navegador.');
  });

  try {
    await t.test('bloqueia API protegida sem sessao', async () => {
      await session.send('Network.clearBrowserCookies');
      await navigate(session, `${BASE_URL}/login`);
      const status = await evaluate<number>(session, `
        fetch('/api/dashboard/summary', { credentials: 'include' }).then((response) => response.status)
      `, true);
      assert.equal(status, 401);
    });

    await t.test('login e dashboard carregam', async () => {
      await setInputValue(session, 'input[name="email"]', E2E_EMAIL!);
      await setInputValue(session, 'input[name="password"]', E2E_PASSWORD!);
      await clickBySelector(session, 'button[type="submit"]');
      await waitFor(session, `document.body.innerText.includes('Dashboard') || document.body.innerText.includes('Visao gerencial') || document.body.innerText.includes('Visão gerencial')`, 20000);
      await waitFor(session, `document.body.innerText.includes('Chamados abertos')`, 20000);
      const hasFilterUi = await evaluate<boolean>(session, `
        document.body.innerText.includes('Recorte da operação')
        || document.body.innerText.includes('Filtros gerenciais')
      `);
      assert.equal(hasFilterUi, true);
    });

    await t.test('dashboard summary aceita filtro de periodo', async () => {
      const data = await apiGet<Record<string, unknown>>(session, '/api/dashboard/summary?period=7d');
      assert.ok(Object.prototype.hasOwnProperty.call(data, 'chamadosAtivos'));
      assert.equal((data as any).filters?.period, '7d');
    });

    await t.test('listagem de chamados abre sem overflow', async () => {
      await clickByText(session, 'Chamados');
      await waitFor(session, `document.body.innerText.includes('Central de Chamados')`, 15000);
      await waitFor(session, `Boolean(document.querySelector('input[placeholder="Buscar chamado..."]'))`, 15000);
      const overflow = await evaluate<number>(session, `document.documentElement.scrollWidth - window.innerWidth`);
      assert.ok(overflow <= 4, `Overflow horizontal detectado: ${overflow}px`);
      const hasTicketSearch = await evaluate<boolean>(session, `Boolean(document.querySelector('input[placeholder="Buscar chamado..."]'))`);
      assert.equal(hasTicketSearch, true);
    });

    await t.test('busca global tem estado vazio ou resultados', async () => {
      const profile = await apiGet<any>(session, '/api/profile');
      let query = 'gestifique-sem-resultado-e2e';
      if (profile?.desenvolvedor) {
        const companies = await apiGet<any[]>(session, '/api/companies').catch(() => []);
        query = companies[0]?.nome || query;
      }

      await setInputValue(session, 'header input[type="search"]', query);
      await waitFor(session, `document.body.innerText.includes('Nenhum resultado') || document.body.innerText.includes('Clientes e empresas') || document.body.innerText.includes('Chamados')`, 15000);
    });

    await t.test('detalhe do chamado abre quando ha massa de dados', async (subtest) => {
      const profile = await apiGet<any>(session, '/api/profile');
      let ticketEndpoint = '/api/tickets?limit=1&page=1';
      if (profile?.desenvolvedor) {
        const companies = await apiGet<any[]>(session, '/api/companies').catch(() => []);
        if (companies[0]?.id) ticketEndpoint += `&empresa_id=${companies[0].id}`;
      }

      const ticketsResponse = await apiGet<any>(session, ticketEndpoint).catch(() => null);
      const ticket = Array.isArray(ticketsResponse) ? ticketsResponse[0] : ticketsResponse?.data?.[0];
      if (!ticket?.id) {
        subtest.diagnostic('Sem chamados disponiveis para validar detalhe.');
        return;
      }

      await evaluate<void>(session, `
        localStorage.setItem('gestifique.dashboardState', JSON.stringify({ activeTab: 'tickets', selectedTicketId: ${Number(ticket.id)} }));
      `);
      await navigate(session, BASE_URL);
      await waitFor(session, `document.body.innerText.includes('Chamado') && (document.body.innerText.includes('Enviar resposta') || document.body.innerText.includes('Propriedades'))`, 20000);
    });

    await t.test('criacao de chamado abre modal', async () => {
      await evaluate<void>(session, `
        localStorage.setItem('gestifique.dashboardState', JSON.stringify({ activeTab: 'tickets', selectedTicketId: null }));
      `);
      await navigate(session, BASE_URL);
      await waitFor(session, `document.body.innerText.includes('Central de Chamados')`, 15000);
      const opened = await evaluate<boolean>(session, `
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find((item) => item.getAttribute('title') === 'Novo chamado' || item.textContent?.includes('Novo Chamado'));
          if (!btn) return false;
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return true;
        })()
      `);
      if (opened) {
        await waitFor(session, `document.body.innerText.includes('Novo Chamado')`, 10000);
      }
    });

    await t.test('mobile de chamados usa cards sem tabela visivel', async () => {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await evaluate<void>(session, `
        localStorage.setItem('gestifique.dashboardState', JSON.stringify({ activeTab: 'tickets', selectedTicketId: null }));
      `);
      await navigate(session, BASE_URL);
      await waitFor(session, `document.body.innerText.includes('Central de Chamados')`, 15000);
      const result = await evaluate<{ overflow: number; visibleTables: number }>(session, `
        (() => ({
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          visibleTables: Array.from(document.querySelectorAll('table')).filter((table) => {
            const style = window.getComputedStyle(table);
            const rect = table.getBoundingClientRect();
            return style.display !== 'none' && rect.width > 0 && rect.height > 0;
          }).length,
        }))()
      `);
      assert.ok(result.overflow <= 4, `Overflow mobile detectado: ${result.overflow}px`);
      assert.equal(result.visibleTables, 0);
    });

    assert.deepEqual(pageErrors, []);
  } finally {
    session.close();
    browser.chrome.kill();
    await Promise.race([
      new Promise((resolve) => browser.chrome.once('exit', resolve)),
      sleep(2000),
    ]);
    await removeDirWithRetry(browser.userDataDir);
  }
});
