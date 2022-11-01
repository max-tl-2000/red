/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { prepareRawQuery } from '../../../common/schemaConstants';
import { TemplateNames } from '../../../../common/enums/templateTypes';

exports.up = async (knex, { tenantId }) => {
  const now = new Date();

  await knex.raw(
    prepareRawQuery(
      `
       INSERT INTO db_namespace."CommsTemplate"(id, name, "displayName", description, "emailSubject", "emailTemplate", "smsTemplate", created_at, updated_at)
       VALUES (:id, :name, :displayName, :description, :emailSubject, :emailTemplate, :smsTemplate, :created_at, :updated_at)
      `,
      tenantId,
    ),
    {
      id: getUUID(),
      name: TemplateNames.RXP_RESIDENT_FORGOT_PASSWORD,
      displayName: 'RxP equivalent of the forgot password flow',
      description: 'RxP equivalent of the forgot password flow',
      emailSubject: 'Reset your password',
      emailTemplate: `<mjml>
                        <mj-head>
                          <mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" /> </mj-head>
                        <mj-body>
                          <mj-wrapper border="1px solid #ddd" padding="0px">
                            <mj-section background-color="#039BE5">
                              <mj-column width="100%" vertical-align="top">
                                <mj-text line-height="28px" font-family="Roboto, Arial" font-weight="400" font-size="20px" color="#ffffff"> {{property.applicationName}} </mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section padding-top="0px" padding-bottom="0px" background-color="#ffffff">
                              <mj-column>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="32px" padding-bottom="32px" align="center"> Looks like you’ve requested to reset your password. Don’t worry, it happens to everyone. Just click the below button or link, and you’ll be on your way! </mj-text>
                                <mj-button background-color="#039BE5" border-radius="2px 2px 2px 2px" font-size="14px"
                                  font-weight="500" padding-bottom="24px" font-family="Roboto, Arial" padding="16px" href="{{rxp.resetPasswordUrl}}" text-transform="uppercase"> Reset password </mj-button>
                              </mj-column>
                            </mj-section>
                            <mj-section>
                              <mj-column>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="32px"> Link: <a target="_blank" href="{{rxp.resetPasswordUrl}}">{{rxp.resetPasswordUrl}}</a> <br /><br /> <span style="color:#757575;">This link expires in 24 hours and can only be used once. <br /><br />If you did not attempt to reset your password, please ignore this message. If you suspect that your email inbox was compromised, update your password. </span></mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section padding-top="16px" padding-bottom="8px" background-color="#f5f5f5">
                              <mj-column>
                                <mj-text line-height="18px" font-size="12px" font-family="Roboto, Arial"> <a style="text-decoration:none;color:#757575;" target="_blank" href="{{reva.termsUrl}}">Terms and conditions</a>&ensp;|&ensp; <a style="text-decoration:none;color:#757575;" target="_blank" href="{{reva.privacyUrl}}">Privacy policy</a></mj-text>
                                <mj-text line-height="18px" font-size="12px" font-family="Roboto, Arial" color="#757575">Service provider <a style="text-decoration:none;color:#757575;" target="_blank" href="https://reva.tech/privacy-policy/">privacy policy</a> and <a style="text-decoration:none;color:#757575;" target="_blank" href="https://reva.tech/terms-and-conditions/">terms and conditions</a>.</mj-text>
                              </mj-column>
                            </mj-section>
                          </mj-wrapper>
                        </mj-body>
                      </mjml>`,
      smsTemplate: 'Use this link to reset your password in {{property.applicationName}} - {{rxp.resetPasswordUrl}}',
      created_at: now,
      updated_at: now,
    },
  );

  await knex.raw(
    prepareRawQuery(
      `
       INSERT INTO db_namespace."CommsTemplate"(id, name, "displayName", description, "emailSubject", "emailTemplate", "smsTemplate", created_at, updated_at)
       VALUES (:id, :name, :displayName, :description, :emailSubject, :emailTemplate, :smsTemplate, :created_at, :updated_at)
      `,
      tenantId,
    ),
    {
      id: getUUID(),
      name: TemplateNames.RXP_RESIDENT_PASSWORD_RESET_CONFIRMATION,
      displayName: 'RXP equivalent of the confirmation of password reset',
      description: 'RXP equivalent of the confirmation of password reset',
      emailSubject: 'Your password has been reset',
      emailTemplate: `<mjml>
                        <mj-head>
                          <mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" /> </mj-head>
                        <mj-body>
                          <mj-wrapper border="1px solid #ddd" padding="0px">
                            <mj-section background-color="#039BE5">
                              <mj-column width="100%" vertical-align="top">
                                <mj-text line-height="28px" font-family="Roboto, Arial" font-weight="400" font-size="20px" color="#ffffff"> {{property.applicationName}} </mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section padding-top="0px" padding-bottom="0px" background-color="#ffffff">
                              <mj-column>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="32px" padding-bottom="32px" align="center"> <span style="font-size:18px;line-height:24px">Hi {{recipient.name}}</span><br /><br /> You’ve successfully reset your password. You can now access {{property.applicationName}} by logging in as usual, but with the updated password.</mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section padding-top="16px" padding-bottom="8px" background-color="#f5f5f5">
                              <mj-column>
                                <mj-text line-height="18px" font-size="12px" font-family="Roboto, Arial"> <a style="text-decoration:none;color:#757575;" target="_blank" href="{{reva.termsUrl}}">Terms and conditions</a>&ensp;|&ensp; <a style="text-decoration:none;color:#757575;" target="_blank" href="{{reva.privacyUrl}}">Privacy policy</a></mj-text>
                                <mj-text line-height="18px" font-size="12px" font-family="Roboto, Arial" color="#757575">Service provider <a style="text-decoration:none;color:#757575;" target="_blank" href="https://reva.tech/privacy-policy/">privacy policy</a> and <a style="text-decoration:none;color:#757575;" target="_blank" href="https://reva.tech/terms-and-conditions/">terms and conditions</a>.</mj-text>
                              </mj-column>
                            </mj-section>
                          </mj-wrapper>
                        </mj-body>
                      </mjml>`,
      smsTemplate: 'Your password has been reset. If you did not take this action, please write to support@reva.tech.',
      created_at: now,
      updated_at: now,
    },
  );

  await knex.raw(
    prepareRawQuery(
      `
       INSERT INTO db_namespace."CommsTemplate"(id, name, "displayName", description, "emailSubject", "emailTemplate", "smsTemplate", created_at, updated_at)
       VALUES (:id, :name, :displayName, :description, :emailSubject, :emailTemplate, :smsTemplate, :created_at, :updated_at)
      `,
      tenantId,
    ),
    {
      id: getUUID(),
      name: TemplateNames.RXP_RESIDENT_FORGOT_PASSWORD_FOR_NO_CURRENT_USER,
      displayName: 'RxP equivalent of the forgot password flow for no common user',
      description: 'RxP equivalent of the forgot password flow for no common user',
      emailSubject: "You don't have a registered account with this email!",
      emailTemplate: `<mjml>
                        <mj-head>
                          <mj-font name="Roboto" href="https://fonts.googleapis.com/css?family=Roboto" />
                        </mj-head>
                        <mj-body>
                          <mj-wrapper border="1px solid #ddd" padding="0px">
                            <mj-section background-color="#039BE5">
                              <mj-column width="100%" vertical-align="top">
                                <mj-text line-height="28px" font-family="Roboto, Arial" font-weight="400" font-size="20px" color="#ffffff">{{property.applicationName}}</mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section padding-top="0px" padding-bottom="0px" background-color="#ffffff">
                              <mj-column>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="32px" padding-bottom="0px" align="center" font-weight="bold">Whoops! You don’t have a registered account with this email!</mj-text>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="24px" padding-bottom="24px" align="center">You need to request an invite to log in to {{property.applicationName}}. If you used a different email to register an account then try logging in using that email.</mj-text>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="0px" align="center">If you are in the process of signing a new lease, then you will automatically receive an invite once your lease has been signed.</mj-text>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="24px" padding-bottom="0" align="center">Contact your property for more details.</mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section>
                              <mj-column>
                                <mj-text font-family="Roboto, Arial" color="#212121" line-height="20px" font-size="13px" padding-top="90px">
                                  <span style="color:#757575">If you did not attempt to access the application, please ignore this message. If you suspect that your email inbox was compromised, update your password.</span></mj-text>
                              </mj-column>
                            </mj-section>
                            <mj-section padding-top="16px" padding-bottom="8px" background-color="#f5f5f5">
                              <mj-column>
                                <mj-text line-height="18px" font-size="12px" font-family="Roboto, Arial"> <a style="text-decoration:none;color:#757575;" target="_blank" href="{{reva.termsUrl}}">Terms and conditions</a>&ensp;|&ensp; <a style="text-decoration:none;color:#757575;" target="_blank" href="{{reva.privacyUrl}}">Privacy policy</a></mj-text>
                                <mj-text line-height="18px" font-size="12px" font-family="Roboto, Arial" color="#757575">Service provider <a style="text-decoration:none;color:#757575;" target="_blank" href="https://reva.tech/privacy-policy/">privacy policy</a> and <a style="text-decoration:none;color:#757575;" target="_blank" href="https://reva.tech/terms-and-conditions/">terms and conditions</a>.</mj-text>
                              </mj-column>
                            </mj-section>
                          </mj-wrapper>
                        </mj-body>
                      </mjml>`,
      smsTemplate: '',
      created_at: now,
      updated_at: now,
    },
  );
};

exports.down = async () => {};
