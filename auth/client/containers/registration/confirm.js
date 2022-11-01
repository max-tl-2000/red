/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { TextBox, Button, Field, ErrorMessage, Typography, Card } from 'components';
import { t } from 'i18next';
import { sendToParent } from 'helpers/postMessage';
import { Page } from '../../custom-components/page/page';
import { cf } from './page-iframe.scss';
import { RegisterMessagesTypes, AppLinkIds } from '../../../../common/enums/messageTypes';
import { DefaultAppFooter } from '../../custom-components/default-app-footer/default-app-footer';
import { ConfirmResetPassword } from './confirm-reset-password';

const { SubHeader, Caption } = Typography;

@inject('auth')
@observer
export class ConfirmRegister extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      model: props.auth.confirmRegisterModel,
    };
  }

  callToParent = (actionType, dataContent) => sendToParent({ type: actionType, data: dataContent });

  redirectTo = linkId => sendToParent({ type: RegisterMessagesTypes.LINK_CLICK, data: linkId });

  handleCreateUserAndRegister = async () => {
    const { model } = this.state;
    const { userId, emailAddress, isResetPassword, appId } = this.props.auth.confirmRegisterToken;

    await model.validate();

    if (model.valid) {
      const { query } = this.props.location || {};
      const userData = await model.register(userId, emailAddress, isResetPassword, appId, query.confirmToken);

      sendToParent({
        type: RegisterMessagesTypes.REGISTER_SUCCESS,
        data: userData,
      });
    }
  };

  render() {
    const { model } = this.state;
    const {
      loginError,
      loginIn,
      fields: { password },
      valid,
      interacted,
    } = model;
    const mainActionLabel = t('CREATE_ACCOUNT');
    const disabledAction = loginIn || !interacted || !valid;
    const { emailAddress, isResetPassword } = this.props.auth.confirmRegisterToken;

    return (
      <Page className={cf('page-content')} noHeader>
        {isResetPassword && (
          <ConfirmResetPassword
            model={model}
            handleCreateUserAndRegister={this.handleCreateUserAndRegister}
            disabledAction={disabledAction}
            callToParent={this.callToParent}
            email={emailAddress}
          />
        )}
        {!isResetPassword && (
          <Card className={cf('card-confirm')} container={false}>
            <ErrorMessage message={t(loginError)} />
            <Field noMargin flex className={cf('field-padding')}>
              <SubHeader inline>{emailAddress}</SubHeader>
            </Field>
            <Field noMargin className={cf('field-padding')}>
              <TextBox
                label={t('CREATE_PASSWORD')}
                wide
                onEnterPress={this.handleCreateUserAndRegister}
                errorMessage={password.errorMessage}
                value={password.value}
                onChange={({ value }) => password.setValue(value)}
                type="password"
              />
            </Field>
            <Field noMargin className={cf('action-button')}>
              <Button label={mainActionLabel} disabled={disabledAction} onClick={this.handleCreateUserAndRegister} />
            </Field>
            <div className={cf('conditions')}>
              <Caption>{`${t('CREATE_ACCOUNT_CONDITION')} `}</Caption>
              <Caption className={cf('text-link')}>
                <a onClick={() => this.redirectTo(AppLinkIds.TERMS_AND_CONDITIONS)}>{t('TERMS_AND_CONDITIONS')}</a>
              </Caption>
            </div>
          </Card>
        )}
        <DefaultAppFooter redirectTo={this.redirectTo} />
      </Page>
    );
  }
}
