import { Html, Head, Main, NextScript } from 'next/document';

const themeBootstrap = `(function(){try{
  var t = localStorage.getItem('theme');
  var a = localStorage.getItem('accent') || 'blue';
  var dark = {dark:1,dim:1,ocean:1,crimson:1,violet:1,emerald:1,wisteria:1,carbon:1};
  var wallpaper = {lilac:1,ocean:1,crimson:1,violet:1,emerald:1,wisteria:1,carbon:1};
  var known = {light:1,dim:1,dark:1,lilac:1,ocean:1,crimson:1,violet:1,emerald:1,wisteria:1,carbon:1};
  if(!t || !known[t]) t = 'dark';
  var r = document.documentElement;
  if(dark[t]) r.classList.add('dark'); else r.classList.remove('dark');
  if(wallpaper[t]) r.classList.add('theme-wallpaper');
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
    <Html lang='ar' dir='rtl' className='dark'>
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
          href='https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap'
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
