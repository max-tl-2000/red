/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable camelcase */
import path from 'path';
import { process } from '../../common/helpers/globals';
import envVal from '../../common/helpers/env-val';
import { commonConfig } from '../../common/server-config';
import { DALTypes } from '../../common/enums/DALTypes';
import { NO_IMAGE_RESIZE } from '../../common/enums/enums';

const env = process.env;
const port = envVal('PORT', 3000);

const apiToken = envVal('API_TOKEN', '{your_api_token}');
const customeroldApiToken = envVal('CUSTOMEROLD_API_TOKEN', '{your_api_token}');
const telephonyApiToken = envVal('TELEPHONY_API_TOKEN', apiToken);
const externalCalendarsApiToken = envVal('EXTERNAL_CALENDARS_API_TOKEN', apiToken);
const rpImageToken = envVal('RP_IMAGE_TOKEN', '{your-reverse-proxy-image-token}');

const localDomain = 'local.env.reva.tech';
const domain = envVal('DOMAIN', localDomain);
const cloudEnv = env.CLOUD_ENV;
const emailDomain = cloudEnv === 'prod' ? 'mail.reva.tech' : envVal('EMAIL_DOMAIN', `${cloudEnv}.envmail.reva.tech`);
const processName = envVal('RED_PROCESS_NAME', 'unknown-process');
const isLocalDB = cloudEnv.startsWith('cucumber') || domain === localDomain;
const isDemoEnv = cloudEnv.startsWith('demo');
const isProdEnv = cloudEnv === 'prod';
const redisServerHost = '{your_redis_aws_host}';
const databaseHost = envVal('DATABASE_HOST', 'coredb');

// TODO: clean this file. server/config should only have the configuration for the
// server part of the leasing module. The db access and other information should be moved
// to the config for the api. There is also info used from rentapp on this config. Either that info
// need to be moved to the rentapp config, to the consumer module or moved to api/config if that info is only needed
// from the api service for rentapp.
// configs for roommates should also be moved to consumer config or moved to api/config
module.exports = {
  port,
  cloudEnv,
  isDemoEnv,
  env, // TODO: why we need the env in the configuration object?  CG: Valid question... We should remove
  apiToken,
  customeroldApiToken,
  telephonyApiToken,
  rpImageToken,
  externalCalendarsApiToken,
  ...commonConfig,
  i18nDebug: false,
  isDevelopment: isLocalDB,
  logMiddlewareErrors: true,
  app: {
    name: 'Core Property Management',
    party: {
      forbiddenLegalNames: ['current', 'resident', 'duplicate', 'party'],
    },
  },
  superAdmin: {
    userName: 'admin',
    preferredName: 'Admin',
    password: envVal('SUPER_ADMIN_PASSWORD', '{your_default_admin_password}'),
  },
  buildVersion: `${envVal('BUILD_VERSION', 'dev')}`,
  mail: {
    emailDomain,
    deleteEmailAfterProcessing: envVal('DELETE_EMAIL_AFTER_PROCESSING', true),
    attachments: {
      supportedFileTypes: [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf',
        'image/png',
        'image/gif',
        'image/jpeg',
        'image/jpg',
        'image/tiff',
      ],
      supportedFileFormats: ['doc', 'docx', 'pdf', 'png', 'gif', 'jpg', 'jpeg', 'tiff'],
      inlineImageSize: 650,
    },
    priceChangesDetected: {
      receiver: envVal('PRICE_CHANGES_RECEIVER', '{email_address_for_alert}'),
      subject: '[action required] Price changes detected: {tenantName}',
      requestUpdateText: 'Please update the pricing spreadsheet to include the following changes:',
    },
    resetPasswordPath: '/resetPassword',

    // TODO: can these all be removed now?
    inviteMailPath: './static/inviteMailTemplate.html',
    resetMailPath: './static/resetMailTemplate.html',
    appointmentConfirmationMailPath: './static/appointmentConfirmationMailTemplate.html',
    appointmentCancellationMailPath: './static/appointmentCancellationMailTemplate.html',
    inviteImportedUserPath: './static/inviteImportedUserTemplate.html',

    inviteMailSubject: 'Your account is ready',
    resetMailSubject: 'Reset your Password',
    appointmentConfirmationMailSubject: 'Appointment confirmed',
    appointmentCancellationMailSubject: 'Appointment cancelled',
    appointmentUpdateMailSubject: 'Appointment updated',
    rentalApplicationLinkMailSubject: 'Rental application - Apply Now',
    guarantorInvitationMailSubject: 'Rental application - Apply Now',
    registration: {
      // TODO: make all path configs consistent in whether they start/stop with slashes
      registrationPath: 'registration/',
      emailTitle: 'Account - Complete Registration',
      emailGreeting: 'Hi {inviteeName},',
      appInvitation:
        'Your rental application was created. Sign in to complete your application at any time. Click the button or follow the link below to create a password.',
      completeRegistrationButtonText: 'COMPLETE REGISTRATION',
      copyableLinkText: 'Link: ',
      linkDurationText: 'This link must be used by midnight.',
      privacyPolicyText: 'Privacy Policy',
      contactUsText: 'Contact Us',
      shortAppDescription: '',
      tenantName: 'auth',
      termsAndConditions: 'Terms and Conditions',
    },
    roommateFinderRegistration: {
      registrationPath: 'registration/',
      emailTitle: 'Your account is ready',
      emailGreeting: 'Welcome to {appName}!',
      appInvitation:
        'An account already exists for this email. Use the link below to create a password and start using Parkmerced Roommate Finder. With Roommate Finder, you are one step closer to finding the right roommate!',
      completeRegistrationButtonText: 'COMPLETE REGISTRATION',
      copyableLinkText: 'Link: ',
      linkDurationText: 'This link will it expire in 24 hours, and can only be used once.',
    },
    genericResetPassword: {
      emailTitle: 'Reset your password',
      emailText: "Don't worry, everyone forgets a password once in a while. Click the button or link to set a new password.",
      footerText:
        "You've received this email because you requested a password reset. If you didn't request a password reset, you may ignore this email. If you're concerned your account is at risk, contact Reva support at {your_support_email}.",
      changePasswordButtonText: 'CHANGE PASSWORD',
      copyableLinkText: 'Link: ',
      linkDurationText: 'This link will expire in 24 hours and can only be used once.',
    },
    genericYourPasswordChanged: {
      emailTitle: 'Your password has been changed',
      emailText: 'You have successfully changed your password for the account {email}. You can now use your new password when logging into {appName}.',
    },
    redAppName: 'Reva',
    redAppInvitation:
      "You're invited to join {0}, the next generation property management solution. Follow the link below to set a password and finish creating your account.",
    redAppShortDescription: '',
    lease: {
      signMailSubject: 'Lease signature',
      voidedLeaseMailSubject: 'Voided lease',
    },
    reactTemplatesPath: '../../resources/react-email-template/templates/',
    reactTemplate: {
      declinedApplication: 'DeclinedApplicationTemplate',
      appointmentMail: 'AppointmentTemplate',
      quoteMail: 'QuoteMailTemplate',
    },
    reactMjmlTemplatesPath: '../../resources/react-mjml-templates/',
    component: {
      quote: 'QuoteTemplate',
      renewalQuote: 'RenewalQuoteTemplate',
      priceChanges: 'PriceChangesTemplate',
      avatar: 'AvatarTemplate',
    },
  },
  smsTemplateBasePath: '../../static/',
  smsTemplateNameMap: {
    // TODO: This object will have to be removed when all the sms templates are ready
    quoteSmsTemplate: 'quoteSmsTemplate.tpl',
    applicationInvitationSmsTemplate: 'applicationInvitationSmsTemplate.tpl',
    appointmentCancelledSmsTemplate: 'en-appointmentCancelledSmsTemplate.tpl',
    appointmentConfirmedSmsTemplate: 'en-appointmentConfirmedSmsTemplate.tpl',
    appointmentUpdatedSmsTemplate: 'en-appointmentUpdatedSmsTemplate.tpl',
  },
  tokens: {
    validPeriodInDays: 1,
    api: envVal('API_TOKEN', '{your_api_token}'),
    internalApi: envVal('INTERNAL_API_TOKEN', '{your_internal_api_token}'),
  },
  fetchLeaseStatus: {
    periodUnit: 3, // period in hours for which we go back and fetch the lease status for the leases
  },
  knexConfig: {
    client: 'postgresql',
    connection: {
      host: databaseHost,
      database: 'reva_core',
      user: 'revauser',
      port: envVal('DATABASE_PORT', 5432),
      password: envVal('DATABASE_PASSWORD', '{your_default_db_password}'),
      adminUser: 'revaadmin',
      adminPassword: envVal('DATABASE_ADMINPASSWORD', '{your_default_admin_db_password}'),
      replicationUser: 'revareplication',
      replicationPassword: envVal('DATABASE_REPLICATIONPASSWORD', '{your_default_replication_db_password'),
      role: 'revauser_role',
      application_name: processName,
      charset: 'utf8',
    },
    pool: {
      min: 2,
      max: isLocalDB ? 25 : envVal('DATABASE_MAX_CONNECTIONS', 50),
    },
    seeds: {
      directory: path.resolve(__dirname, '../database/seeds/'),
    },
    migrations: {
      directory: path.resolve(__dirname, '../database/migrations'),
      tableName: 'knex_migrations',
    },
    asyncStackTraces: false,
  },
  knexConfigReadOnly: {
    client: 'postgresql',
    connection: {
      host: envVal('DATABASE_RO_HOST', 'coredb'),
      database: 'reva_core',
      user: 'revauser',
      port: envVal('DATABASE_PORT', 5432),
      password: envVal('DATABASE_PASSWORD', '{your_default_db_password}'),
      adminUser: 'revaadmin',
      adminPassword: envVal('DATABASE_ADMINPASSWORD', '{your_default_admin_db_password}'),
      role: 'revauser_role',
      application_name: processName,
      charset: 'utf8',
    },
    pool: {
      min: 2,
      max: isLocalDB ? 25 : envVal('DATABASE_MAX_CONNECTIONS', 50),
    },
    asyncStackTraces: false,
  },
  import: {
    batchSize: 1000,
    allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.pdf', '.jfif'],
    allowedVoiceMessageExtensions: ['.mp3'],
    assetMaxFileSize: envVal('ASSET_MAX_FILE_SIZE', 2.5), // megabytes
    leaseTemplatePath: 'server/workers/lease/fakeLeaseTemplate.json',
    users: {
      defaultPassword: envVal('USER_DEFAULT_PASSWORD', '{your_default_user_password}'),
      revaAdminPassword: envVal('USER_REVAADMIN_PASSWORD', '{your_default_admin_user_password}'),
    },
    sftp: {
      authToken: '{your_sftp_auth_token}',
      defaultPassword: '{your_sftp_default_user_password}',
      defaultLROPassword: '{your_sftp_default_lro_user_password}',
      cipherKey: envVal('SFTP_CIPHER_KEY', '{your_sftp_cipher_key}'),
    },
    phonePlaceHolder: /%phone\[\d+\]%/,
    phoneAreaPreferencesPlaceHolder: /%phone\["area_code_preferences":\[(["\d,*]*)\]\]%/,
    phoneAliasToIgnore: '%ignore%',
    phoneNumberValue: /^\d{11}/,
    overrideContactInfo: !isProdEnv,
  },
  quote: {
    tokenExpiration: '2year',
  },
  rentapp: {
    hostname: envVal('RENTAPP_HOSTNAME', 'application'),
    signature: 'Reva Technology Inc.',
    tokenExpiration: '180d', // e.g: 10h, 7d
    confirmResetPasswordUrl: '/confirmResetPassword',
    welcomeUrl: '/welcome',
  },
  resident: {
    hostname: envVal('RESIDENT_HOSTNAME', 'resident'),
    signInUrl: envVal('RESIDENT_SIGN_IN_URL', '/auth/signInPassword'),
    resetPasswordUrl: envVal('RESIDENT_RESET_PASSWORD_URL', '/auth/resetPassword'),
    resetPasswordTokenExpiration: envVal('RESIDENT_RESET_PASSWORD_TOKEN_EXPIRATION', '1d'),
    postUrl: '/app/home/feed/:postId',
    directMessageUrl: envVal('RESIDENT_DIRECT_MESSAGE_URL', '/app/messages'),
    directMessageTokenExpiration: envVal('RESIDENT_DIRECT_MESSAGE_TOKEN_EXPIRATION', '60d'),
    registrationUrl: envVal('RESIDENT_REGISTRATION_URL', '/auth/registration'),
    registrationTokenExpiration: envVal('RESIDENT_REGISTRATION_TOKEN_EXPIRATION', '60d'),
    deepLinkUrl: envVal('RESIDENT_DEEP_LINK_URL', '/resident/api/deepLink'),
    unsubscribeLink: envVal('UNSUBSCRIBE_LINK', '/notification/unsubscribe'),
    residentMobileTokenExpiration: envVal('RESIDENT_MOBILE_TOKEN_EXPIRATION', '3y'),
  },
  telephony: {
    ringCentral: {
      appKey: envVal('RINGCENTRAL_APP_KEY', '{your_ringcentral_app_key}'),
      secret: envVal('RINGCENTRAL_APP_SECRET', 'your_ringcentral_app_secret'),
      server: envVal('RINGCENTRAL_SERVER', 'https://platform.devtest.ringcentral.com'),
      authUrl: envVal('RINGCENTRAL_AUTH_CALLBACK', '/RingCentralTokenRefreshPage'),
      notificationUrl: envVal('RINGCENTRAL_NOTIFICATION_CALLBACK', '/api/webhooks/ringCentralNotificationCallback'),
    },
    plivoAuth: {
      authId: envVal('PLIVO_AUTH_ID', '{your_plivo_auth_id}'),
      authToken: envVal('PLIVO_AUTH_TOKEN', '{your_plivo_auth_token}'),
    },
    plivoEmptyAppId: envVal('PLIVO_EMPTY_APP_ID', '18274299380634798'),
    plivoEmptyCucumberAppId: envVal('PLIVO_CUCUMBER_EMPTY_APP_ID', '29654806439757896'),
    plivoEmptyJenkinsSlave1AppId: envVal('PLIVO_JENKINS_SLAVE_1_EMPTY_APP_ID', '33651759172593557'),
    plivoEmptyJenkinsSlave2AppId: envVal('PLIVO_JENKINS_SLAVE_2_EMPTY_APP_ID', '23058159075048058'),
    plivoEmptyJenkinsSlave3AppId: envVal('PLIVO_JENKINS_SLAVE_3_EMPTY_APP_ID', '23961132505199768'),
    plivoEmptyJenkinsSlave4AppId: envVal('PLIVO_JENKINS_SLAVE_4_EMPTY_APP_ID', '24665007226744544'),
    plivoEmptyJenkinsSlave5AppId: envVal('PLIVO_JENKINS_SLAVE_5_EMPTY_APP_ID', '25530484423651291'),
    plivoEmptyJenkinsSlave6AppId: envVal('PLIVO_JENKINS_SLAVE_6_EMPTY_APP_ID', '26756783389790288'),
    plivoEmptyJenkinsSlave7AppId: envVal('PLIVO_JENKINS_SLAVE_7_EMPTY_APP_ID', '27431245052142456'),
    plivoEmptyJenkinsSlave8AppId: envVal('PLIVO_JENKINS_SLAVE_8_EMPTY_APP_ID', '28486744737814827'),
    plivoEmptyJenkinsSlave9AppId: envVal('PLIVO_JENKINS_SLAVE_9_EMPTY_APP_ID', '29506249960062693'),
    plivoEmptyJenkinsSlave10AppId: envVal('PLIVO_JENKINS_SLAVE_10_EMPTY_APP_ID', '12597582412692108'),
    statusUrl: envVal('PLIVO_SMS_STATUS_URL', '/api/webhooks/sms/status'),
    messageUrl: envVal('PLIVO_MESSAGE_URL', '/api/webhooks/sms'),
    answerUrl: envVal('PLIVO_ANSWER_URL', '/api/webhooks/directDial'),
    hangupUrl: envVal('PLIVO_HANGUP_URL', '/api/webhooks/directDial'),
    postCallUrl: envVal('PLIVO_POSTCALL_URL', '/api/webhooks/postDial'),
    callRecordingUrl: envVal('PLIVO_RECORD_URL', '/api/webhooks/callRecording'),
    dialCallbackUrl: envVal('PLIVO_DIALCALLBACK_URL', '/api/webhooks/callbackDial'),
    digitsPressedUrl: envVal('PLIVO_DIGITS_PRESSED_URL', '/api/webhooks/digitsPressed'),
    conferenceCallbackUrl: envVal('PLIVO_CONFERENCE_CALLBACK_URL', '/api/webhooks/conferenceCallback'),
    callReadyForDequeueUrl: envVal('PLIVO_CALL_READY_FOR_DEQUEUE_URL', '/api/webhooks/callReadyForDequeue'),
    guestMessageUrl: envVal('PLIVO_GUEST_MESSAGE_URL', '/api/webhooks/guest-sms-receiver'),
    transferFromQueueUrl: envVal('PLIVO_TRANSFER_FROM_QUEUE_URL', '/api/webhooks/transferFromQueue'),
    transferToVoicemailUrl: envVal('PLIVO_TRANSFER_TO_VOICEMAIL', '/api/webhooks/transferToVoicemail'),
    agentCallForQueueUrl: envVal('PLIVO_AGENT_CALL_FOR_QUEUE_URL', '/api/webhooks/agentCallForQueue'),
    twilioAuth: {
      authId: envVal('TWILIO_AUTH_ID', '{your_twilio_auth_id}'),
      authToken: envVal('TWILIO_AUTH_TOKEN', '{your_twilio_auth_token}'),
    },
    ringTimeBeforeVoicemail: 25, // seconds
    voiceMailMaxRecordingDuration: 180, // seconds
    callMaxRecordingDuration: 3600, // seconds
    stopRecordingVoiceMailKey: '*',
    incomingRedialMaxAttempts: 4,
    timeoutBeforeRedial: 5000, // milliseconds
    timeoutBeforeOneMemberConferenceEnds: 2000, // milliseconds
    minCallTimeInQueue: 10, // seconds
    audioAssetsUrl: 'http://audio.reva.tech',
    queuedOwnedCallersPriority: 180, // seconds
    timeoutBeforeHandlingAfterCallOperations: 2000, // milliseconds
    timeoutBeforeHandlingAfterCallOperationsRetry: 20000, // milliseconds
    timeoutBeforeRequestingCallDetails: 10000, // milliseconds
    forceQueueDisabled: isDemoEnv,
    callQueueUserAvailabilityDelay: 2000, // milliseconds
  },
  reverseProxy: {
    url: 'https://rp.reva.tech',
  },
  aws: {
    accessKeyId: envVal('AWS_ACCESS_KEY_ID', '{your_aws_access_key_id}'),
    secretAccessKey: envVal('AWS_SECRET_ACCESS_KEY', '{your_aws_secret_access_key}'),
    region: envVal('AWS_REGION', 'us-east-1'),
    s3AssetsBucket: envVal('AWS_S3_ASSETS_BUCKET', '{your-bucket-prefix}-prod-assets'),
    s3PrivateBucket: envVal('AWS_S3_PRIVATE_BUCKET', '{your-bucket-prefix}-prod-private'),
    s3ShortenerBucket: envVal('AWS_S3_SHORTENER_BUCKET', '{your-bucket-prefix}-prod-urlshortener'),
    s3EncryptionKeyId: envVal('AWS_S3_ENCRYPTION_KEY_ID', '{your-bucket-encryption-key}'),
    signatureVersion: 'v4',
    efsRootFolder: envVal('EFS_ROOT_FOLDER', path.resolve('/efs', cloudEnv, 'tenants')),
    deletePostRecipientFileDelay: ('DELETE_POST_RECIPIENT_RESULT_FILE', '300000'),
  },
  sendGrid: {
    apiKey: envVal('SENDGRID_API_KEY', '{your-sendgrid-api-key}'),
    fromEmailAddress: envVal('FROM_EMAIL_ADDRESS', 'no-reply@mail.reva.tech'),
    maxEmailRecipients: envVal('MAX_EMAIL_RECIPIENTS', 999),
    deleteTemplateDelay: envVal('DELETE_TEMPLATE_DELAY', '300000'),
  },
  quoteDraft: {
    defaultTerms: [12, 6],
  },
  urlShortener: {
    cdn_prefix: envVal('URL_SHORTENER_PREFIX', 't.reva.tech'),
  },

  recurringJobs: {
    interval: envVal('RECURRING_JOBS_INTERVAL', 60), // seconds
  },
  rasa: {
    webhookUrl: envVal('RASA_WEBHOOK_URL', '/webhooks/rest/webhook'),
    domainUrl: envVal('RASA_DOMAIN', 'http://localhost:5005'),
  },
  fadv: {
    contract: {
      testHostname: 'qa.xmlportal.residentdata.com',
      ctHostname: 'ct.xmlportal.residentdata.com',
      uatHostname: 'xmlportal-uat.residentdata.com',
      productionHostname: 'xmlportal.residentdata.com',
      endpointPath: '/residentscreening/ResidentFormAPI.asmx',
    },
  },
  bluemoon: {
    contract: {
      testHostname: 'api.bluemoonforms.com',
      productionHostname: 'api.bluemoonforms.com',
      testWebsite: 'https://bluemoonforms.com',
      productionWebsite: 'https://bluemoonforms.com',
      // we can autogin by suffxing with the following: '&autoLogin=1&PASSWORD=%password%&rememberMe=true'
      loginPath: '/?p=login&loginType=standard&breadcrumb=&SERIALNUMBER=%serial%&USERID=%userId%',
      oauthTokenPath: '/oauth/token',
      clientId: 27,
      clientSecret: envVal('BLUEMOON_CLIENT_SECRET', ''),
    },
  },
  defaultCommsCategories: [
    DALTypes.CommunicationCategory.USER_COMMUNICATION,
    DALTypes.CommunicationCategory.APPOINTMENT,
    DALTypes.CommunicationCategory.LEASE,
    DALTypes.CommunicationCategory.APPLICATION_DECLINED,
    DALTypes.CommunicationCategory.QUOTE,
    DALTypes.CommunicationCategory.APPLICATION_INVITE,
  ],
  zendesk: {
    secretAuth: envVal('ZENDESK_AUTH_SECRET', '{your-zendesk-auth-secret}'),
    secretPrivateContent: envVal('ZENDESK_PRIVATE_CONTENT_SECRET', '{your-zendesk-private-content-secret}'),
    algorithm: 'HS256',
    cookieName: 'zendesk_reva_user',
    cookieDomain: 'reva.tech',
    cookieExpirationDays: 5,
    domain: envVal('ZENDESK_DOMAIN', 'reva.zendesk.com'),
    ssoEndPoint: envVal('ZENDESK_SSO_ENDPOINT', 'https://reva.zendesk.com/access/jwt?jwt='),
    urlCreateTicket: 'https://reva.zendesk.com/hc/en-us/requests/new',
    urlHelpCenter: 'https://reva.zendesk.com/hc/en-us',
    refreshPrivateContentTokenPeriod: envVal('ZENDESK_REFRESH_PRIVATE_CONTENT_TOKEN_PERIOD', 1800000), //  miliseconds
    learnMoreLeaseStartPreceedUnitAvailability: envVal(
      'ZENDESK_LEASE_START_PRECEED_UNIT_AVAILABILITY',
      'https://reva.zendesk.com/hc/en-us/articles/360008497714',
    ),
  },
  sisense: {
    domain: envVal('SISENSE_DOMAIN', 'reporting-staging.reva.tech'),
    ssoSecret: envVal('SISENSE_AUTH_SECRET', '{your-sisense-auth-secret}'),
    cookieExpirationDays: envVal('SISENSE_COOKIE_EXP_DAYS', 5),
    cookieName: envVal('SISENSE_COOKIE_NAME', 'sisense_reva_user'),
    cookieDomain: envVal('SISENSE_COOKIE_DOMAIN', 'reva.tech'),
    algorithm: 'HS256',
  },
  fullStory: {
    refreshPeriod: 600000,
    debugMode: false,
    host: 'fullstory.com',
    org: envVal('FULLSTORY_ORG', ''),
    namespace: 'FS',
  },
  mri: {
    mri_s: {
      apiUrl: envVal('MRI_S_API_URL', 'https://mridev.{your-company}.com/mriweb/mriapiservices/api.asp'),
      credentials: {
        user: envVal('MRI_S_API_USER', '{your-mri-api-user}'),
        password: envVal('MRI_S_API_PASSWORD', '{your-mri-api-password}'),
      },
    },
    mri_api: {
      apiUrl: envVal('MRI_API_URL', 'https://apidev.{your-company}.com/mri_api/api/'),
      credentials: {
        user: envVal('MRI_API_USER', '{your-mri-api-user}'),
        password: envVal('MRI_API_PASSWORD', '{your-mri-api-password}'),
      },
    },
    requestTimeout: 90000,
  },
  calendar: {
    defaultTeamSlotDuration: 60, // minutes
    webInquiryFirstAvailableSlotOffset: 30, // minutes
  },
  externalCalendars: {
    calendarEventTemplate: '../../static/en-externalCalendarEventTemplate.tpl',
    cronofy: {
      clientId: envVal('CRONOFY_CLIENT_ID', '{your-cronofy-client-id}'),
      clientSecret: envVal('CRONOFY_CLIENT_SECRET', '{your-cronofy-client-secret}'),
      authorizationUrl: 'https://app.cronofy.com/oauth/authorize',
      authorizationUrlForEC: 'https://app.cronofy.com/enterprise_connect/oauth/authorize',
      delegatedAccessUrl: envVal('CRONOFY_DELEGATED_ACCESS_CALLBACK', '/api/webhooks/externalCalendarDelegatedAccessCallback'),
      userRevaEventUpdatedUrl: envVal('CRONOFY_USER_REVA_EVENT_UPDATED_CALLBACK', '/api/webhooks/userRevaCalendarEventUpdated'),
      userPersonalEventUpdatedUrl: envVal('CRONOFY_USER_PERSONAL_EVENT_UPDATED_CALLBACK', '/api/webhooks/userPersonalCalendarEventUpdated'),
      teamEventUpdatedUrl: envVal('CRONOFY_TEAM_EVENT_UPDATED_CALLBACK', '/api/webhooks/teamCalendarEventUpdated'),
      externalCalendarRsvpNotificationUrl: envVal('CRONOFY_EVENT_RSPV_CALLBACK', '/api/webhooks/externalCalendarRsvpStatus'),
    },
  },
  communications: {
    templates: {
      support: {
        email: envVal('COMMS_TEMPLATE_SUPPORT_EMAIL'),
        subject: '{tenantName} Failed to deliver {templateName}',
      },
    },
  },
  redis: {
    connection: {
      host: envVal('REDIS_SERVER_HOST', redisServerHost),
      port: 6379,
      socket_keepalive: true,
      enable_offline_queue: false,
      password: envVal('REDIS_AUTH', '{your-redis-auth}'),
      tls: { servername: envVal('REDIS_SERVER_HOST', redisServerHost) },
      prefix: cloudEnv,
    },
  },
  renewals: {
    defaultRenewalCycleStartValue: 60,
  },
  residentServices: {
    defaultMoveoutNoticePeriod: 30,
  },
  resizeImageOnUploadTo: envVal('RESIZE_IMAGE_ON_UPLOAD_TO', isLocalDB ? 650 : NO_IMAGE_RESIZE),
  useReadOnlyServer: envVal('READONLY_DB_SERVER', false), // change to true to enable readOnlyServer read
  initialDelayAfterSignOn: 5,
};
