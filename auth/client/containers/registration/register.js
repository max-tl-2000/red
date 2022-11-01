/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { TextBox, Button, Field, ErrorMessage, Typography, Card, CardActions } from 'components';
import { sendToParent } from 'helpers/postMessage';
import { t } from 'i18next';
import { parseQueryString } from '../../../../client/helpers/url';
import { DefaultAppFooter } from '../../custom-components/default-app-footer/default-app-footer';
import { RegisterMessagesTypes } from '../../../../common/enums/messageTypes';
import { Page } from '../../custom-components/page/page';
import { cf } from './page-iframe.scss';

const { SubHeader } = Typography;

@inject('auth')
@observer
export class Register extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      model: props.auth.registerModel,
    };
  }

  redirectTo = linkId => sendToParent({ type: RegisterMessagesTypes.LINK_CLICK, data: linkId });

  handleRegister = async () => {
    const { token } = parseQueryString(this.props.location.search);
    const { model } = this.state;

    await model.validate();

    if (!model.valid) return;
    await model.send({ token });
  };

  handleResendRegisterEmail = () => {
    const { model } = this.state;
    const { sentRegister } = model;

    if (!model.valid) return;
    model.resend(!sentRegister);
  };

  disableContinueAction = model => {
    const { sentRegister, isRegistering, valid, interacted } = model;
    return sentRegister || !interacted || !valid || isRegistering;
  };

  render() {
    const { model } = this.state;
    const {
      registerError,
      sentRegister,
      isRegistering,
      fields: { email },
    } = model;
    const disabledAction = this.disableContinueAction(model);
    const currentEmail = email ? email.value : '';
    const mainActionLabel = !isRegistering ? t('CONTINUE') : t('SENDING');

    return (
      <Page className={cf('page-content')} noHeader>
        {!sentRegister && (
          <Card className={cf('card-register')} container={false}>
            <Field className={cf('field-padding')} noMargin>
              <TextBox
                label={t('EMAIL')}
                placeholder={t('EMAIL_REGISTER_ENTER_EMAIL')}
                wide
                forceLowerCase
                onEnterPress={this.handleRegister}
                errorMessage={email.errorMessage}
                onBlur={() => email.markBlurredAndValidate()}
                value={email.value}
                onChange={({ value }) => email.setValue(value)}
              />
            </Field>
            {!email.errorMessage && (
              <div className={cf('error-message')}>
                <ErrorMessage message={t(registerError)} />
              </div>
            )}
            <CardActions textAlign="right" style={{ padding: '48px' }}>
              <Button label={mainActionLabel} disabled={disabledAction} onClick={this.handleRegister} />
            </CardActions>
          </Card>
        )}
        {sentRegister && (
          <Card className={cf('card-sent')} container={false}>
            <Field fullWidth noMargin>
              <SubHeader> {t('EMAIL_REGISTER_SENT_MESSAGE', { currentEmail })}</SubHeader>
            </Field>
            <CardActions textAlign="right" style={{ padding: '48px' }}>
              <Button type="flat" label={t('TRY_AGAIN')} onClick={this.handleResendRegisterEmail} />
            </CardActions>
          </Card>
        )}
        <DefaultAppFooter redirectTo={this.redirectTo} />
      </Page>
    );
  }
}
