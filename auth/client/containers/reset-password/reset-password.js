/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Card, CardTitle, CardActions, TextBox, Button, Field, ErrorMessage, Typography } from 'components';
import { t } from 'i18next';
import { sendToParent } from 'helpers/postMessage';
import { DefaultAppFooter } from '../../custom-components/default-app-footer/default-app-footer';
import { RegisterMessagesTypes } from '../../../../common/enums/messageTypes';
import { Page } from '../../custom-components/page/page';
import { cf } from './reset-password.scss';
import { DALTypes } from '../../../common/enums/dal-types';

const { SubHeader, Text } = Typography;

@inject('resetPasswordModel', 'auth')
@observer
export class ResetPassword extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      model: props.auth.resetPasswordModel,
    };
  }

  redirectTo = linkId => sendToParent({ type: RegisterMessagesTypes.LINK_CLICK, data: linkId });

  callToParent = (actionType, dataContent) => sendToParent({ type: actionType, data: dataContent });

  handleResetPassword = async () => {
    const { model } = this.state;
    const { appId, confirmUrl, token } = this.props.location.query;

    await model.validate();

    if (!model.valid) return;

    const ctx = { appId, confirmUrl, token };
    if (appId === DALTypes.ApplicationAppId) {
      ctx.appName = t('GENERIC_FORGOT_PASSWORD_TITLE');
    }

    model.requestResetPassword(ctx);
  };

  handleResendResetPassword = () => {
    const { model } = this.state;
    const { sentResetPassword } = model;

    if (!model.valid) return;
    model.resend(!sentResetPassword);
  };

  disableNextAction = model => {
    const { sentResetPassword, isResettingPassword, valid, interacted } = model;
    return sentResetPassword || !interacted || !valid || isResettingPassword;
  };

  render() {
    const { model } = this.state;
    const { cancelLinkId } = this.props.location.query;
    const {
      resetPasswordError,
      sentResetPassword,
      isResettingPassword,
      fields: { email },
    } = model;
    const disabledAction = this.disableNextAction(model);
    const currentEmail = email ? email.value : '';
    const mainActionLabel = !isResettingPassword ? t('NEXT') : t('SENDING');

    return (
      <Page className={cf('page-content')} noHeader>
        {!sentResetPassword && (
          <Card className={cf('card-reset-password')} container={false}>
            <CardTitle>{t('HAVING_TROUBLE_SIGNING')}</CardTitle>
            <Text className={cf('text-message')} inline>
              {t('HAVING_TROUBLE_SIGNING_MESSAGE')}
            </Text>
            <Field className={cf('field-padding')} noMargin>
              <TextBox
                label={t('EMAIL')}
                placeholder={t('EMAIL_REGISTER_ENTER_EMAIL')}
                wide
                forceLowerCase
                onEnterPress={this.handleResetPassword}
                errorMessage={email.errorMessage}
                value={email.value}
                onChange={({ value }) => email.setValue(value)}
              />
            </Field>
            {!email.errorMessage && (
              <div className={cf('error-message')}>
                <ErrorMessage message={t(resetPasswordError)} />
              </div>
            )}
            <CardActions textAlign="right" className={cf('card-actions-reset')}>
              <Button label={t('CANCEL')} btnRole="secondary" type="flat" onClick={() => this.callToParent(cancelLinkId)} />
              <Button style={{ width: '120px' }} label={mainActionLabel} disabled={disabledAction} onClick={this.handleResetPassword} />
            </CardActions>
          </Card>
        )}
        {sentResetPassword && (
          <Card className={cf('card-reset-password-sent')} container={false}>
            <CardTitle>{t('EMAIL_SENT')}</CardTitle>
            <SubHeader className={cf('subheader-message')}> {t('EMAIL_RESET_PASSWORD_SENT_MESSAGE', { currentEmail })}</SubHeader>
            <CardActions textAlign="right" style={{ padding: '48px' }}>
              <Button type="flat" label={t('TRY_AGAIN')} onClick={this.handleResendResetPassword} />
            </CardActions>
          </Card>
        )}
        <DefaultAppFooter redirectTo={this.redirectTo} />
      </Page>
    );
  }
}
