import { SEO } from '@components/common/seo';

/**
 * سياسة الخصوصية — متاحة على /privacy
 * مطلوبة لـ Google Play وCloudflare. المحتوى مطابق لمعالجة البيانات الفعلية
 * في المنصة (Firebase Auth/Firestore/FCM + Cloudflare Workers/R2 + iTunes API).
 * آخر تحديث للمحتوى: أكتوبر 2026.
 */

const LAST_UPDATED = 'أكتوبر 2026 / Octobre 2026 / October 2026';
const CONTACT_EMAIL = 'salemdopamine@gmail.com';

type Section = { title: string; paragraphs?: string[]; list?: string[] };

const arSections: Section[] = [
  {
    title: '١ — من نحن',
    paragraphs: [
      'Aite («نحن») منصة تواصل اجتماعي جزائرية تعمل عبر موقعها الإلكتروني وتطبيقها لنظام أندرويد. يدير المنصة المطوّر Salem Ahmed.',
      `أي سؤال متعلق بالخصوصية يمكن إرساله إلى: ${CONTACT_EMAIL}`
    ]
  },
  {
    title: '٢ — البيانات التي نجمعها',
    list: [
      'بيانات الحساب: اسم المستخدم، البريد الإلكتروني، الاسم المعروض، الصورة الشخصية، صورة الغلاف، النبذة، والجنس (اختياري عند إعداد الحساب). تُدار المصادقة عبر Firebase Authentication (باسم مستخدم وكلمة مرور أو عبر حساب Google).',
      'المحتوى الذي تنشره: المنشورات النصية والصور ومقاطع الفيديو وملفات GIF، الريلز، القصص، التعليقات، الإعجابات، إعادات النشر، المحفوظات، والرسائل الخاصة (نصوص، صور، فيديو، رسائل صوتية).',
      'بيانات الجهاز والتشغيل: معرّف إشعارات Firebase (FCM) لتوصيل الإشعارات الفورية، ولغة الواجهة، وإعدادات التخصيص (الثيم والألوان) المحفوظة محلياً على جهازك، إضافة إلى إجراءات أمان أساسية للحماية من الاستخدام المسيء (مثل App Check / reCAPTCHA عند تفعيلها).',
      'استعلامات البحث: استعلامات البحث عن الموسيقى تُرسل إلى خدمة Apple iTunes Search لإرجاع المعاينات.'
    ]
  },
  {
    title: '٣ — كيف نستخدم البيانات',
    list: [
      'تشغيل الخدمة: إنشاء حسابك، مصادقتك، وعرض ملفك ومحتواك للمستخدمين وفق إعداداتك.',
      'توصيل الميزات: الرسائل الخاصة، الإشعارات الفورية، القصص والتفاعلات.',
      'الأمان: منع الرسائل المزعجة والاستخدام المسيء والوصول غير المصرّح به.',
      'تحسين الخدمة: فهم الأعطال والأداء لتقديم تجربة أفضل.'
    ]
  },
  {
    title: '٤ — معالجو الطرف الثالث',
    paragraphs: [
      'نستعين بمزودي خدمات مهنيين يعالجون البيانات لحسابنا وفق شروط الخدمة وسياسات الخصوصية الخاصة بهم:'
    ],
    list: [
      'Google Firebase (Authentication وCloud Firestore وCloud Messaging): إدارة الحسابات وقاعدة البيانات والإشعارات.',
      'Cloudflare (Workers وR2): استضافة الموقع وتخزين ملفات الوسائط (الصور والفيديو).',
      'Apple (iTunes Search API): البحث عن معاينات الموسيقى.',
      'Google Play: توزيع تطبيق أندرويد وتحديثاته.'
    ]
  },
  {
    title: '٥ — التخزين والأمان',
    paragraphs: [
      'تُخزَّن بيانات الحساب والمحتوى لدى مزودي الخدمات المذكورين أعلاه داخل مراكز بيانات آمنة، وتُطبَّق قواعد وصول صارمة على قاعدة البيانات بحيث لا يستطيع أي مستخدم الوصول إلى بيانات مستخدم آخر أو تعديلها.',
      'لا نبيع بياناتك، ولا نشاركها مع طرف ثالث لأغراض إعلانية، ولا نستخدمها لإنشاء ملفات تعريف إعلانية.'
    ]
  },
  {
    title: '٦ — التخزين المحلي على جهازك',
    paragraphs: [
      'نستخدم التخزين المحلي للمتصفح/التطبيق لحفظ جلستك وتفضيلاتك (الثيم، اللغة، الحسابات المحفوظة للتبديل السريع). تبقى هذه البيانات على جهازك ويمكنك مسحها في أي وقت من إعدادات التطبيق أو المتصفح.'
    ]
  },
  {
    title: '٧ — حقوقك',
    list: [
      'الوصول والتصحيح: يمكنك عرض بياناتك وتعديلها (الصورة، الغلاف، النبذة، الاسم...) من ملفك الشخصي في أي وقت.',
      'الحذف: يمكنك حذف حسابك نهائياً من داخل التطبيق، مما يؤدي إلى إزالة ملفك ومحتواك وملفاتك من المنصة.',
      'الإشعارات: يمكنك تعطيل الإشعارات أو سحب موافقتها من إعدادات جهازك في أي وقت.',
      'التواصل: لأي طلب متعلق ببياناتك راسلنا على البريد المذكور أعلاه وسنستجيب في أقرب وقت.',
      'أنت مخوّل، بموجب القانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في معالجة المعطيات ذات الطابع الشخصي، بالتقرب من السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي (ANPDP) لأي شكوى.'
    ]
  },
  {
    title: '٨ — الأطفال',
    paragraphs: [
      'الخدمة غير موجّهة للأطفال دون سن 13 سنة، ولا نجمع عن قصد أي بيانات منهم. إذا أنشئ حساباً ينتمي لطفل فلنخبرنا لحذفه فوراً.'
    ]
  },
  {
    title: '٩ — تعديلات السياسة',
    paragraphs: [
      'قد نحدّث هذه السياسة من وقت لآخر لتتوافق مع تطورات الخدمة أو المتطلبات القانونية، وسنشير دائماً إلى تاريخ آخر تحديث أعلى الصفحة. التنبيهات الجوهرية تُعلن داخل التطبيق.'
    ]
  }
];

const frSections: Section[] = [
  {
    title: 'Politique de confidentialité — Aite',
    paragraphs: [
      `Dernière mise à jour : ${LAST_UPDATED}. Aite est un réseau social exploité par Salem Ahmed. Contact : ${CONTACT_EMAIL}.`,
      'Données collectées : informations de compte (identifiant, e-mail, nom affiché, photo, couverture, bio, genre facultatif) via Firebase Authentication ; contenu publié (posts, reels, stories, commentaires, likes, messages privés incluant photos, vidéos et messages vocaux) ; identifiant de notification Firebase (FCM) ; préférences stockées localement sur votre appareil ; requêtes de recherche musicale transmises à l’API iTunes Search d’Apple.',
      'Utilisation : fonctionnement du service, authentification, notifications, sécurité et amélioration de la plateforme.',
      'Sous-traitants : Google Firebase (Auth, Firestore, Cloud Messaging), Cloudflare (hébergement et stockage des médias via Workers et R2), Apple (iTunes Search), Google Play (distribution de l’application).',
      'Nous ne vendons pas vos données et ne les partageons pas à des fins publicitaires.',
      'Vos droits : accès et rectification depuis votre profil, suppression définitive de votre compte depuis l’application, désactivation des notifications à tout moment. Conformément à la loi n° 18-07, vous pouvez saisir l’Autorité nationale de protection des données à caractère personnel (ANPDP).',
      'Le service n’est pas destiné aux enfants de moins de 13 ans.'
    ]
  }
];

const enSections: Section[] = [
  {
    title: 'Privacy Policy — Aite',
    paragraphs: [
      `Last updated: ${LAST_UPDATED}. Aite is a social network operated by Salem Ahmed. Contact: ${CONTACT_EMAIL}.`,
      'Data we collect: account information (username, e-mail, display name, photo, cover, bio, optional gender) processed through Firebase Authentication; content you publish (posts, reels, stories, comments, likes, direct messages including photos, videos and voice notes); the Firebase notification identifier (FCM); preferences stored locally on your device; and music search queries sent to Apple’s iTunes Search API.',
      'How we use it: operating the service, authentication, notifications, security and abuse prevention, and improving the platform.',
      'Third-party processors: Google Firebase (Auth, Firestore, Cloud Messaging), Cloudflare (hosting and media storage via Workers and R2), Apple (iTunes Search), and Google Play (app distribution).',
      'We do not sell your data or share it for advertising purposes.',
      'Your rights: access and correct your data from your profile, permanently delete your account from within the app, and disable notifications at any time. You may contact us at the e-mail above for any data request.',
      'The service is not intended for children under 13.'
    ]
  }
];

function PolicyBody({
  sections,
  ltr
}: {
  sections: Section[];
  ltr?: boolean;
}): JSX.Element {
  return (
    <div dir={ltr ? 'ltr' : undefined} className='flex flex-col gap-8'>
      {sections.map((section) => (
        <section key={section.title} className='flex flex-col gap-3'>
          <h2 className='text-lg font-black text-main-accent-text'>
            {section.title}
          </h2>
          {section.paragraphs?.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className='text-sm leading-7 text-light-secondary dark:text-dark-secondary'
            >
              {paragraph}
            </p>
          ))}
          {section.list?.map((item) => (
            <p
              key={item.slice(0, 40)}
              className='border-r-2 border-light-border pr-3 text-sm leading-7 text-light-secondary dark:border-dark-border dark:text-dark-secondary'
            >
              {item}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function PrivacyPage(): JSX.Element {
  return (
    <main className='flex min-h-app justify-center px-4 py-8'>
      <SEO
        title='سياسة الخصوصية — Aite'
        description='سياسة خصوصية منصة Aite: البيانات المجمعة، كيفية استخدامها، حقوقك وخياراتك.'
      />
      <div className='flex w-full max-w-2xl flex-col gap-10'>
        <header className='flex flex-col gap-2 border-b border-light-border pb-6 dark:border-dark-border'>
          <h1 className='text-2xl font-black'>سياسة الخصوصية</h1>
          <p className='text-sm text-light-secondary dark:text-dark-secondary'>
            Aite — {LAST_UPDATED}
          </p>
          <p className='text-xs text-light-secondary dark:text-dark-secondary'>
            <a className='custom-underline' href='#fr'>
              Français
            </a>
            {' · '}
            <a className='custom-underline' href='#en'>
              English
            </a>
          </p>
        </header>

        <PolicyBody sections={arSections} />

        <div className='border-t border-light-border pt-10 dark:border-dark-border' />
        <section id='fr' className='scroll-mt-20'>
          <PolicyBody sections={frSections} ltr />
        </section>

        <div className='border-t border-light-border pt-10 dark:border-dark-border' />
        <section id='en' className='scroll-mt-20'>
          <PolicyBody sections={enSections} ltr />
        </section>
      </div>
    </main>
  );
}
