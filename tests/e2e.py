"""
End-to-end test: loads the real NkapTalk extension in Chrome and drives the offline
practice copy of the SAFINUM test page through the full journey by talking to NkapTalk
(typed Pidgin, local mode, no network).
"""
import http.server, threading, functools, os, sys, re, time, tempfile
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(ROOT, "nkaptalk-extension")
SITE = os.path.join(ROOT, "practice-bank")

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None

fails = []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        tempfile.mkdtemp(), executable_path="/usr/bin/google-chrome", headless=False,
        args=["--headless=new", f"--disable-extensions-except={EXT}", f"--load-extension={EXT}", "--no-sandbox"],
    )
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.add_init_script("document.documentElement.dataset.nkaptalkMute = '1'")
    page.goto("http://127.0.0.1:8765/index.html")
    page.wait_for_selector("#nkaptalk-root", state="attached", timeout=10000)
    time.sleep(0.8)

    body = lambda: page.evaluate("document.querySelector('#app').textContent.replace(/\\s+/g,' ')")
    t = body()
    check("Moni wey dey your account" in t, "dashboard translated to Pidgin")
    check("250 000 FCFA" in t or "250 000 FCFA" in t, "balance value unchanged")
    check("CM 001 2345 6789 01" in t, "account number unchanged")
    check("Amina Ngo Bell" in t, "name unchanged")
    check("How you dey, Amina?" in t, "greeting with name kept")
    check("Send moni" in t and "Look di charge" in t, "buttons translated")

    def shadow(sel):
        return page.locator("#nkaptalk-root").locator(sel)

    shadow(".fab").click()
    time.sleep(0.6)
    def last_reply():
        msgs = shadow(".msg.nkaptalk").all_inner_texts()
        return msgs[-1] if msgs else ""
    def talk(text, wait=1.2):
        shadow("input").fill(text)
        shadow("input").press("Enter")
        time.sleep(wait)
        return last_reply()

    check("account page" in last_reply(), "greets and describes dashboard")
    lock = shadow(".lock .s").inner_text()
    check("0 changed" in lock, f"integrity bar: {lock}")

    r = talk("How much moni dey my account?")
    check("250" in r and "FCFA" in r, f"balance answer: {r}")

    r = talk("Tell me one story")
    check("bank matter" in r, f"off-topic answer: {r}")

    r = talk("I wan send 5000 give Ngwa Paul for mobile money", 1.8)
    check("charge na 100 FCFA" in " ".join(r.split()), f"fees read from page: {r}")
    check("Make I go front?" in r, "asks before continuing")
    t = body()
    check("Charge na" in t and "1,5 %" in t, "fee rule translated with values kept")

    r = talk("yes", 1.8)
    check("phone number" in r.lower(), f"asks phone (name already given): {r}")
    r = talk("six seven seven double one two three four five", 1.2)
    check("why you di send" in r.lower(), f"asks reason: {r}")
    r = talk("skip", 1.2)
    check("Ngwa Paul" in r and "+237 6 77 11 23 45" in r, f"reads back name and phone: {r}")
    r = talk("na so", 2.0)
    check("Reference na SAF-2026-" in r and "5 100 FCFA" in r.replace(" ", " "), f"summary read back: {r}")
    check("Make I send di moni?" in r, "asks before confirming")
    t = body()
    check("Check am again" in t, "summary page translated")
    check("Ngwa Paul" in t and "+237 6 77 11 23 45" in t, "beneficiary data untouched on summary")

    r = talk("no", 1.0)
    check("I no send am" in r, f"'no' cancels: {r}")
    check("Confirm di transfer" in body(), "still on summary after no")

    r = talk("confirm am", 1.2)
    check("Make I send di moni?" in r, "confirm asks again with read-back")
    r = talk("yes", 2.0)
    check("Transfer don go" in r, f"receipt: {r}")
    t = body()
    check("Transfer don go" in t and "E don work" in t, "receipt translated")

    # Errors and alerts
    r = talk("I wan send 900000 for another bank", 2.5)
    r = talk("yes", 2.5)
    msgs = " ".join(shadow(".msg.nkaptalk").all_inner_texts()[-3:])
    check("Your moni no reach for dis transfer" in msgs, f"insufficient balance announced: {msgs[-200:]}")
    check("How much you wan send?" in msgs, "asks amount again after error")

    # New content injected like the jury would
    page.evaluate("""() => { const d=document.createElement('div'); d.innerHTML='<p>Ne communiquez jamais votre code PIN.</p>'; document.querySelector('#main').prepend(d); }""")
    time.sleep(1.2)
    check("No ever give anybody your PIN code." in body(), "injected known warning translated live")
    page.evaluate("""() => { const d=document.createElement('div'); d.innerHTML='<p>Attention : un agent ne vous demandera jamais votre code secret par téléphone.</p>'; document.querySelector('#main').prepend(d); }""")
    time.sleep(1.2)
    t = body()
    check("⚠ Warning — read dis one well: Attention : un agent ne vous demandera jamais votre code secret par téléphone." in t, "unknown warning gets Pidgin warning + exact original (offline)")
    msgs = " ".join(shadow(".msg.nkaptalk").all_inner_texts()[-2:])
    check("New message for screen" in msgs, f"new message announced: {msgs[-160:]}")
    page.evaluate("""() => { const d=document.createElement('p'); d.textContent='Frais de 2 % (min. 200 FCFA, max. 5 000 FCFA)'; document.querySelector('#main').prepend(d); }""")
    time.sleep(0.8)
    check("Charge na 2 % (e no fit go under 200" in body().replace(" ", " "), "dynamic text with values translated")

    # English page
    page.locator("button[data-a='lang']").click()
    time.sleep(1.0)
    t = body()
    check("Moni wey dey your account" in t or "Charge for send moni" in t, "English page also translated")
    check("250,000 FCFA" in t, "English amount format unchanged")

    # Toggle original
    shadow(".tr").click(); time.sleep(0.5)
    check("Available balance" in body(), "original language restored on toggle")
    shadow(".tr").click(); time.sleep(0.5)
    check("Moni wey dey your account" in body(), "Pidgin back on toggle")

    lock = shadow(".lock .s").inner_text()
    check("0 changed" in lock, f"final integrity: {lock}")
    check(not [e for e in errors if "NkapTalk" in e], f"no NkapTalk console errors {errors[:3]}")
    page.screenshot(path=os.path.join(ROOT, "tests", "e2e-final.png"), full_page=False)
    ctx.close()

httpd.shutdown()
print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
