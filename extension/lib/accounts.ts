// Cookies of the user's own account on a big service (Google, Facebook...).
//
// When you are signed in to Google, the browser keeps your account cookies for
// google.com, and some of them (__Secure-3PSID...) are SameSite=None: they are sent to
// Google whenever any page loads something from google.com (a video, a map, a
// reCAPTCHA). So Google can recognise you there, but because you are signed in, not
// because the site set a cookie after your choice. The database labels them
// marketing, and counting them like any tracker cookie made almost every site look
// "only partly respected" for anyone signed in to Google (screenshots, 2 November 2026).
//
// They are kept apart: listed, with a note, and stated in the checklist as
// information, not as a fault of the site. Only the cookies that exist because you
// are signed in are here; the service's other cookies (NID, datr, bcookie...) are set
// for everyone and still count as usual.

interface Service {
  name: string;
  site: RegExp; // the cookie's domain, without the leading dot
  cookies: ReadonlySet<string>;
}

const GOOGLE_ACCOUNT = new Set([
  'SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'SIDCC', 'LSID', 'LOGIN_INFO',
  '__Secure-1PSID', '__Secure-3PSID', '__Secure-1PAPISID', '__Secure-3PAPISID',
  '__Secure-1PSIDCC', '__Secure-3PSIDCC', '__Secure-1PSIDTS', '__Secure-3PSIDTS',
  '__Secure-1PSIDRTS', '__Secure-3PSIDRTS',
]);

const SERVICES: Service[] = [
  // google.com, google.it, google.co.uk, google.com.br..., and YouTube
  { name: 'Google', site: /(^|\.)(google\.([a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})|youtube\.com)$/, cookies: GOOGLE_ACCOUNT },
  { name: 'Facebook', site: /(^|\.)facebook\.com$/, cookies: new Set(['c_user', 'xs']) },
  { name: 'Instagram', site: /(^|\.)instagram\.com$/, cookies: new Set(['sessionid', 'ds_user_id']) },
  { name: 'LinkedIn', site: /(^|\.)linkedin\.com$/, cookies: new Set(['li_at', 'liap']) },
  { name: 'X', site: /(^|\.)(x|twitter)\.com$/, cookies: new Set(['auth_token', 'twid', 'ct0']) },
];

// The service whose account this cookie belongs to, or undefined.
export function accountService(name: string, domain: string): string | undefined {
  const d = domain.replace(/^\./, '').toLowerCase();
  return SERVICES.find((s) => s.cookies.has(name) && s.site.test(d))?.name;
}
