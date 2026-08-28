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
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
