# xAPI / cmi5 export against a minimal fake LRS (statements + state API + cmi5 fetch).
#   python3 test/xapi_lrs.py   (server at BASE, default http://localhost:8099)
import json, os, io, zipfile, threading, tempfile, uuid, sys, urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright
SimpleHTTPRequestHandler.log_message = lambda *a: None

BASE = os.environ.get('BASE', 'http://localhost:8099')
fails = 0
def ok(c, m):
    global fails
    print(('✓ ' if c else '✗ ') + m)
    if not c: fails += 1

statements, state, auth_seen = [], {}, []
class LRS(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Experience-API-Version')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def body(self):
        n = int(self.headers.get('content-length') or 0)
        return self.rfile.read(n) if n else b''
    def reply(self, code, data=None):
        self.send_response(code); self.cors()
        if data is not None:
            b = json.dumps(data).encode(); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
        else:
            self.end_headers()
    def key(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return (q['stateId'][0], q.get('registration', [''])[0])
    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        b = self.body()
        if p == '/fetch':
            return self.reply(200, {'auth-token': 'dGVzdDp0ZXN0'})
        if p == '/xapi/statements':
            auth_seen.append(self.headers.get('Authorization'))
            st = json.loads(b); statements.extend(st if isinstance(st, list) else [st]); return self.reply(200, [s.get('id') for s in (st if isinstance(st, list) else [st])])
        self.reply(404)
    def do_PUT(self):
        p = urllib.parse.urlparse(self.path).path
        if p == '/xapi/activities/state':
            state[self.key()] = self.body().decode(); return self.reply(204)
        self.reply(404)
    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        if p == '/xapi/activities/state':
            k = self.key()
            if k in state: 
                b = state[k].encode(); self.send_response(200); self.cors(); self.send_header('Content-Type','application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
            return self.reply(404)
        self.reply(404)

lrs = ThreadingHTTPServer(('127.0.0.1', 8124), LRS)
threading.Thread(target=lrs.serve_forever, daemon=True).start()

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context()
    r = ctx.request.post(BASE + '/api/auth/login', data={'email': 'admin@example.com', 'password': 'adminpass1234'}); H = {'x-csrf-token': r.json()['csrf']}
    proj = ctx.request.post(BASE + '/api/projects', data={'name': 'xAPI-Test'}, headers=H).json()
    c = ctx.request.post(BASE + f"/api/projects/{proj['id']}/courses", data={'title': 'xAPI Kurs', 'language': 'de', 'settings': {'mode': 'blocks', 'masteryScore': 50}}, headers=H).json()
    ctx.request.put(BASE + f"/api/courses/{c['id']}/blocks", data={'blocks': [{'type': 'title', 'data': {'content': 'Start'}}, {'type': 'quiz', 'data': {'question': 'Richtig?', 'options': ['Ja', 'Nein'], 'correct': [0]}}]}, headers=H)
    ctx.request.put(BASE + f"/api/courses/{c['id']}/design", data={'cover': {'show': False}}, headers=H)

    for fmt in ['cmi5', 'xapi']:
        statements.clear(); state.clear(); auth_seen.clear()
        ex = ctx.request.post(BASE + f"/api/courses/{c['id']}/export", data={'format': fmt}, headers=H)
        ok(ex.status == 201, f'{fmt} export ({ex.status})')
        exj = ex.json()
        zbytes = ctx.request.get(BASE + f"/api/exports/{exj['id']}/download").body()
        z = zipfile.ZipFile(io.BytesIO(zbytes))
        names = z.namelist()
        ok(('cmi5.xml' if fmt == 'cmi5' else 'tincan.xml') in names and 'runtime/xapi.js' in names and 'imsmanifest.xml' not in names, f'{fmt}: manifest + adapter in package')
        if fmt == 'cmi5':
            x = z.read('cmi5.xml').decode()
            ok('moveOn="CompletedAndPassed"' in x and 'masteryScore="0.5"' in x, 'cmi5.xml with moveOn and masteryScore')
        d = tempfile.mkdtemp(); z.extractall(d)
        port = 8123 if fmt == 'cmi5' else 8125
        srv = ThreadingHTTPServer(('127.0.0.1', port), partial(SimpleHTTPRequestHandler, directory=d))
        srv.RequestHandlerClass.log_message = lambda *a: None
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        actor = json.dumps({'objectType': 'Agent', 'name': 'Maren Ohlsen', 'mbox': 'mailto:maren@example.com'})
        reg = str(uuid.uuid4())
        act = exj['report']['activityId']
        if fmt == 'cmi5':
            state[('LMS.LaunchData', reg)] = json.dumps({'contextTemplate': {'contextActivities': {'grouping': [{'id': act + '/course'}]}, 'extensions': {'https://w3id.org/xapi/cmi5/context/extensions/sessionid': 's1'}}, 'launchMode': 'Normal', 'masteryScore': 0.5, 'moveOn': 'CompletedAndPassed'})
            qs = urllib.parse.urlencode({'endpoint': 'http://127.0.0.1:8124/xapi/', 'fetch': 'http://127.0.0.1:8124/fetch', 'actor': actor, 'registration': reg, 'activityId': act})
        else:
            qs = urllib.parse.urlencode({'endpoint': 'http://127.0.0.1:8124/xapi/', 'auth': 'Basic dXNlcjpwYXNz', 'actor': actor, 'registration': reg, 'activity_id': act})
        pg = browser.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/index.html?{qs}'); pg.wait_for_timeout(1200)
        pg.locator('.pp-option, .pp-choice, label').filter(has_text='Ja').first.click()
        pg.get_by_role('button', name='Prüfen').click(); pg.wait_for_timeout(400)
        pg.get_by_role('button', name='Kurs abschließen').first.click(); pg.wait_for_timeout(800)
        pg.goto('about:blank'); pg.wait_for_timeout(600); pg.close()
        import time; time.sleep(0.8)
        verbs = [s['verb']['id'].rsplit('/', 1)[1] for s in statements]
        ok('initialized' in verbs and 'completed' in verbs and 'passed' in verbs and 'terminated' in verbs, f'{fmt}: statements {verbs}')
        passed = next((s for s in statements if s['verb']['id'].endswith('passed')), None)
        ok(passed and passed['result']['score']['scaled'] == 1 and passed['context'].get('registration') == reg and passed['object']['id'] == act, f'{fmt}: passed with score, registration, activity')
        ok(all(s['actor']['mbox'] == 'mailto:maren@example.com' for s in statements), f'{fmt}: actor from launch')
        if fmt == 'cmi5':
            cats = [c['id'] for c in passed['context']['contextActivities']['category']]
            ok('https://w3id.org/xapi/cmi5/context/categories/cmi5' in cats and 'https://w3id.org/xapi/cmi5/context/categories/moveon' in cats, 'cmi5: categories on passed')
            ok(passed['context']['contextActivities'].get('grouping') and passed['context']['extensions'], 'cmi5: context template applied')
            ok(all(a == 'Basic dGVzdDp0ZXN0' for a in auth_seen), 'cmi5: auth token from fetch URL')
            ok(verbs.count('completed') == 1 and verbs.count('passed') == 1, 'cmi5: completed and passed only once')
        ok(('pp-suspend', reg) in state, f'{fmt}: resume state stored')
        ok(not errs, f'{fmt}: no page errors {errs}')
        srv.shutdown(); srv.server_close()
    # unit course: shell gets the adapter too
    u = ctx.request.post(BASE + f"/api/projects/{proj['id']}/courses", data={'title': 'Einheiten xAPI', 'language': 'en'}, headers=H).json()
    ctx.request.post(BASE + f"/api/courses/{u['id']}/units/draft", data={'library': 'H5P.AppSimulation', 'title': 'Sim'}, headers=H)
    ex = ctx.request.post(BASE + f"/api/courses/{u['id']}/export", data={'format': 'cmi5'}, headers=H)
    z = zipfile.ZipFile(io.BytesIO(ctx.request.get(BASE + f"/api/exports/{ex.json()['id']}/download").body()))
    idx = z.read('index.html').decode()
    ok(ex.status == 201 and 'runtime/xapi.js' in idx and idx.index('xapi.js') < idx.index('shell.js') and '"scormVersion":"2004"' in idx.replace(' ', ''), 'unit course cmi5 package loads the adapter before the shell')
    ctx.request.delete(BASE + f"/api/projects/{proj['id']}", headers=H)
    browser.close()
lrs.shutdown()
print('\n✗ %d failure(s)' % fails if fails else '\n✓ xAPI/cmi5-Test bestanden')
sys.exit(1 if fails else 0)
