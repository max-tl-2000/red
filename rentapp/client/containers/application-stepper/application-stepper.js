/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { computed, action, reaction } from 'mobx';
import { t } from 'i18next';
import debounce from 'debouncy';
import { Stepper, Step, StepSummary, StepContent, Typography as T } from 'components';
import { logger } from 'client/logger';
import { cf } from './application-stepper.scss';
import { ApplicationDetails } from '../application-details/application-details';
import { ApplicationDetailsSummary } from '../application-details/application-details-summary';
import { ApplicationCharges } from '../application-charges/application-charges';
import { PaymentDialog } from '../payment-dialog/payment-dialog';
import { ApplicantName } from '../applicant/applicant-name';
import { AppFooter } from '../../custom-components/app-footer/app-footer';
import { ApplicationFadvAuthorization } from '../application-fadv-authorization-section/application-fadv-authorization-section';
import PaymentReceivedDialog from '../payment-dialog/payment-received-dialog';
import AddressRecommendationDialogWrapper from '../application-details/address-recommendation-dialog-wrapper';
import { ForbidEditionBanner } from '../application/forbid-application-edition-banner';

import { getApplicantDetails, showPaymentDialogOrContinueToPartTwo } from '../../helpers/payment-helpers';
import { showMsgBox } from '../../../../client/components/MsgBox/showMsgBox';
import FormattedMarkdown from '../../../../client/components/Markdown/FormattedMarkdown';

const TIMEOUT_COUNT_DOWN = 1000;
const COUNT_DOWN_FROM = 5;

@inject('auth', 'application', 'applicationSettings', 'appStepperState')
@observer
export class ApplicationStepper extends Component {
  constructor(props) {
    super(props);

    this.state = {
      applicantName: props.application.applicantName,
      personId: props.application.personId,
      partyId: props.application.partyId,
      quoteId: props.application.quoteId,
      model: props.application.applicantDetailsModel,
      firstTime: true,
      partyMembers: props.application.partyMembers,
      applicationId: props.application.applicant.applicationObject.id,
      countDownSeconds: COUNT_DOWN_FROM,
    };

    reaction(
      () => ({
        shouldReprocessInitiatePayment: this.paymentModel.shouldReprocessInitiatePayment,
      }),
      debounce(
        async ({ shouldReprocessInitiatePayment }) => {
          if (shouldReprocessInitiatePayment && !this.initPaymentReprocessed) {
            console.log('shouldReprocessInitiatePaymentshouldReprocessInitiatePayment');
            this.initPaymentReprocessed = true;
            await this.props.application.details.applicationFees.fetchFees(true);
            await this.handlePayOrContinue();
          }
        },
        210,
        this,
      ),
    );
  }

  componentWillMount() {
    const { model, partyMembers, personId } = this.state;
    if (model.prefilledAlready) return;
    model.prefill({ partyMembers, personId });
  }

  componentDidUpdate() {
    const { application, appStepperState } = this.props;
    const { partyMembers, personId } = application;
    const { model } = this.state;

    if (model.prefilledAlready) return;
    model.prefill({ partyMembers, personId, isOnPaymentStep: appStepperState.movedToPaymentStep });
  }

  errorMessage = () => this.props.application.personApplicationError && t(this.props.application.personApplicationError);

  @computed
  get paymentModel() {
    const { props } = this;
    const { application = {} } = props;
    const { applicantDetailsModel = {} } = application;
    const { paymentModel = {} } = applicantDetailsModel;

    return paymentModel;
  }

  @computed
  get isPayAndContinueDisabled() {
    const { details: { applicationFees } = {}, personApplication = {} } = this.props.application || {};
    return this.paymentModel.isPaymentInProgress || !(applicationFees && applicationFees.loaded) || !personApplication.id;
  }

  saveApplicantDetails = async () => {
    logger.trace('saveApplicantDetails');
    const { model, personId, partyId } = this.state;
    await model.validate();

    if (model.valid && model.isDirty) {
      await model.submit(personId, partyId);
    } else {
      logger.trace('Can not update person application');
    }
  };

  @action
  handleChange = async ({ selectedIndex }) => {
    logger.trace({ selectedIndex }, 'handleChange');
    const { appStepperState, application, applicationSettings } = this.props;
    appStepperState.updateSelectedIndex(selectedIndex);
    if (appStepperState.movedToPaymentStep) {
      const { propertyId, partyType, memberType } = application;
      await this.saveApplicantDetails();
      await application.details.applicationFees.fetchFees();
      await applicationSettings.fetchApplicationSettings(propertyId, partyType, memberType);
      if (application.personApplicationError || application.details.applicationFees.error) {
        appStepperState.reset();
        logger.warn({ selectedIndex }, 'Returning to applicationDetails step');
        return;
      }
      logger.trace('Show payment step');
    }
  };

  validateApplicantLegalName = async (model, actionToPerform) => {
    if (!model.shouldValidateLegalName) {
      actionToPerform();
      return;
    }

    if (!model.applicantNameChanged) {
      actionToPerform();
      return;
    }

    this.showMessage(actionToPerform);
  };

  handleBeforeStepChange = async args => {
    const { model } = this.state;
    args.cancel = true;
    await model.validate();

    if (model.valid) {
      await this.validateApplicantLegalName(model, args.performChange);
    }
  };

  handleBeforeStepClose = async args => {
    const { model } = this.state;
    args.cancel = true;
    await model.validate();

    if (model.valid) {
      await this.validateApplicantLegalName(model, args.performClose);
    }
  };

  showMessage = performAction => {
    const { model } = this.state;
    const onOkClick = () => {
      model.setPreviousFullName();
      performAction();
    };

    showMsgBox(
      <div>
        <FormattedMarkdown>
          {t('APPLICANT_NAME_CHANGED_WARNING', { originalName: model.originalFullName, changedName: model.currentFullName })}
        </FormattedMarkdown>
      </div>,
      {
        title: t('APPLICANT_NAME_CHANGED_TITLE'),
        lblOK: t('APPLICANT_NAME_CHANGED_OK_LABEL'),
        onOKClick: onOkClick,
        lblCancel: t('NO'),
      },
    );
  };

  handlePayOrContinue = async () => {
    const { paymentModel } = this;
    const { model } = this.state;
    await showPaymentDialogOrContinueToPartTwo(model, paymentModel, this.props.application, this.handlePaymentDialog);
  };

  handlePayOrContinueButtonClick = async args => {
    logger.trace(args, 'handlePayOrContinueButtonClick');
    args.cancel = true; // prevent the stepper from closing
    this.paymentModel.clearErrorToken();
    this.initPaymentReprocessed = false;
    await this.handlePayOrContinue();
  };

  handlePaymentDialog = showDialog => this.props.application.setPaymentDialogStatus(showDialog);

  handlePaymentReceivedDialog = showDialog => this.props.application.setPaymentReceivedDialogStatus(showDialog);

  countDown = () => {
    let { countDownSeconds } = this.state;
    countDownSeconds -= 1;
    this.setState({ countDownSeconds });
    if (countDownSeconds > 0) {
      this.countDownToRedirect();
      return;
    }

    clearTimeout(this.enterPressTimeout);
    this.handlePaymentReceivedDialog(false);
    this.handleOnPaymentReceived();
  };

  countDownToRedirect = () => {
    clearTimeout(this.redirectTimeout);
    this.redirectTimeout = setTimeout(() => this.countDown(), TIMEOUT_COUNT_DOWN);
  };

  handleOnPaymentReceived = () => {
    clearTimeout(this.redirectTimeout);
    this.props.application.redirectToAdditionalInfo(this.props.auth.token);
  };

  handleOnOpeningPaymentReceived = () => {
    this.setState({ countDownSeconds: COUNT_DOWN_FROM });
    this.countDownToRedirect();
  };

  handleAddressRecommendationAction = () => this.handleChange({ selectedIndex: this.props.appStepperState.PAYMENT_STEP });

  render = ({ application: { isReadOnly } } = this.props) => {
    const { paymentModel } = this;
    const { model, countDownSeconds } = this.state;
    const { valid, interacted, requiredAreFilled } = model;
    const applicantDetails = getApplicantDetails(model);

    const isEmailDisabled = (model.hasTemporaryEmailDomain !== undefined && !model.hasTemporaryEmailDomain) || !!model.defaultEmailAddress;

    const disabledContinue = !requiredAreFilled || !valid || !interacted;
    const { application, appStepperState } = this.props;
    const continueWithoutPayment = this.props.application.continueWithoutPayment;

    const welcomeMessage = `${t('WELCOME')},`;

    return (
      <div className={cf('application-stepper')}>
        <div className={cf('welcome-message')}>
          <T.Headline secondary inline id="welcome-headline">
            {welcomeMessage}
          </T.Headline>
          <ApplicantName applicantName={application.getApplicantDisplayName(true)} symbol={'!'} />
          {!isReadOnly && <T.SubHeader className={cf('welcome-subtitle')}>{t('START_YOUR_APPLICATION_PROCESS')}</T.SubHeader>}
          {isReadOnly && <ForbidEditionBanner />}
        </div>
        <Stepper
          selectedIndex={appStepperState.selectedIndex}
          onStepChange={this.handleChange}
          onBeforeComplete={args => !this.isPayAndContinueDisabled && this.handlePayOrContinueButtonClick(args)}>
          <Step
            title={t('APPLICANT_DETAILS')}
            btnNextDisabled={disabledContinue}
            onBeforeStepClose={this.handleBeforeStepClose}
            onBeforeStepChange={this.handleBeforeStepChange}>
            <StepSummary>
              <ApplicationDetailsSummary
                model={model}
                isOnPaymentStep={appStepperState.movedToPaymentStep}
                isPartyLevelGuarantor={application.isPartyLevelGuarantor}
                partyLevelGuarantor={application.partyLevelGuarantor}
              />
            </StepSummary>
            <StepContent container={false}>
              <ApplicationDetails
                model={model}
                isEmailDisabled={isEmailDisabled}
                isGuarantor={application && application.isPersonGuarantor}
                displayInviteGuarantor={application.displayInviteGuarantor}
                isReadOnly={isReadOnly}
              />
            </StepContent>
          </Step>
          <Step
            title={t('PAYMENT')}
            btnDoneDisabled={this.isPayAndContinueDisabled}
            lblDone={continueWithoutPayment ? t('CONTINUE') : t('PAY_AND_CONTINUE')}
            onBeforeStepClose={args => (args.cancel = true)}>
            <StepContent container={false}>
              <ApplicationCharges />
              <ApplicationFadvAuthorization model={model} />
            </StepContent>
          </Step>
        </Stepper>
        <PaymentDialog
          dialogOpen={application.paymentDialogOpen}
          model={paymentModel}
          applicantDetails={applicantDetails}
          onCanceledPay={() => this.handlePaymentDialog(false)}
        />
        <PaymentReceivedDialog
          open={application.paymentReceivedDialogOpen}
          closeDialog={() => this.handlePaymentReceivedDialog(false)}
          onPaymentReceived={this.handleOnPaymentReceived}
          onOpening={this.handleOnOpeningPaymentReceived}
          countDownSeconds={countDownSeconds}
        />
        <AddressRecommendationDialogWrapper onHandleAction={this.handleAddressRecommendationAction} />
        <AppFooter />
      </div>
    );
  };
}
