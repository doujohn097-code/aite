import { Html, Head, Main, NextScript } from 'next/document';

const themeBootstrap = `(function(){try{
  var r = document.documentElement;
  var loc = localStorage.getItem('aite:locale');
  if(loc!=='en' && loc!=='fr' && loc!=='ar') loc = 'ar';
  r.lang = loc;
  r.dir = loc==='ar' ? 'rtl' : 'ltr';
  r.dataset.locale = loc;
  var t = localStorage.getItem('theme');
  var a = localStorage.getItem('accent') || 'blue';
  var dark = {dark:1,dim:1,ocean:1,crimson:1,violet:1,emerald:1};
  var wallpaper = {lilac:1,ocean:1,crimson:1,violet:1,emerald:1};
  var known = {light:1,dim:1,dark:1,lilac:1,ocean:1,crimson:1,violet:1,emerald:1};
  if(!t || !known[t]) t = 'dark';
  if(dark[t]) r.classList.add('dark'); else r.classList.remove('dark');
  if(wallpaper[t]){
    r.classList.add('theme-wallpaper');
    r.style.setProperty('--theme-wallpaper-image','url("/assets/themes/'+t+'.webp")');
  } else {
    r.classList.remove('theme-wallpaper');
    r.style.setProperty('--theme-wallpaper-image','none');
  }
  r.dataset.theme = t;
  r.style.setProperty('--main-background','var(--'+t+'-background)');
  r.style.setProperty('--main-search-background','var(--'+t+'-search-background)');
  r.style.setProperty('--main-sidebar-background','var(--'+t+'-sidebar-background)');
  r.style.setProperty('--main-accent','var(--accent-'+a+')');
  r.style.setProperty('--main-accent-contrast','var(--accent-'+a+'-contrast)');
  r.style.setProperty('--main-accent-text','var(--accent-'+a+'-text)');
}catch(e){}})();`;

/**
 * كشف ميزات CSS غير المدعومة في ويب فيو أندرويد/هواوي القديمة، وإضافة أصناف
 * على <html> تفعّل بدائل في globals.scss:
 *  - no-flex-gap: ‏gap داخل flex (Chrome < 84) — تُستبدل بهوامش.
 *  - no-has: محدد :has() (Chrome < 105) — نعلّم بالـ JS أبناء العمود الرئيسي
 *    الذين يحتوون بطاقات زجاجية (has-glass) كي تعمل قواعد البطاقات كما هي.
 * المتصفحات الحديثة لا يتغير فيها شيء.
 */
const legacyCompat = `(function(){try{
  var r = document.documentElement;
  var b = document.body;
  var testFlexGap = function(){
    var f = document.createElement('div');
    f.style.cssText = 'display:flex;flex-direction:column;row-gap:10px;position:absolute;visibility:hidden;top:0;left:0';
    f.appendChild(document.createElement('div'));
    f.appendChild(document.createElement('div'));
    b.appendChild(f);
    // إن لم يكن العنصر مرسومًا بعد (body مخفي مؤقتًا) فالنتيجة غير معروفة
    var ok = f.getClientRects().length ? f.scrollHeight >= 10 : null;
    b.removeChild(f);
    return ok;
  };
  var tries = 0;
  var checkFlexGap = function(){
    var ok = testFlexGap();
    if(ok === false) r.classList.add('no-flex-gap');
    else if(ok === null && ++tries < 20) setTimeout(checkFlexGap, 500);
  };
  checkFlexGap();
  var hasSel = false;
  try { hasSel = !!(window.CSS && CSS.supports && CSS.supports('selector(:has(*))')); } catch(e) {}
  if(!hasSel){
    r.classList.add('no-has');
    var queued = false;
    var mark = function(){
      queued = false;
      var kids = document.querySelectorAll('.theme-surface > *');
      for(var i = 0; i < kids.length; i++){
        var k = kids[i];
        var g = !!k.querySelector('.glass-card, .glass-panel');
        if(g !== k.classList.contains('has-glass')) k.classList.toggle('has-glass', g);
      }
    };
    var queue = function(){ if(!queued){ queued = true; requestAnimationFrame(mark); } };
    if(window.MutationObserver) new MutationObserver(queue).observe(b, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', queue);
  }
}catch(e){}})();`;

export default function Document(): JSX.Element {
  return (
    <Html lang='ar' dir='rtl' className='dark' suppressHydrationWarning>
      <Head>
        <link rel='manifest' href='/manifest.json' />
        <meta name='theme-color' content='#000000' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta
          name='apple-mobile-web-app-status-bar-style'
          content='black-translucent'
        />
        <meta name='apple-mobile-web-app-title' content='Aite' />
        <link rel='apple-touch-icon' href='/logo192.png' />
        <link rel='icon' href='/favicon.ico' />
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600;1,700&display=swap'
          rel='stylesheet'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap'
          rel='stylesheet'
        />
        {/* خطوط المنشورات والرسائل والريلز والقصص — أوزان قراءة وعناوين */}
        <link
          href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Almarai:wght@400;700&family=Amiri:wght@400;700&family=Reem+Kufi:wght@400;600;700&family=Lalezar&family=Aref+Ruqaa:wght@400;700&family=El+Messiri:wght@400;600;700&family=Changa:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Readex+Pro:wght@400;500;600;700&family=Mada:wght@400;600;700&family=Lemonada:wght@400;600;700&family=Noto+Kufi+Arabic:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Bebas+Neue&family=Pacifico&family=Lobster&family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Oswald:wght@400;600;700&family=Dancing+Script:wght@400;600;700&family=Montserrat:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap'
          rel='stylesheet'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Color+Emoji&display=swap'
          rel='stylesheet'
        />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: legacyCompat }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
