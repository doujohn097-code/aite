import NotFound from './404';
import type { GetServerSideProps } from 'next';

export default function Redirect(): JSX.Element {
  return <NotFound />;
}

// إرجاع حالة 404 حقيقية للمسارات غير المعروفة حتى لا تفهرس محركات البحث
// صفحات فارغة (كانت تُقدَّم سابقًا بحالة 200 رغم عرض واجهة عدم الوجود).
export const getServerSideProps: GetServerSideProps = () =>
  Promise.resolve({ notFound: true });
