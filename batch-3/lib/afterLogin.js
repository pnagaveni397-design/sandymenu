// Where a client lands right after logging in or signing up: the separate subscription page
// (plans, free trial, pay + proof), then "Continue to dashboard". Super Admin can turn this off.
const { db } = require("./db");

function postLoginPath(slug) {
  const r = db.prepare("SELECT billing_first FROM platform_settings ORDER BY id DESC LIMIT 1").get();
  return (r?.billing_first ?? 1) !== 0 ? `/dashboard/${slug}/subscription` : `/dashboard/${slug}`;
}

module.exports = { postLoginPath };
