import { createTransport } from 'nodemailer';
import { firestore, functions, regionalFunctions } from './lib/utils';
import { EMAIL_API, EMAIL_API_PASSWORD, TARGET_EMAIL } from './lib/env';
import type { Tweet, User } from './types';

/** نطاق التطبيق — يُضبط عبر متغير بيئة SITE_URL في دوال Firebase. */
const SITE_URL = process.env.SITE_URL || 'https://aite.vercel.app';

export const notifyEmail = regionalFunctions.firestore
  .document('tweets/{tweetId}')
  .onCreate(async (snapshot): Promise<void> => {
    const user = EMAIL_API.value();
    const pass = EMAIL_API_PASSWORD.value();
    const target = TARGET_EMAIL.value();

    // لا تُرسل بريدًا إذا لم تُضبط بيانات SMTP — بدل انهيار الدالة مع كل
    // منشور جديد عندما تكون الإعدادات غائبة.
    if (!user || !pass || !target) {
      functions.logger.warn(
        'EMAIL_API / EMAIL_API_PASSWORD / TARGET_EMAIL are not configured - skipping email notification.'
      );
      return;
    }

    functions.logger.info('Sending notification email.');

    const { text, createdBy, images, parent } = snapshot.data() as Tweet;

    const imagesLength = images?.length ?? 0;

    const userSnap = await firestore().doc(`users/${createdBy}`).get();
    const author = userSnap.data() as User | undefined;
    const name = author?.name ?? 'مستخدم';
    const username = author?.username ?? 'unknown';

    const client = createTransport({
      service: 'Gmail',
      auth: { user, pass }
    });

    const tweetLink = `${SITE_URL.replace(/\/$/, '')}/tweet/${snapshot.id}`;

    const emailHeader = `New Tweet${
      parent ? ' reply' : ''
    } from ${name} (@${username})`;

    const emailText = `${text ?? 'No text provided'}${
      images ? ` (${imagesLength} image${imagesLength > 1 ? 's' : ''})` : ''
    }\n\nLink to Tweet: ${tweetLink}\n\n- Firebase Function.`;

    await client.sendMail({
      from: user,
      to: target,
      subject: emailHeader,
      text: emailText
    });

    functions.logger.info('Notification email sent.');
  });
