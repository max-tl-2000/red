/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer, inject } from 'mobx-react';
import { TwoPanelPage, LeftPanel, RightPanel, Button, CardMenu, CardMenuItem, PreloaderBlock } from 'components';
import { t } from 'i18next';
import isUndefined from 'lodash/isUndefined';
import { showMsgBox } from 'components/MsgBox/showMsgBox';
import * as T from 'components/Typography/Typography';
import { push } from '../../../../client/helpers/navigator';
import { Page } from '../../custom-components/page/page';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { cf } from './application-additional-info.scss';
import { ApplicationAdditionalInfoStepper } from '../application-additional-info-stepper/application-additional-info-stepper';
import { ApplicationPanel } from '../application-panel/application-panel';
import { ApplicationDetailsDialog } from '../application-details/application-details-dialog';
import { AppFooter } from '../../custom-components/app-footer/app-footer';
import AddressRecommendationDialogWrapper from '../application-details/address-recommendation-dialog-wrapper';
import { ApplicationErrorBlock } from '../application/application-error-block';

const DISMISS_ON_CLICK_ACTION = 'dismissOnClick';
const SWITCH_APPLICATION_ACTION = 'switchApplication';

@inject('auth', 'application', 'applicationSettings')
@observer
export class ApplicationAdditionalInfo extends React.Component {
  // eslint-disable-line react/prefer-stateless-function
  constructor(props) {
    super(props);
    this.state = {
      model: props.application.applicantDetailsModel,
      isEditApplicantInfoOpen: false,
      isApplicantLoading: true,
    };
  }

  async componentWillMount() {
    if (!this.props.auth.isAuthenticated) return;

    await this.props.application.fetchApplicant();
    if (this.props.application.isApplicantRemovedFromParty) return;

    await this.populateApplicationSettings();
    await this.populateModelWithApplicant();

    const { model } = this.state;
    if (model.prefilledAlready) return;
    const { personId, partyMembers, commonUserEmail } = this.props.application || {};
    model.prefill({ partyMembers, personId, initializeData: false, commonUserEmail });
  }

  populateModelWithApplicant = async () => {
    const { application } = this.props;
    await application.loadAdditionalDataModels();
    this.setState({ isApplicantLoading: false });
    const { model } = this.state;
    !application.personApplication && model.fillInformation(application.applicantDetails);
  };

  populateApplicationSettings = async () => {
    const { applicationSettings, application } = this.props;
    const { partyType, memberType, propertyId } = application;
    await applicationSettings.fetchApplicationSettings(propertyId, partyType, memberType);
    await applicationSettings.fetchAdditionalData();
    await applicationSettings.fetchApplicationlData();
  };

  showWarningDialogForIncompletedRequiredSections = () => {
    const msgBoxOptions = {
      id: 'incompleteRequiredSectionDialog',
      title: t('WARNING_DIALOG_TITLE_FOR_INCOMPLETED_REQUIRED_SECTIONS'),
      lblOK: t('OK_GOT_IT'),
      lblCancel: '',
    };
    showMsgBox(<T.Text>{t('WARNING_DIALOG_DECRIPTION_FOR_INCOMPLETED_REQUIRED_SECTIONS')}</T.Text>, msgBoxOptions);
  };

  handleIAmDone = async () => {
    const { model } = this.state;
    const {
      auth,
      application: { isApplicationCompleted, areRequiredSectionCompleted },
      applicationSettings,
    } = this.props;
    applicationSettings.storeFinishButtonAction();
    areRequiredSectionCompleted && !isApplicationCompleted && (await model.complete());
    if (this.props.application.isApplicantRemovedFromParty) return;

    if (areRequiredSectionCompleted) {
      auth.logout({ skipOnLogoutEvent: true });
      push('/applicationComplete');
    } else {
      this.showWarningDialogForIncompletedRequiredSections();
    }
  };

  handleApplicantInformationDialog = showDialog => this.setState({ isEditApplicantInfoOpen: showDialog });

  restoreModelFromInitialState = () => {
    const { restoreInitialData, interacted } = this.state.model;
    if (interacted) restoreInitialData();
    this.handleApplicantInformationDialog(false);
  };

  handleSubmitApplicantInformation = async () => {
    const { model } = this.state;
    const { personId, partyId } = this.props.application;

    await model.validate();
    if (model.valid && model.isDirty) {
      const shouldUpdatePerson = true;
      await model.submit(personId, partyId, shouldUpdatePerson);
      !model.personApplicationError && this.handleApplicantInformationDialog(false);
    }
  };

  isInsuranceChoiceSelected = () => {
    const application = this.props.application;
    return (
      application &&
      application.additionalInfo &&
      application.additionalInfo.insuranceChoice &&
      !isUndefined(application.additionalInfo.insuranceChoice.defaultInsuranceSelected)
    );
  };

  handleSwitchApplication = async () => {
    const { auth } = this.props;
    push(`/applicationList/${auth.token}?${auth.userId}`);
  };

  handleContextMenuAction = ({ action } = {}) => {
    if (action === DISMISS_ON_CLICK_ACTION) {
      this.applicationContextMenu && this.applicationContextMenu.toggle();
    } else if (action === SWITCH_APPLICATION_ACTION) {
      this.handleSwitchApplication();
    }
  };

  renderAppBarActions = applicationIsReadOnly => {
    const { application, auth } = this.props;
    const { hasMultipleApplications, isApplicantRemovedFromParty } = application;
    if (isApplicantRemovedFromParty) return <noscript />;

    return (
      <CardMenu
        iconName="dots-vertical"
        id="applicationMenu"
        ref={ref => {
          this.applicationContextMenu = ref;
        }}
        onSelect={this.handleContextMenuAction}
        iconStyle="light">
        {hasMultipleApplications && auth.isUserLogged && <CardMenuItem text={t('SWITCH_APPLICATION')} action={SWITCH_APPLICATION_ACTION} />}
        <CardMenuItem
          text={applicationIsReadOnly ? t('VIEW_APPLICANT_INFORMATION') : t('EDIT_APPLICANT_INFORMATION')}
          onClick={() => this.handleApplicantInformationDialog(true)}
          action={DISMISS_ON_CLICK_ACTION}
        />
        {!auth.isImpersonation && <CardMenuItem text={t('SIGN_OUT')} onClick={() => auth.logout()} />}
      </CardMenu>
    );
  };

  render() {
    const {
      application,
      application: { quoteId, partyId, propertyName, isReadOnly: applicationIsReadOnly, isApplicationCompleted, isApplicantRemovedFromParty },
    } = this.props;
    const { model, isApplicantLoading } = this.state;
    const doneBtnLabel = isApplicationCompleted ? 'FINISH' : 'I_AM_DONE';

    return (
      <Page appBar={<RentAppBar propertyName={propertyName} appBarActions={this.renderAppBarActions(applicationIsReadOnly)} />}>
        {!isApplicantRemovedFromParty && (
          <TwoPanelPage responsiveState="row">
            <LeftPanel>
              <div style={{ paddingBottom: 30 }}>
                {!isApplicantLoading && <ApplicationAdditionalInfoStepper isReadOnly={applicationIsReadOnly} />}
                {isApplicantLoading && <PreloaderBlock />}

                <ApplicationDetailsDialog
                  open={this.state.isEditApplicantInfoOpen}
                  onSubmit={this.handleSubmitApplicantInformation}
                  onCancel={this.restoreModelFromInitialState}
                  applicantModel={model}
                  isGuarantor={application && application.isPersonGuarantor}
                  isReadOnly={applicationIsReadOnly}
                />

                <AddressRecommendationDialogWrapper onHandleAction={this.handleSubmitApplicantInformation} />

                {!applicationIsReadOnly && (
                  <div className={cf('button-container')}>
                    <Button label={t(doneBtnLabel)} onClick={this.handleIAmDone} id="btnIAmDone" />
                  </div>
                )}
                <AppFooter />
              </div>
            </LeftPanel>
            <RightPanel>
              <div className={cf('wrapper-container')}>{partyId && <ApplicationPanel reflow quoteId={quoteId} partyId={partyId} />}</div>
            </RightPanel>
          </TwoPanelPage>
        )}
        <ApplicationErrorBlock />
      </Page>
    );
  }
}
