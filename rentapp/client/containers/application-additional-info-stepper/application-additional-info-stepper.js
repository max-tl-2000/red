/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { t } from 'i18next';
import isEqual from 'lodash/isEqual';
import isUndefined from 'lodash/isUndefined';
import { toTitleCase } from 'helpers/capitalize';
import {
  Stepper,
  Step,
  StepSummary,
  StepContent,
  Typography as T,
  IconButton,
  MultiFileUploader,
  Icon,
  Tooltip,
  Dialog,
  DialogOverlay,
  NotificationBanner,
} from 'components';
import { ChildrenCollection, ChildrenSummary } from 'custom-components/PartyAdditionalInfo/Children';
import { PetCollection, PetSummary } from 'custom-components/PartyAdditionalInfo/Pet';
import { VehicleCollection, VehicleSummary } from 'custom-components/PartyAdditionalInfo/Vehicle';
import { cf } from './application-additional-info-stepper.scss';
import cfg from '../../../../client/helpers/cfg';

import { rentappContext, applicationDocumentTypes } from '../../../common/application-constants';
import { CATEGORIES, MULTIFILE_UPLOADER_PATH } from '../../../../common/document-constants';
import { IncomeSourceCollection, IncomeSourceSummary } from '../../custom-components/income-source';
import { AddressHistoryCollection, AddressSummary } from '../../custom-components/address-history';
import { Disclosures, DisclosureSummary } from '../../custom-components/disclosures';
import { InsuranceChoice, InsuranceChoiceSummary } from '../../custom-components/insurance-choice';
import { DocumentsSummary } from '../../custom-components/documents/documents-summary';
import { ApplicantName } from '../applicant/applicant-name';
import { getFormattedIncome } from '../../helpers/utils';
import { USD } from '../../../../common/currency';
import { ApplicationSections, ApplicationSettingsValues } from '../../../../common/enums/applicationTypes';
import { ForbidEditionBanner } from '../application/forbid-application-edition-banner';

import { CollectionOptions } from './collection-options';

const { Text, SubHeader } = T;

const INCOME_SOURCE_STEP = 'incomeSourceHistory';
const ADDRESS_HISTORY_STEP = 'addressHistory';
const PRIVATE_DOCUMENTS_STEP = 'personApplicationDocuments';
const DISCLOSURES_STEP = 'disclosures';
const CHILDREN_STEP = 'children';
const PETS_STEP = 'pets';
const VEHICLES_STEP = 'vehicle';
const SHARED_DOCUMENTS_STEP = 'partyApplicationDocuments';
const RENTER_INSURANCE_STEP = 'insuranceChoice';
const { PRIVATE_DOCUMENTS_TYPE, SHARED_DOCUMENTS_TYPE } = applicationDocumentTypes;

const steps = [
  {
    setting: 'incomeSourcesSection',
    type: INCOME_SOURCE_STEP,
    loadItem: 'loadItems',
    items: 'items',
  },
  {
    setting: 'addressHistorySection',
    type: ADDRESS_HISTORY_STEP,
    loadItem: 'loadItems',
    items: 'items',
  },
  {
    setting: 'privateDocumentsSection',
    type: PRIVATE_DOCUMENTS_STEP,
    loadItem: 'loadDocuments',
    items: 'files',
  },
  {
    setting: 'disclosuresSection',
    type: DISCLOSURES_STEP,
    loadItem: 'loadDisclosures',
    items: 'selected',
  },
  {
    setting: 'childrenSection',
    type: CHILDREN_STEP,
    loadItem: 'loadItems',
    items: 'items',
  },
  {
    setting: 'petsSection',
    type: PETS_STEP,
    loadItem: 'loadItems',
    items: 'items',
  },
  {
    setting: 'vehiclesSection',
    type: VEHICLES_STEP,
    loadItem: 'loadItems',
    items: 'items',
  },
  {
    setting: 'sharedDocumentsSection',
    type: SHARED_DOCUMENTS_STEP,
    loadItem: 'loadDocuments',
    items: 'files',
  },
  {
    setting: 'rentersInsuranceSection',
    type: RENTER_INSURANCE_STEP,
  },
];

@inject('auth', 'application', 'applicationSettings')
@observer
export class ApplicationAdditionalInfoStepper extends Component {
  constructor(props) {
    super(props);
    const additionalInfo = props.application.additionalInfo || {};

    this.state = {
      selectedIndex: -1,
      additionalInfo,
    };
  }

  compareApplicationTo = newApplication => isEqual(this.props.application, newApplication);

  isNotAPreloadedStep = stepType => ![INCOME_SOURCE_STEP, ADDRESS_HISTORY_STEP, DISCLOSURES_STEP, RENTER_INSURANCE_STEP].includes(stepType);

  isAdditionalInfoStepAndHaveToBeShown = (type, additionalInfo) =>
    type === RENTER_INSURANCE_STEP && !isUndefined(additionalInfo.insuranceChoice.defaultInsuranceSelected);

  isNotAdditionalInfoStepAndHaveToBeShown = (type, additionalInfo, items) =>
    type !== RENTER_INSURANCE_STEP && additionalInfo[type] && additionalInfo[type][items].length;

  loadInfoAndSetStepperAtLastEdition = async additionalInfo => {
    const additionalInfoSteps = this.getAdditionalInfoSteps();
    for (let i = 0; i < additionalInfoSteps.length; i++) {
      const { type, loadItem, items, index } = additionalInfoSteps[i];
      if (this.isNotAPreloadedStep(type)) {
        await additionalInfo[type][loadItem]();
      }

      if (this.isAdditionalInfoStepAndHaveToBeShown(type, additionalInfo) || this.isNotAdditionalInfoStepAndHaveToBeShown(type, additionalInfo, items)) {
        // We have to "open" every step or else the data won't show in the
        // colapsed state.
        this.setState({
          selectedIndex: index,
        });
      }
    }

    const incomeSourceStepIndex = this.getIndexForStep(additionalInfoSteps, INCOME_SOURCE_STEP);
    this.setState({ selectedIndex: incomeSourceStepIndex });
  };

  isStepVisible = setpSection => setpSection !== ApplicationSettingsValues.HIDDEN;

  getAdditionalInfoSteps = () => {
    const { applicationSettings } = this.props;
    return steps
      .filter(step => this.isStepVisible(applicationSettings[step.setting]))
      .map((step, index) => ({
        ...step,
        index,
      }));
  };

  getIndexForStep = (additionalInfoSteps, stepType, defaultIndex = 0) =>
    (additionalInfoSteps.find(step => step.type === stepType) || { index: defaultIndex }).index;

  isDisclosureVisible = () => {
    const { applicationSettings } = this.props;
    return this.isStepVisible(applicationSettings.disclosuresSection);
  };

  async componentWillMount() {
    const { auth, application } = this.props;
    if (auth.isAuthenticated) {
      const { additionalInfo } = application;
      await this.loadInfoAndSetStepperAtLastEdition(additionalInfo);
      application.details.applicationFees.fetchFees();
    }
  }

  loadModelIfOnStep = (stepIndex, selectedIndex, model, loadModelFn) => {
    const stepLoaded = model && model.loaded;

    if (!stepLoaded && stepIndex === selectedIndex) {
      loadModelFn && loadModelFn.apply(model);
    }
  };

  loadStepsInSequence = (stepsInSequence, selectedIndex, additionalInfo) =>
    stepsInSequence.forEach(step => this.loadModelIfOnStep(step.index, selectedIndex, additionalInfo[step.type], additionalInfo[step.type][step.loadItem]));

  saveDisclosuresOnStep = (stepIndex, disclosureModel) => {
    const { selectedIndex } = this.state;
    if (!(stepIndex === selectedIndex && disclosureModel.isDirty)) return;
    disclosureModel.submitDisclosures();
  };

  handleChange = ({ selectedIndex }) => {
    const { additionalInfo } = this.state;

    const additionalInfoSteps = this.getAdditionalInfoSteps();
    if (this.isDisclosureVisible()) {
      const stepsWihtoutDisclosureStep = additionalInfoSteps.filter(step => step.type !== DISCLOSURES_STEP);
      this.loadStepsInSequence(stepsWihtoutDisclosureStep, selectedIndex, additionalInfo);

      const disclosureStepIndex = this.getIndexForStep(additionalInfoSteps, DISCLOSURES_STEP, -1);
      if (disclosureStepIndex >= 0) {
        this.loadModelIfOnStep(disclosureStepIndex, selectedIndex, additionalInfo.disclosures, additionalInfo.disclosures.loadDisclosures);
        this.saveDisclosuresOnStep(disclosureStepIndex, additionalInfo.disclosures);
      }
    } else {
      this.loadStepsInSequence(additionalInfoSteps, selectedIndex, additionalInfo);
    }

    this.setState({
      selectedIndex,
    });
  };

  handleDismissMessages = () => this.props.application.setDisplayMessage(false);

  handleFileUploadedCategory = (queueType, fileId, categoryId) => this.props.application.updateCategoryInApplicationDocuments(queueType, fileId, categoryId);

  hasPaymentNotification = () => !!cfg('origin');

  handleFileUploaded = (queueType, file) => this.props.application.addApplicationDocuments(queueType, [file]);

  handleDeleteFileUploaded = (queueType, { id }) => this.props.application.removeFileFromApplicationDocuments(queueType, id);

  validateStep = async (args, collection) => {
    collection && collection.collectionPanel && (await collection.collectionPanel.validateAndSave(args));
  };

  validateOnChangeAddressType = async collection => {
    collection && collection.collectionPanel && (await collection.collectionPanel.validateOnChangeType());
  };

  validateAndUpdateDisclosure = (args, disclosures) => {
    disclosures.updateInteracted(disclosures);
    if (!disclosures.isInteracted) args.cancel = true;
    return;
  };

  setRef = (prop, instance) => (this[prop] = instance);

  render = () => {
    const { additionalInfo, selectedIndex } = this.state;
    const { applicationSettings, application } = this.props;
    const {
      incomeSourceHistory,
      addressHistory,
      disclosures,
      children,
      pets,
      vehicle,
      personApplicationDocuments,
      partyApplicationDocuments,
      insuranceChoice,
    } = additionalInfo;

    const {
      initialIncomeSource,
      initialAddress,
      shouldDisplayError,
      leasingAgent,
      continueWithoutPayment,
      displayMessages,
      isIncomeSourcesSectionCompleted,
      isAddressHistorySectionCompleted,
      isPrivateDocumentsSectionCompleted,
      isChildrenSectionCompleted,
      isPetsSectionCompleted,
      isVehiclesSectionCompleted,
      isSharedDocumentsSectionCompleted,
      isDisclosuresSectionCompleted,
      isRentersInsuranceSectionCompleted,
    } = application;

    const {
      incomeSourcesSection,
      addressHistorySection,
      childrenSection,
      disclosuresSection,
      petsSection,
      privateDocumentsSection,
      rentersInsuranceSection,
      sharedDocumentsSection,
      vehiclesSection,
      skipPetsSection,
      skipChildrenSection,
      skipSharedDocumentsSection,
      skipVehiclesSection,
      skipIncomeSourcesSection,
      skipPrivateDocumentsSection,
      skipAddressHistorySection,
      finishButtonWasClicked,
    } = applicationSettings;
    const applicationIsReadOnly = this.props.isReadOnly;
    const applicantName = this.props.application.getApplicantDisplayName(true);
    const getRequiredText = setting => (setting === ApplicationSettingsValues.REQUIRED ? ` (${t('REQUIRED')})` : '');
    const showPartySection = (setting, skipSection) => setting === ApplicationSettingsValues.OPTIONAL || !skipSection;
    const renderWarningMessage = () => (
      <NotificationBanner contentWrapperStyle={{ background: 'none' }} type="warning" content={t('WARNING_TEXT_FOR_INCOMPLETED_REQUIRED_SECTION')} />
    );

    const getSubHeader = (title, setting, displayIcon = false) => (
      <SubHeader>
        {`${toTitleCase(title)}${getRequiredText(setting)}`}
        {displayIcon && (
          <Tooltip text={t('PRIVATE_INFORMATION_NOT_VISIBLE_TO_OTHER_APPLICANTS')}>
            <Icon name="lock" className={cf('icon-step-header')} />
          </Tooltip>
        )}
      </SubHeader>
    );

    const grossIncome = {
      income: getFormattedIncome({
        income: initialIncomeSource.grossIncome,
        frequency: initialIncomeSource.grossIncomeFrequency,
        currency: USD.code,
      }),
    };
    const stepperIndex = applicationIsReadOnly ? this.getIndexForStep(this.getAdditionalInfoSteps(), SHARED_DOCUMENTS_STEP, selectedIndex) : selectedIndex;
    const showPaymentProcessSuccessMessage = this.hasPaymentNotification() && !continueWithoutPayment;
    const areThereAnyDisclosuresSelected = disclosures.selected.length;

    const renderMessages = () => (
      <div className={cf('message-block')}>
        {showPaymentProcessSuccessMessage && (
          <div className={cf('text', 'payment-message')}>
            <Text>{t('PAYMENT_PROCESSED_SUCCESS')}</Text>
          </div>
        )}
        <div className={cf('text')} id="accountMessage">
          <Text secondary>{t('ACCOUNT_CREATED')}</Text>
        </div>
        <div className={cf('button')}>
          <IconButton iconName="close" onClick={this.handleDismissMessages} />
        </div>
      </div>
    );

    return (
      <div>
        {shouldDisplayError && (
          <Dialog open={true} closeOnEscape={false}>
            <DialogOverlay>
              <div className={cf('error-dialog')}>
                <Icon className={cf('alert')} name={'alert'} />
                <SubHeader>{t('GENERIC_ERROR_MESSAGE')}</SubHeader>
                <div className={cf('agent')}>
                  <SubHeader bold>{leasingAgent.fullName}</SubHeader>
                  <SubHeader>{leasingAgent.email}</SubHeader>
                  <SubHeader>{leasingAgent.displayPhoneNumber}</SubHeader>
                </div>
              </div>
            </DialogOverlay>
          </Dialog>
        )}
        <div className={cf('welcome-message')}>
          <T.Headline secondary inline id="welcome-headline">
            {t('WELCOME_BACK')}
          </T.Headline>
          <ApplicantName applicantName={applicantName} symbol={'!'} />
        </div>
        {applicationIsReadOnly && <ForbidEditionBanner />}
        {displayMessages && renderMessages()}
        {!applicationIsReadOnly && (
          <div className={cf('instructions')} id="instructions">
            <Text>{t('COMPLETE_YOUR_APPLICATION')}</Text>
          </div>
        )}
        <Stepper
          data-id="residentStepper"
          nonLinear
          summaryOnly={applicationIsReadOnly}
          selectedIndex={stepperIndex}
          onStepChange={this.handleChange}
          className={cf('additional-info-stepper')}
          warningMessage={renderWarningMessage()}
          showWarningMessage>
          {incomeSourcesSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="incomeSourcesSection"
              title={getSubHeader(t('INCOME_SOURCES'), incomeSourcesSection, true)}
              helperText={t('INCOME_SOURCE_HELPER_TEXT', grossIncome)}
              onBeforeGoNext={args => this.validateStep(args, this.incomeSourceCollection)}
              requiredStepComplete={!(finishButtonWasClicked && !isIncomeSourcesSectionCompleted)}>
              <StepContent>
                <CollectionOptions section={ApplicationSections.incomeSourcesSection} model={incomeSourceHistory} entityLabel={'INCOME_SOURCE'} />
                {showPartySection(incomeSourcesSection, skipIncomeSourcesSection) && incomeSourceHistory && (
                  <IncomeSourceCollection
                    ref={node => this.setRef('incomeSourceCollection', node)}
                    viewModel={incomeSourceHistory}
                    initialIncomeSource={initialIncomeSource}
                  />
                )}
              </StepContent>
              <StepSummary>{incomeSourceHistory && <IncomeSourceSummary incomeSources={incomeSourceHistory.items} />}</StepSummary>
            </Step>
          )}
          {addressHistorySection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="addressHistorySection"
              title={getSubHeader(t('ADDRESS_HISTORY'), addressHistorySection, true)}
              helperText={t('ADDRESS_HISTORY_HELPER_TEXT')}
              onBeforeGoNext={args => this.validateStep(args, this.addressHistoryCollection)}
              requiredStepComplete={!(finishButtonWasClicked && !isAddressHistorySectionCompleted)}>
              <StepContent>
                {!skipAddressHistorySection && addressHistory && (
                  <AddressHistoryCollection
                    ref={node => this.setRef('addressHistoryCollection', node)}
                    viewModel={addressHistory}
                    initialAddress={initialAddress}
                    validateOnChange={() => this.validateOnChangeAddressType(this.addressHistoryCollection)}
                  />
                )}
              </StepContent>
              <StepSummary>{addressHistory && <AddressSummary addresses={addressHistory.items} />}</StepSummary>
            </Step>
          )}
          {privateDocumentsSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="privateDocumentsSection"
              title={getSubHeader(t('PRIVATE_DOCUMENT_plural'), privateDocumentsSection, true)}
              helperText={t('PRIVATE_DOCUMENTS_HELPER_TEXT')}
              requiredStepComplete={!(finishButtonWasClicked && !isPrivateDocumentsSectionCompleted)}>
              <StepContent container>
                {!skipPrivateDocumentsSection && personApplicationDocuments && (
                  <MultiFileUploader
                    files={personApplicationDocuments.files}
                    uploadPath={MULTIFILE_UPLOADER_PATH}
                    ref="privateFileUploader"
                    dataId="privateFileUploader"
                    queueType={PRIVATE_DOCUMENTS_TYPE}
                    token={this.props.auth.token}
                    categories={CATEGORIES}
                    isCategoryRequired={true}
                    onChangeCategory={this.handleFileUploadedCategory}
                    onFileUploaded={this.handleFileUploaded}
                    onDeleteItem={this.handleDeleteFileUploaded}
                    context={rentappContext}
                  />
                )}
              </StepContent>
              <StepSummary>{<DocumentsSummary type="private" documents={(personApplicationDocuments || {}).files} />}</StepSummary>
            </Step>
          )}
          {disclosuresSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="disclosuresSection"
              title={getSubHeader(t('DISCLOSURE_plural'), disclosuresSection, false)}
              helperText={t('DISCLOSURES_HELPER_TEXT')}
              selectedIndex={stepperIndex}
              onBeforeGoNext={args => areThereAnyDisclosuresSelected && this.validateAndUpdateDisclosure(args, disclosures)}
              onBeforeStepChange={args => (args.cancel = !disclosures.valid)}
              onClose={() => disclosures.restoreState()}
              requiredStepComplete={!(finishButtonWasClicked && !isDisclosuresSectionCompleted)}>
              <StepContent container>{disclosures && <Disclosures viewModel={disclosures} />}</StepContent>
              <StepSummary>{disclosures && <DisclosureSummary disclosures={disclosures.selected} />}</StepSummary>
            </Step>
          )}
          {childrenSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="childrenSection"
              title={getSubHeader(t('MINORS'), childrenSection, false)}
              helperText={t('CHILDREN_HELPER_TEXT')}
              onBeforeGoNext={args => this.validateStep(args, this.childrenCollection)}
              requiredStepComplete={!(finishButtonWasClicked && !isChildrenSectionCompleted)}>
              <StepContent>
                <CollectionOptions section={ApplicationSections.childrenSection} model={children} entityLabel={'CHILD'} />
                {showPartySection(childrenSection, skipChildrenSection) && children && (
                  <ChildrenCollection ref={node => this.setRef('childrenCollection', node)} viewModel={children} />
                )}
              </StepContent>
              <StepSummary>{children && <ChildrenSummary>{children.items}</ChildrenSummary>}</StepSummary>
            </Step>
          )}
          {petsSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="petsSection"
              title={getSubHeader(t('PETS_AND_ASSISTANCE_ANIMALS'), petsSection, false)}
              helperText={t('PETS_HELPER_TEXT')}
              onBeforeGoNext={args => this.validateStep(args, this.petCollection)}
              requiredStepComplete={!(finishButtonWasClicked && !isPetsSectionCompleted)}>
              <StepContent>
                <CollectionOptions section={ApplicationSections.petsSection} model={pets} entityLabel={'PET'} />
                {showPartySection(petsSection, skipPetsSection) && pets && <PetCollection ref={node => this.setRef('petCollection', node)} viewModel={pets} />}
              </StepContent>
              <StepSummary>{pets && <PetSummary pets={pets.items} />}</StepSummary>
            </Step>
          )}
          {vehiclesSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="vehiclesSection"
              title={getSubHeader(t('VEHICLE_plural'), vehiclesSection, false)}
              helperText={t('VEHICLES_HELPER_TEXT')}
              onBeforeGoNext={args => this.validateStep(args, this.vehicleCollection)}
              requiredStepComplete={!(finishButtonWasClicked && !isVehiclesSectionCompleted)}>
              <StepContent>
                <CollectionOptions section={ApplicationSections.vehiclesSection} model={vehicle} entityLabel={'VEHICLE'} />
                {showPartySection(vehiclesSection, skipVehiclesSection) && vehicle && (
                  <VehicleCollection ref={node => this.setRef('vehicleCollection', node)} viewModel={vehicle} />
                )}
              </StepContent>
              <StepSummary>{vehicle && <VehicleSummary vehicles={vehicle.items} />}</StepSummary>
            </Step>
          )}
          {sharedDocumentsSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="sharedDocumentsSection"
              title={getSubHeader(t('SHARED_DOCUMENT_plural'), sharedDocumentsSection, false)}
              helperText={t('SHARED_DOCUMENTS_HELPER_TEXT')}
              requiredStepComplete={!(finishButtonWasClicked && !isSharedDocumentsSectionCompleted)}>
              <StepContent container>
                {!skipSharedDocumentsSection && partyApplicationDocuments && (
                  <MultiFileUploader
                    files={partyApplicationDocuments.files}
                    uploadPath={MULTIFILE_UPLOADER_PATH}
                    ref="sharedFileUploader"
                    dataId="sharedFileUploader"
                    queueType={SHARED_DOCUMENTS_TYPE}
                    token={this.props.auth.token}
                    categories={CATEGORIES}
                    isCategoryRequired={true}
                    onChangeCategory={this.handleFileUploadedCategory}
                    onFileUploaded={this.handleFileUploaded}
                    onDeleteItem={this.handleDeleteFileUploaded}
                    context={rentappContext}
                    sharedFiles={true}
                    partyApplicationId={this.props.application.partyApplicationId}
                  />
                )}
              </StepContent>
              <StepSummary>{<DocumentsSummary type="shared" documents={(partyApplicationDocuments || {}).files} />}</StepSummary>
            </Step>
          )}
          {rentersInsuranceSection !== ApplicationSettingsValues.HIDDEN && (
            <Step
              id="rentersInsuranceSection"
              title={getSubHeader(t('RENTER_INSURANCE'), rentersInsuranceSection, false)}
              helperText={t('RENTER_INSURANCE_HELPER_TEXT')}
              btnNextDisabled={false}
              requiredStepComplete={!(finishButtonWasClicked && !isRentersInsuranceSectionCompleted)}>
              <StepContent container>{insuranceChoice && <InsuranceChoice insuranceChoice={insuranceChoice} />}</StepContent>
              <StepSummary>{insuranceChoice && <InsuranceChoiceSummary insuranceChoice={insuranceChoice} />}</StepSummary>
            </Step>
          )}
        </Stepper>
      </div>
    );
  };
}
