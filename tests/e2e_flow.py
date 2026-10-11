"""화면 흐름 점검: 새 원고 → 원고 화면 → 컷 편집(엔진) → 자동 저장 → 원고 화면 썸네일.
사용: python tests/e2e_flow.py <앱 주소> <three 등 CDN 대신 쓸 node_modules 경로> <스크린샷 폴더>
(CDN을 쓸 수 있는 환경에서는 두 번째 인자를 '-'로 주면 실제 CDN을 씀)"""
import os, sys, time
from playwright.sync_api import sync_playwright

base, nm, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
MAP = [("https://cdn.jsdelivr.net/npm/three@0.169.0/build/", "three/build/"),
       ("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/", "three/examples/jsm/"),
       ("https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.2/lib/", "@pixiv/three-vrm/lib/")]

def route(r):
    u = r.request.url
    for pre, loc in MAP:
        if u.startswith(pre):
            path = os.path.join(nm, loc + u[len(pre):])
            if os.path.isfile(path):
                return r.fulfill(path=path, headers={"Content-Type": "text/javascript", "Access-Control-Allow-Origin": "*"})
    if u.startswith(base) or u.startswith('data:') or u.startswith('blob:'):
        return r.continue_()
    return r.abort()

def wait_text(loc, text, sec=180):
    t0 = time.time()
    while time.time() - t0 < sec:
        try:
            if text in loc.inner_text(): return True
        except Exception: pass
        time.sleep(0.4)
    return False

errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1360, 'height': 900})
    if nm != '-': ctx.route('**/*', route)
    pg = ctx.new_page(); pg.set_default_timeout(120000)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(base)
    pg.screenshot(path=f'{out}/1_home.png')
    pg.click('text=+ 새 원고 >> nth=0')
    pg.click('button.choice:has-text("기본 4컷")')
    pg.fill('input[type=number] >> nth=0', '10')
    pg.screenshot(path=f'{out}/2_new_step1.png')
    pg.click('text=다음: 작품 설정')
    pg.fill('input[placeholder^="예: 3화"]', '1화 카페')
    pg.fill('label:has-text("작품 제목") input', '카페 너머의 계절')
    pg.select_option('label:has-text("성별") select >> nth=0', 'm')
    pg.select_option('label:has-text("성별") select >> nth=1', 'f')
    pg.screenshot(path=f'{out}/3_new_step2.png', full_page=True)
    pg.click('.actions button.primary')
    pg.wait_for_function("/^#\\/m\\/[^/]+$/.test(location.hash)")
    time.sleep(0.5)
    print('manuscript url:', pg.url.split('#')[1], '| cuts:', pg.locator('.canvaswrap .cutbox').count())
    pg.locator('.canvaswrap .cutbox').nth(1).click()
    print('selected panel:', pg.inner_text('section[aria-label="선택한 컷"] h2'), '|', pg.inner_text('section[aria-label="선택한 컷"] p.sub >> nth=0'))
    pg.screenshot(path=f'{out}/4_manuscript.png')
    pg.click('button:has-text("장면 만들기")')
    pg.wait_for_function("location.hash.includes('/cut/')")
    status = pg.locator('[role=status]').first
    ok = wait_text(status, '새 장면', 240)
    fr = pg.frame_locator('iframe')
    print('engine loaded:', ok, '| status:', status.inner_text(), '| engine says:', fr.locator('#status').inner_text())
    print('frame label:', fr.locator('#frameLabel').inner_text(), '| embed hides file button:', fr.locator('.top label[for=file]').is_hidden())
    # 포즈 프리셋 하나 눌러서 바꾸기 → 자동 저장
    fr.locator('#presets .chip').nth(1).click()
    saved = wait_text(status, '자동 저장됨', 60)
    print('auto saved:', saved)
    time.sleep(1)
    pg.screenshot(path=f'{out}/5_editor.png')
    pg.click('text=다음 컷 ›')
    time.sleep(2)
    pg.screenshot(path=f'{out}/5b_after_next.png')
    print('after next click hash:', pg.evaluate('location.hash'), '| errors so far:', errs[:3])
    wait_text(status, '새 장면', 240)
    print('next cut:', pg.locator('.topbar b').inner_text())
    pg.click('text=← 원고로')
    pg.wait_for_function("/^#\\/m\\/[^/]+$/.test(location.hash)")
    time.sleep(1.5)
    thumbs = pg.locator('.canvaswrap image').count()
    print('thumbnails on page:', thumbs)
    # 복사 → 다른 컷에 붙여넣기
    pg.locator('.canvaswrap .cutbox').nth(1).click()
    pg.click('section[aria-label="선택한 컷"] >> text=복사')
    pg.locator('.canvaswrap .cutbox').nth(3).click()
    pg.click('section[aria-label="선택한 컷"] >> text=붙여넣기')
    time.sleep(0.8)
    print('after paste thumbnails:', pg.locator('.canvaswrap image').count(), '|', pg.inner_text('section[aria-label="선택한 컷"] [role=status]'))
    pg.screenshot(path=f'{out}/6_manuscript_after.png')
    # 새로고침해도 남는지
    pg.reload(); time.sleep(1.5)
    print('after reload thumbnails:', pg.locator('.canvaswrap image').count())
    pg.goto(base); time.sleep(0.8)
    print('home list:', pg.locator('.msitem').all_inner_texts())
    pg.set_viewport_size({'width': 390, 'height': 844}); time.sleep(0.5)
    print('mobile overflow:', pg.evaluate('document.documentElement.scrollWidth > innerWidth'))
    pg.screenshot(path=f'{out}/7_home_mobile.png', full_page=True)
    b.close()
print('errors:', errs)
