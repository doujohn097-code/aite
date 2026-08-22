import Head from 'next/head';

export function AppHead(): JSX.Element {
  return (
    <Head>
      <title>Aite</title>
      <meta
        name='viewport'
        content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual'
        key='viewport'
      />
      <meta name='og:title' content='Aite' />
      <link rel='icon' href='/favicon.ico' sizes='any' />
      <link rel='icon' type='image/png' href='/assets/logo.png' />
      <link rel='apple-touch-icon' href='/logo192.png' />
      <link rel='manifest' href='/manifest.json' key='site-manifest' />
    </Head>
  );
}
