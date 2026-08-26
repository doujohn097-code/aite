/** حدود النص — أوسع من 280 دون أن تتحول إلى مقالات. */

export const POST_TEXT_MAX = 800;
export const POST_TEXT_MAX_ADMIN = 1200;
export const COMMENT_TEXT_MAX = 600;
export const CAPTION_TEXT_MAX = 800;
export const MESSAGE_TEXT_MAX = 5000;
export const BIO_TEXT_MAX = 220;

/** سقف الخادم/Firestore للمنشورات والأوصاف (يغطي حد المشرف). */
export const CONTENT_STORE_MAX = POST_TEXT_MAX_ADMIN;

export function postTextMax(isAdmin?: boolean): number {
  return isAdmin ? POST_TEXT_MAX_ADMIN : POST_TEXT_MAX;
}
