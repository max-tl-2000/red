/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { TextBox, Button, Form, FormActions, Typography, Status, ErrorMessage } from 'components';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import { Page } from '../../custom-components/page/page';
import { cf } from './registration.scss';
import { RegistrationSteps } from './registration-steps';
import { replace } from '../../../../client/helpers/navigator';
import { DALTypes } from '../../../common/enums/dal-types';
import { AppLinkIdUrls } from '../../../../common/enums/messageTypes';

import { location } from '../../../../common/helpers/globals';

const { Text, Caption, Link } = Typography;

@inject('auth', 'registrationModel')
@observer
export class Registration extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      model: props.registrationModel.create(),
    };
  }

  componentWillMount() {
    // TODO: we don't need the entire auth token being decoded here
    this.getUserDataFromToken(this.props.auth.tokenObject);
  }

  async getUserDataFromToken(token) {
    const { userId, emailAddress, redirectToUrl, appId } = token;
    // TODO: this check should not be done from the UI, this has to be done in the same request that serves the
    // register HTML page, that way we don't have to expose this endpoint from auth at all
    const registered = await this.props.auth.checkIfRegisteredUser(userId);
    if (!registered) {
      this.setState({
        userId,
        redirectToUrl,
        appId,
        email: emailAddress,
      });
    } else {
      replace(`/login${location.search}`);
    }
  }

  handleCreatePasswordAndLogin = async () => {
    const { model } = this.state;

    await model.validate();

    const {
      location: { query },
    } = this.props;

    if (model.valid) {
      await model.setPassword(this.state.userId, this.state.email, query.token);
      switch (this.state.appId) {
        case DALTypes.ApplicationAppId: {
          query.token && location.replace(`/redirect/${query.token}`);
          break;
        }
        default: {
          if (this.state.redirectToUrl) {
            window.location.replace(this.state.redirectToUrl);
          } else {
            replace({ pathname: '/', state: {} });
          }
          break;
        }
      }
    }
  };

  getPageAppBarProps() {
    switch (this.state.appId) {
      case DALTypes.ApplicationAppId:
        return { title: t('RENTAPP_TITLE') };
      default:
        return { title: t('APP_TITLE') };
    }
  }

  renderLink = (link, label, isTheLastOne) => (
    <Text inline>
      <Link href={link} rel="noopener noreferrer" target="_blank">
        {t(label)}
      </Link>
      {isTheLastOne ? '' : ' | '}{' '}
    </Text>
  );

  render() {
    const { model } = this.state;
    const {
      registrationError,
      loginIn,
      fields: { password },
      blockedAccount,
      valid,
      interacted,
    } = model;
    const mainActionLabel = blockedAccount ? t('RESET_PASSWORD') : t('CREATE_ACCOUNT');
    const { communications } = (this.props.auth && this.props.auth.tokenObject && this.props.auth.tokenObject.settings) || {};
    const disabledAction = loginIn || !interacted || !valid;
    const renderCommunicationLink = (property, linkText, isTheLastOne) =>
      communications && communications[property] && this.renderLink(communications[property], linkText, isTheLastOne);

    return (
      <Page className={cf('mobile-view')} {...this.getPageAppBarProps()}>
        <Status processing={loginIn} />
        <Form className={cf('form')}>
          <ErrorMessage message={t(registrationError)} />
          <div className={cf('inputs-container')}>
            <div className={cf('margin-bottom')}>
              <TextBox className={cf('full-width')} readOnly label={t('EMAIL')} value={this.state.email} />
            </div>
            <div className={cf('margin-bottom')}>
              <TextBox
                dataId="passwordTxt"
                onEnterPress={this.handleCreatePasswordAndLogin}
                className={cf('full-width')}
                label={t('PASSWORD')}
                errorMessage={password.errorMessage}
                value={password.value}
                onChange={({ value }) => password.setValue(value)}
                type="password"
              />
            </div>
          </div>
          <FormActions className={cf('align-button-center', 'margin-bottom')}>
            <Button data-id="createAccountBtn" label={mainActionLabel} disabled={disabledAction} onClick={this.handleCreatePasswordAndLogin} />
          </FormActions>
          <div>
            <Caption>
              {t('AGREEMENT_TEXT')}{' '}
              <Link href={AppLinkIdUrls.TERMS_AND_CONDITIONS_ID} rel="noopener noreferrer" target="_blank">
                {t('TERMS_AND_CONDITIONS')}
              </Link>
            </Caption>
          </div>
          <div className={cf('margin-top')}>
            <RegistrationSteps />
          </div>
        </Form>
        <footer className={cf('footer-links')}>
          {this.renderLink(AppLinkIdUrls.PRIVACY_POLICY_ID, 'PRIVACY_POLICY')}
          {renderCommunicationLink('disclaimerLink', 'DISCLAIMER')}
          {renderCommunicationLink('contactUsLink', 'CONTACT_US', true)}
        </footer>
      </Page>
    );
  }
}
