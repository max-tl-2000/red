/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * @file
 * The configuration file for the example.
 * @author DocuSign
 */

const env = process.env;

exports.config = {
  templateId: env.DS_TEMPLATE_ID || '413fd950-92ff-4d2d-b296-f2847d1c3d69',

  /** The app's integration key. "Integration key" is a synonym for "client id.' */
  clientId: env.DS_CLIENT_ID || '9a5f7191-1d12-453a-b3fc-d4797df18866',
  /** The guid for the user who will be impersonated.
   *  An email address can't be used.
   *  This is the user (or 'service account')
   *  that the JWT will represent. */
  impersonatedUserGuid: env.DS_IMPERSONATED_USER_GUID || '0aa53e71-08b1-41f5-bdc4-b8f46ec5f45c',
  /** The email address for the envelope's signer. */
  signerEmail: env.DS_SIGNER_EMAIL || 'michael+countersigner@reva.tech',
  /** The name of the envelope's signer. */
  signerName: env.DS_SIGNER_NAME || 'MichaelSigner Migdol',
  /** The email address for the envelope's cc recipient.
   * It can't be the same as the signer's email unless
   * the account is set to enable someone to be repeated in
   * the recipient list. */
  ccEmail: env.DS_CC_EMAIL || 'michael+cc@reva.tech',
  /** The name of the envelope's cc recipient. */
  ccName: env.DS_CC_NAME || 'MichaelCC Migdol',
  /** The private key */
  /** Enter the key as a multiline string value. No leading spaces! */
  privateKey:
    env.DS_PRIVATE_KEY ||
    `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAjaiZZerack1n0ziRWLmSW4eDHMKHQYoBI1LLO/GGWML3rSXr
ox4MC7fzWwy/ZdAni7qJ2yheC34mpJRUGWeyFjABYErUpUZnBIq5pICfCMwLjVI1
jg5zd8BzIe6h6zADfITa4EdGMXv9l4tXtPDyDOllXeH3iTcCxcPiRRcuUemuGmEg
x3fmQZunQDWpY0cl8X4KettiE+IR006jPcFSUDeZ66b5ZN0O0ic6GScjcjvViX4U
i1PabgzWwexEGbVcAHjpFwY81KBvVdHenXMI9wNzDH7XcmvAawdvQOVCd9lmAapw
Ebs19a/T29pTbLDh49pppfqeWXPF8PTqJUNJAQIDAQABAoIBAAZY8eiwcDyIwzh3
yNbS19/x5O+EDZdOSv9CyDhbJJkzwUaDqWOW0X+Gl6kH251WXqiYQZxC7+CFdPn7
wH9JQiBUOII7UCceDg3Uy9KMcIkudW0OFuK9kIci5eB1HCcY8MBisUO1ReFVQYzJ
vF1vTMqZ0bDg0sdAolyWCqdBuDxeJ6FUxCV4B/LcoNEdo11OIXDw3y/6XRzpmTGZ
OwniIKmAR+xGw5QY9aAM1/pGrQTgmDlgs01wj9vUNVYFlzl47QY0Mwmlk9GlyMI1
c7YnhtLfwrQK9IgTAGIQUAkuTqiEbMaxyELQZldR0W2Ub/lNSB2Y1Cp5pYJ2kHb7
ZrzHYh0CgYEA0IPkG2WMfLnRyOw771vp/HXI3y0rL6VhuVpXVlgScX8sRGdFppl2
sGa+OF4z9am7JBklmm1iFrPvuPYIYGD6lAASXbf3zZ44h+ZUag9TFPUUdtruAATB
WtRDrSbwoi+2qDtw1liVHH6s5lua8dmdB4zVTeCw+foy4WQGDlw3/uUCgYEAresS
obv1AkAlFS1HzUj8dlR8ypSB1Un2oIkV7ks8cOZ3K5hMU5zspsoZyHPO3bURKgjw
gtKG7Qz9mFiVl1XUZ3FTNOJa/D5wWpEV2ngmcx54F4iAvmgA6IlM+rN4znE7ZNKM
TjLRc9NcVZdGGKcRyEpeptsA7Il/l94oE+sXI+0CgYEAnIFCJyYTSlKWmT5mxgOx
HmKxwIFAluSE8wBR6Wb1gOa5LSZuatto8IJNaDWcvlkFM9UEGmLbarrnxWY1Z1Gj
Ao8DOgCpKFYHjElfNrQF4gcJsyQj2zO2hRwpJ7/AgZtad+8VhGy8jsSttcEwDTMO
3+ne+DMb4qTep7nRqdmh1dkCgYAaP4cxV6+zpkCygIH8ro5DwZ6P6Hfr29zX/7iK
nVpC49WKg9LJL77bsVbQ1QGcnm43vN+nruRkNHi1nHD/RRnofscDDUKUHUxRruHw
df+/khKn4pcjpYi1j7tJfvq1lYtUPR6l0q+f3n9p/4m5wMVDSE4euqDaEipqnkHI
N8vnRQKBgDhGECIdImMFj7bYnfywUz0XycQNatAARqcBFZQnZkhHIs7N/368bO1n
SPNutxvckQWp4SAn9M1XdUlrs9iK+qo4huyUqQZNS+R+pOnroDSuQlsbsK5rum6J
b3Y7IEj9TmqSZaS14NmIn+ocYpC4w5/0zlASnAVtGUQD6Jb1xFqV
-----END RSA PRIVATE KEY-----
`,
  /** For the Developer Sandbox (demo) use <b>https://account-d.docusign.com</b><br>
   * For production (all sites) use <b>https://account.docusign.com</b> */

  /** The account_id that will be used.
   *  If set to false, then the user's default account will be used.
   *  If an account_id is provided then it must be the guid
   *  version of the account number.
   *  Default: false  */
  targetAccountId: false,
  // The authentication server. DO NOT INCLUDE https:// prefix!
  authServer: env.DS_AUTH_SERVER || 'account-d.docusign.com',
  /** The same value must be set as a redirect URI in the
   *  DocuSign admin tool. This setting is <b>only</b> used for individually granting
   *  permission to the clientId if organizational-level permissions
   *  are not used.
   *  <br><b>Default:</b> <tt>https://www.docusign.com</tt> */
  oAuthConsentRedirectURI: 'https://www.docusign.com',
};
