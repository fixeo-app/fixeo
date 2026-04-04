window.FIXEO_ENV = Object.assign({
  SITE_URL: window.location.origin,
  STATIC_MODE: true,
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  API_BASE: window.location.origin
}, window.FIXEO_ENV || {});
