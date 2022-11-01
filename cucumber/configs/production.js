/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import envVal from '../../common/helpers/env-val';

module.exports = {
  wsPort: envVal('WS_PORT', 3040),
  apiToken: envVal('API_TOKEN', '{your-api-token}'),
  webSitesAPIToken: envVal('WEBSITE_API_TOKEN', '{token-created-from-admin-console}'),
  cucumber: {
    users: {
      leasing: {
        email: 'bill@reva.tech',
        password: '{your-default-user-password}',
      },
    },
    tenantName: 'cucumber',
    websiteName: 'web',
    adminTenantName: 'admin',
    coredbContainerName: envVal('COREDB_CONTAINER_NAME', 'local_coredb_1'),
    coredbAdminUser: envVal('COREDB_ADMIN_USER', 'revaadmin'),
    coredbAdminPassword: envVal('COREDB_ADMIN_PASSWORD', '{your-default-admin-db-password}'),
    enablePhoneSupport: envVal('CUCUMBER_PHONE_SUPPORT', false),
    domain: envVal('DOMAIN', 'prod.env.reva.tech'),
    rentappSubdomainName: 'application',
    resexpSubdomainName: 'resident',
    authSubdomainName: 'auth',
    selenium: {
      browser: {
        name: envVal('SELENIUM_BROWSER', 'CHROME_LOCAL'),
        path: envVal('BROWSER_PATH'),
      },
      port: envVal('SELENIUM_PORT', 4444),
      domain: envVal('SELENIUM_DOMAIN', 'ci.corp.reva.tech'),
      protocol: envVal('SELENIUM_PROTOCOL', 'http://'),
      platform: envVal('SELENIUM_PLATFORM', 'LINUX'),
      activeWaitTimeout: 30000,
      setScriptTimeout: 30000,
      pageLoadTimeout: 30000,
      defaultTimeout: 3 * 120000,
    },
    provisioningTimeout: envVal('CUCUMBER_TENANT_PROVISIONING_TIMEOUT', 180000),
    plivo: [
      {
        cloudEnv: 'cucumber-1',
        emptyAppId: 'plivoEmptyJenkinsSlave1AppId',
        phoneNumber: '16504466744',
      },
      {
        cloudEnv: 'cucumber-1',
        emptyAppId: 'plivoEmptyJenkinsSlave1AppId',
        phoneNumber: '19513964488',
      },
      {
        cloudEnv: 'cucumber-2',
        emptyAppId: 'plivoEmptyJenkinsSlave2AppId',
        phoneNumber: '16504466736',
      },
      {
        cloudEnv: 'cucumber-2',
        emptyAppId: 'plivoEmptyJenkinsSlave2AppId',
        phoneNumber: '19513964509',
      },
      {
        cloudEnv: 'cucumber-3',
        emptyAppId: 'plivoEmptyJenkinsSlave3AppId',
        phoneNumber: '14083379248',
      },
      {
        cloudEnv: 'cucumber-3',
        emptyAppId: 'plivoEmptyJenkinsSlave3AppId',
        phoneNumber: '19513964506',
      },
      {
        cloudEnv: 'cucumber-4',
        emptyAppId: 'plivoEmptyJenkinsSlave4AppId',
        phoneNumber: '12096004829',
      },
      {
        cloudEnv: 'cucumber-4',
        emptyAppId: 'plivoEmptyJenkinsSlave4AppId',
        phoneNumber: '19513964504',
      },
      {
        cloudEnv: 'cucumber-5',
        emptyAppId: 'plivoEmptyJenkinsSlave5AppId',
        phoneNumber: '14084782512',
      },
      {
        cloudEnv: 'cucumber-5',
        emptyAppId: 'plivoEmptyJenkinsSlave5AppId',
        phoneNumber: '19513964502',
      },
      {
        cloudEnv: 'cucumber-6',
        emptyAppId: 'plivoEmptyJenkinsSlave6AppId',
        phoneNumber: '16572394613',
      },
      {
        cloudEnv: 'cucumber-6',
        emptyAppId: 'plivoEmptyJenkinsSlave6AppId',
        phoneNumber: '19513963706',
      },
      {
        cloudEnv: 'cucumber-7',
        emptyAppId: 'plivoEmptyJenkinsSlave7AppId',
        phoneNumber: '13072029857',
      },
      {
        cloudEnv: 'cucumber-7',
        emptyAppId: 'plivoEmptyJenkinsSlave7AppId',
        phoneNumber: '19513964197',
      },
      {
        cloudEnv: 'cucumber-8',
        emptyAppId: 'plivoEmptyJenkinsSlave8AppId',
        phoneNumber: '13072029906',
      },
      {
        cloudEnv: 'cucumber-8',
        emptyAppId: 'plivoEmptyJenkinsSlave8AppId',
        phoneNumber: '19513964160',
      },
      {
        cloudEnv: 'cucumber-9',
        emptyAppId: 'plivoEmptyJenkinsSlave9AppId',
        phoneNumber: '16267847250',
      },
      {
        cloudEnv: 'cucumber-9',
        emptyAppId: 'plivoEmptyJenkinsSlave9AppId',
        phoneNumber: '17404588440',
      },
      {
        cloudEnv: 'cucumber-10',
        emptyAppId: 'plivoEmptyJenkinsSlave10AppId',
        phoneNumber: '14087859154',
      },
      {
        cloudEnv: 'cucumber-10',
        emptyAppId: 'plivoEmptyJenkinsSlave10AppId',
        phoneNumber: '19513963989',
      },
      {
        cloudEnv: 'cucumber-dev',
        emptyAppId: 'plivoEmptyCucumberDevAppId',
        phoneNumber: '14083379487',
      },
      {
        cloudEnv: 'cucumber-dev',
        emptyAppId: 'plivoEmptyCucumberDevAppId',
        phoneNumber: '19513964515',
      },
    ],
    mail: {
      usersMap: {
        user1: {
          email: 'qatest@reva.tech',
          password: '{your-password-to-google-email-account}',
          directEmail: 'qatestcrm+',
          addAlias: true,
          imap: {
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            authTimeout: 30000,
          },
        },
        user2: {
          email: 'qatest2+sendinvite@reva.tech',
          directEmail: 'qatestcrm+',
        },
        invalidUser1: {
          email: 'test@',
          directEmail: 'qatestcrm',
        },
        invalidUser2: {
          // no email
          email: '',
          directEmail: 'qatestcrm',
        },
        userAlreadyInvited: {
          email: 'danny@reva.tech',
          directEmail: 'qatestcrm',
        },
      },
      defaultTimeout: 15000,
    },
  },
};
