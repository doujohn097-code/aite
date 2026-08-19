import Head from 'next/head';

export function AppHead(): JSX.Element {
  return (
    <Head>
      <title>Aite</title>
      <meta name='og:title' content='Aite' />
      <link rel='icon' href='/favicon.ico' sizes='any' />
      <link rel='icon' type='image/png' href='/assets/logo.png' />
      <link rel='apple-touch-icon' href='/logo192.png' />
      <link rel='manifest' href='/site.webmanifest' key='site-manifest' />
    </Head>
  );
}
