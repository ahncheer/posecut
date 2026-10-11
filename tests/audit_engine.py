"""cut-test.html 정적 점검: 안 쓰는 이름, 없는 id 참조, 안 쓰는 CSS 클래스, 반복되는 숫자."""
import re, sys
from collections import Counter

src = open(sys.argv[1], encoding='utf-8').read()
style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body_html = src.split('<script type="importmap">')[0]
js = src.split('<script type="module">', 1)[1].rsplit('</script>', 1)[0]
js_nocomment = re.sub(r'//[^\n]*', '', js)

print('lines total:', src.count('\n'), '| js lines:', js.count('\n'), '| css lines:', style.count('\n'))

# 1) declared names used only once (= declared but never used)
decl = re.findall(r'\b(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))', js_nocomment)
names = [a or b for a, b in decl]
unused = [n for n in sorted(set(names)) if len(re.findall(r'(?<![\w$.])' + re.escape(n) + r'(?![\w$])', js_nocomment)) <= 1]
print('\n[unused declarations]', unused)

# 2) ids referenced from JS that do not exist / ids in HTML never referenced
html_ids = set(re.findall(r'\bid="([^"]+)"', body_html))
js_ids = set(re.findall(r"\$\('([^']+)'\)", js)) | set(re.findall(r"getElementById\('([^']+)'\)", js))
js_ids |= set(re.findall(r"'#([A-Za-z][\w-]*)'", js))
print('[ids used in JS but missing in HTML]', sorted(i for i in js_ids if i not in html_ids and not i.endswith('o')))
label_for = set(re.findall(r'\bfor="([^"]+)"', body_html))
aria = set(re.findall(r'aria-(?:controls|labelledby)="([^"]+)"', body_html))
dynamic = {i for i in html_ids if i.endswith('o')}  # number inputs replaced at runtime
print('[ids in HTML never used]', sorted(i for i in html_ids if i not in js_ids and i not in label_for and i not in aria and i not in dynamic and not i.startswith(('t-', 'p-'))))

# 3) CSS classes never used in HTML or JS
css_classes = set(re.findall(r'\.([a-zA-Z][\w-]*)', re.sub(r'url\([^)]*\)|\d+\.\d+', '', style)))
used = set()
for m in re.findall(r'class="([^"]+)"', src): used |= set(m.split())
for m in re.findall(r"className\s*=\s*'([^']+)'", js): used |= set(m.split())
for m in re.findall(r"classList\.(?:add|remove|toggle)\('([^']+)'", js): used.add(m)
for m in re.findall(r"'\.([a-zA-Z][\w-]*)", js): used.add(m)
print('[CSS classes never used]', sorted(c for c in css_classes if c not in used))

# 4) repeated magic numbers
nums = Counter(re.findall(r'(?<![\w.$#\'"-])(150|180|100|4|0\.015|1400)(?![\w.%])', js_nocomment))
print('[repeated literals]', dict(nums))
print('[innerHTML uses]', len(re.findall(r'innerHTML\s*=', js)))
for m in re.finditer(r'innerHTML\s*=\s*([^;\n]+)', js): print('   ', m.group(1)[:90])
print('[console.* calls]', re.findall(r'console\.\w+', js))
print('[localStorage direct uses]', len(re.findall(r'localStorage\.', js)))
print('[TODO/FIXME/old notes]', re.findall(r'(?:TODO|FIXME|다음 테스트에서)[^\n]*', src))
