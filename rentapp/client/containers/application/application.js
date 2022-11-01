/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Typography as T, MsgBox } from 'components';
import { t } from 'i18next';
import { DALTypes } from 'enums/DALTypes';
import { locals as styles } from './application.scss';
import { ApplicationStepper } from './process/application-stepper';
import { ApplicantName } from '../applicant/applicant-name';
import { getIPs } from '../../../../common/client/clientNetwork';
import { push } from '../../../../client/helpers/navigator';

@inject('auth', 'application')
@observer
export class Application extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      attestation: false,
      openTermsOfServiceDialog: false,
      openPrivacyPolicyDialog: false,
      openTokenNotFoundDialog: false,
    };
  }

  async getLocalIP() {
    if (!this.ip) {
      this.ip = await this._getLocalIP();
    }
    return this.ip;
  }

  async _getLocalIP() {
    const ip = await getIPs();
    if (ip && ip.length) {
      return ip[0];
    }
    return '';
  }

  async saveEvent(eventType) {
    this.props.application.saveEvent({
      eventType,
      localIP: await this.getLocalIP(),
    });
  }

  componentWillMount() {
    if (!this.props.auth.isAuthenticated) {
      this.setState({
        openTokenNotFoundDialog: true,
      });
    }
  }

  changeAttestation = () => {
    const eventType = this.state.attestation ? DALTypes.ApplicationWelcomeScreenEvents.UNCHECKED : DALTypes.ApplicationWelcomeScreenEvents.CHECKED;
    this.saveEvent(eventType);
    const attestation = !this.state.attestation;
    this.setState({
      attestation,
    });
  };

  handleTermsOfService = () =>
    this.setState({
      openTermsOfServiceDialog: true,
    });

  closeTermsOfServiceDialog = () =>
    this.setState({
      openTermsOfServiceDialog: false,
    });

  handlePrivacyPolicy = () =>
    this.setState({
      openPrivacyPolicyDialog: true,
    });

  closePrivacyPolicyDialog = () =>
    this.setState({
      openPrivacyPolicyDialog: false,
    });

  closeTokenNotFoundDialog = () =>
    this.setState({
      openTokenNotFoundDialog: false,
    });

  handleStartApplicationClick = () => {
    this.saveEvent(DALTypes.ApplicationWelcomeScreenEvents.BUTTON);
    push('/applicantDetails');
  };

  render() {
    const applicantName = this.props.application.getApplicantDisplayName(true);
    const welcomeMessage = `${t('WELCOME')},`;

    return (
      <div className={styles.wrap_container}>
        <div className={styles.container}>
          <div>
            <div>
              <T.Headline secondary inline id="welcome-headline">
                {welcomeMessage}
              </T.Headline>
              <ApplicantName applicantName={applicantName} symbol={'!'} />
            </div>
            <MsgBox open={this.state.openTokenNotFoundDialog} onCloseRequest={this.closeTokenNotFoundDialog}>
              {t('PA_FLOW_NOT_IMPLEMENTED')}
            </MsgBox>
          </div>
          <ApplicationStepper
            attestation={this.state.attestation}
            changeAttestation={this.changeAttestation}
            openTermsOfServiceDialog={this.state.openTermsOfServiceDialog}
            closeTermsOfServiceDialog={this.closeTermsOfServiceDialog}
            handleTermsOfService={this.handleTermsOfService}
            openPrivacyPolicyDialog={this.state.openPrivacyPolicyDialog}
            closePrivacyPolicyDialog={this.closePrivacyPolicyDialog}
            handlePrivacyPolicy={this.handlePrivacyPolicy}
            handleStartApplicationClick={this.handleStartApplicationClick}
          />
        </div>
      </div>
    );
  }
}
