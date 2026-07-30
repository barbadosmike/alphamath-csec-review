/*
 * Deployment-specific, non-secret configuration.
 * Set apiBase to the separately deployed evidence API URL.
 * Never place a database password or API access token in this file.
 */
window.ALPHAMATH_RUNTIME = Object.assign({
  apiBase: "",
  connectedMode: false
}, window.ALPHAMATH_RUNTIME || {});
