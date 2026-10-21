from playwright.sync_api import sync_playwright
B="http://localhost:8099"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
    ctx=b.new_context(viewport={"width":1100,"height":900}, permissions=["microphone"])
    r=ctx.request.post(B+"/api/auth/login", data={"email":"admin@example.com","password":"adminpass1234"}); H={"x-csrf-token":r.json()['csrf']}
    proj=ctx.request.post(B+"/api/projects", data={"name":"Sprachlabor"}, headers=H).json()
    c=ctx.request.post(B+f"/api/projects/{proj['id']}/courses", data={"title":"Deutsch im Restaurant","language":"de","settings":{"mode":"blocks"}}, headers=H).json()
    blocks=[{"type":"title","data":{"content":"Im Restaurant bestellen","kicker":"Sprachlabor"}},
      {"type":"wordBank","data":{"prompt":"Setze die Wörter ein.","text":"Ich [hätte] gern einen Tisch für [zwei] Personen.","distractors":["habe","drei"]}},
      {"type":"termGuess","data":{"items":[{"clue":"Man bekommt sie im Restaurant, um das Essen auszuwählen.","term":"Speisekarte|die Speisekarte","hint":"S…"},{"clue":"Am Ende des Essens bittet man darum.","term":"Rechnung|die Rechnung"}]}},
      {"type":"oralReading","data":{"text":"Guten Abend. Ich hätte gern einen Tisch für zwei Personen."}},
      {"type":"voiceInsert","data":{"prompt":"Bestelle ein Getränk und ein Hauptgericht.","modelText":"Ich nehme ein Wasser und das Schnitzel, bitte."}},
      {"type":"conversation","data":{"partner":"Kellnerin","turns":[{"speaker":"partner","text":"Guten Abend! Was darf ich Ihnen bringen?"},{"speaker":"learner","text":"Ich hätte gern ein Wasser, bitte."},{"speaker":"partner","text":"Gern. Still oder mit Kohlensäure?"},{"speaker":"learner","text":"Still, bitte."}]}}]
    res=ctx.request.put(B+f"/api/courses/{c['id']}/blocks", data={"blocks":blocks}, headers=H); print("save", res.status, res.text()[:200] if res.status!=200 else '')
    ctx.request.put(B+f"/api/courses/{c['id']}/design", data={"player":"focus","cover":{"show":False},"theme":{"preset":"sunset"}}, headers=H)
    pg=ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{B}/live/{c['id']}"); pg.wait_for_timeout(1000)
    pg.locator(".pp-wb-chip", has_text="hätte").click(); pg.locator(".pp-wb-chip", has_text="drei").click(); pg.wait_for_timeout(200)
    pg.locator(".pp-b-wordbank .pp-btn-primary").click()
    pg.locator(".pp-tg-input").nth(0).fill("Speisekarte"); pg.locator(".pp-tg-input").nth(1).fill("Quittung")
    pg.locator(".pp-b-termguess .pp-btn-primary").click()
    pg.locator(".pp-b-voice .pp-btn-mic").click(); pg.wait_for_timeout(1500); pg.locator(".pp-b-voice .pp-btn-mic").click(); pg.wait_for_timeout(800)
    pg.locator(".pp-b-convo .pp-btn-primary").click(); pg.wait_for_timeout(300)
    pg.locator(".pp-b-convo .pp-btn-primary", has_text="Weiter").click(); pg.wait_for_timeout(300)
    pg.locator(".pp-convo-input").fill("Ich hätte gern ein Wasser"); pg.locator(".pp-b-convo .pp-btn-primary", has_text="Abgeben").click(); pg.wait_for_timeout(300)
    pg.screenshot(path="/tmp/pw/ll-1.png", full_page=True)
    print("errors", errs)
    print("course", c['id'])
    b.close()
