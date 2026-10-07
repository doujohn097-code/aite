import { adminAuth, adminFirestore } from '@lib/firebase-admin';
import { usernameToInternalEmail } from '@lib/utils';
import type { auth as adminAuthTypes } from 'firebase-admin';

export type AuthUserRecord = adminAuthTypes.UserRecord;

/** اسم المستخدم المحفوظ في Firestore لوثيقة المستخدم. */
export async function getProfileUsername(uid: string): Promise<string | null> {
  if (!adminFirestore || !uid) return null;

  try {
    const snapshot = await adminFirestore.collection('users').doc(uid).get();
    if (!snapshot.exists) return null;

    const username = (snapshot.data()?.username ?? null) as string | null;
    return typeof username === 'string' && username.trim()
      ? username.trim().replace(/\s+/g, '').toLowerCase()
      : null;
  } catch {
    return null;
  }
}

/** البحث عن المستخدم في Firestore عبر اسم المستخدم (عندما لا نملك uid). */
export async function getUidByUsername(
  username: string
): Promise<string | null> {
  if (!adminFirestore || !username) return null;

  const cleaned = username.trim().replace(/\s+/g, '').toLowerCase();
  if (!cleaned) return null;

  try {
    const snapshot = await adminFirestore
      .collection('users')
      .where('username', '==', cleaned)
      .limit(1)
      .get();
    return snapshot.empty ? null : snapshot.docs[0].id;
  } catch {
    return null;
  }
}

/**
 * يجلب حساب المصادقة الخاص بالمستخدم: أولًا عبر uid، وإن لم يوجد
 * فعبر البريد الداخلي المشتق من اسم المستخدم.
 */
export async function findAuthUser(
  uid: string,
  username?: string | null
): Promise<AuthUserRecord | null> {
  if (!adminAuth) return null;

  if (uid) {
    try {
      return await adminAuth.getUser(uid);
    } catch {
      // نكمل بالبحث عبر البريد الداخلي
    }
  }

  if (username) {
    try {
      return await adminAuth.getUserByEmail(usernameToInternalEmail(username));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * يضمن أن بريد حساب المصادقة مطابق لاسم المستخدم الحالي.
 *
 * تسجيل الدخول في التطبيق يتم عبر بريد داخلي مشتق من اسم المستخدم،
 * لذلك أي تغيير لاسم المستخدم دون تحديث البريد يجعل الدخول مستحيلًا
 * مهما كانت كلمة السر صحيحة. هذه الدالة تصلح هذا الانحراف.
 *
 * تعيد البريد الذي يجب استخدامه لتسجيل الدخول.
 */
export async function syncAuthEmailWithUsername(
  record: AuthUserRecord,
  username?: string | null
): Promise<string> {
  const currentEmail = (record.email ?? '').toLowerCase();

  if (!adminAuth || !username) return currentEmail;

  const expected = usernameToInternalEmail(username).toLowerCase();
  if (currentEmail === expected) return currentEmail;

  // لا نلمس الحسابات ذات البريد الحقيقي (غير البريد الداخلي) إن وُجدت
  if (currentEmail && !currentEmail.endsWith('@aite.local'))
    return currentEmail;

  try {
    // قد يكون البريد المتوقع محجوزًا بحساب يتيم — نحرره أولًا
    try {
      const clash = await adminAuth.getUserByEmail(expected);
      if (clash.uid !== record.uid)
        await adminAuth.updateUser(clash.uid, {
          email: `orphan-${clash.uid.slice(0, 8)}-${Date.now()}@aite.local`
        });
    } catch {
      // لا يوجد تعارض
    }

    await adminAuth.updateUser(record.uid, {
      email: expected,
      emailVerified: true
    });
    return expected;
  } catch (error) {
    console.error('syncAuthEmailWithUsername failed:', error);
    return currentEmail;
  }
}
