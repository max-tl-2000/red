/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observable, action } from 'mobx';
import { CheckBox, Button, SizeAware, Typography as T } from 'components';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';
import { windowOpen } from 'helpers/win-open';
import { locals as styles, cf } from './application-stepper.scss';
import { ApplicationSteps } from './application-steps';
import { PrivacyPolicy } from './privacy-policy';
import { TermsOfService } from './terms-of-service';
import { AppLinkIdUrls } from '../../../../../common/enums/messageTypes';

@inject('quoteSummary', 'application')
@observer
export class ApplicationStepper extends Component {
  @observable
  applicationBreakpoint;

  @action
  updateApplicationBreakpoint = ({ breakpoint }) => {
    this.applicationBreakpoint = breakpoint;
  };

  gePropertyPolicies = ({ application, quoteSummary } = this.props) => application.generatePropertyPolicies(quoteSummary?.propertyPolicies);

  renderAttestationCheckbox = ({ attestation, changeAttestation }) => {
    const [propertyPolicy] = this.gePropertyPolicies(this.props);
    const hasPropertyPolicy = !!propertyPolicy;
    return (
      <div className={styles.attestation}>
        <CheckBox className={styles.checkbox} checked={attestation} onChange={changeAttestation} id="attestation" />
        <div className={styles.label}>
          <T.Text secondary inline>
            {t('ATTESTATION')}
          </T.Text>
          <T.Link className={cf({ noRightPadding: hasPropertyPolicy })} onClick={() => windowOpen(AppLinkIdUrls.TERMS_AND_CONDITIONS_ID)}>
            {t('TERMS_OF_SERVICE')}
          </T.Link>
          <T.Text secondary inline>
            {hasPropertyPolicy ? ',' : t('AND')}
          </T.Text>
          <T.Link onClick={() => windowOpen(AppLinkIdUrls.PRIVACY_POLICY_ID)}>{t('PRIVACY_POLICY')}</T.Link>
          {hasPropertyPolicy && (
            <T.Text secondary inline>
              {t('AND')}
            </T.Text>
          )}
          {hasPropertyPolicy && <T.Link onClick={() => windowOpen(propertyPolicy.policyUrl)}>{t('PROPERTY_POLICIES')}</T.Link>}
        </div>
      </div>
    );
  };

  renderAttestation = ({ application, openTermsOfServiceDialog, closeTermsOfServiceDialog, openPrivacyPolicyDialog, closePrivacyPolicyDialog }) => {
    const isCustomerNew = application.tenantDomain?.includes('customernew');
    return (
      <SizeAware breakpoints={{ small: [0, 480], large: [481, Infinity] }} onBreakpointChange={this.updateApplicationBreakpoint}>
        <div className={cf('attestation-container', { small: this.applicationBreakpoint === 'small' })}>
          <div className={cf('rectangle', 'top')} />
          <TermsOfService dialogOpen={openTermsOfServiceDialog} closeDialog={closeTermsOfServiceDialog} />
          <PrivacyPolicy dialogOpen={openPrivacyPolicyDialog} closeDialog={closePrivacyPolicyDialog} />
          {this.renderAttestationCheckbox(this.props)}
          <T.Text secondary className={cf('attestation-description')}>
            {isCustomerNew ? t('ATTESTATION_DESCRIPTION_CUSTOMERNEW') : t('ATTESTATION_DESCRIPTION')}
          </T.Text>
          {isCustomerNew && (
            <T.Text secondary className={cf('attestation-description')}>
              {t('ATTESTATION_DESCRIPTION_CUSTOMERNEW2')}
            </T.Text>
          )}
          <div className={cf('rectangle', 'bottom')} />
        </div>
      </SizeAware>
    );
  };

  render = ({ attestation, handleStartApplicationClick } = this.props) => (
    <div className={styles.stepper}>
      <div className={cf('start-message')}>
        <T.SubHeader>{t('START_PROCESS')}</T.SubHeader>
      </div>
      <div className={cf('stepper-inner')}>
        <div className={cf('connecting-line')} />
        <ApplicationSteps />
      </div>
      <div className={cf('stepper-actions')}>
        {this.renderAttestation(this.props)}
        <Button
          label={t('START_YOUR_APPLICATION')}
          disabled={!attestation}
          className={styles.continue}
          id="continueBtn"
          onClick={handleStartApplicationClick}
        />
        <T.Caption secondary className={cf('note')}>
          {t('START_APPLICATION_NOTE')}
        </T.Caption>
      </div>
    </div>
  );
}
