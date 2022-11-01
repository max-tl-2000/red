/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { Stepper, Step, StepSummary } from 'components';
import { ChildrenSummary } from 'custom-components/PartyAdditionalInfo/Children';
import { PetSummary } from 'custom-components/PartyAdditionalInfo/Pet';
import { VehicleSummary } from 'custom-components/PartyAdditionalInfo/Vehicle';
import { ApplicationDetailsSummary } from '../application-details/application-details-summary';
import { IncomeSourceSummary } from '../../custom-components/income-source';
import { AddressSummary } from '../../custom-components/address-history';
import { DisclosureSummary } from '../../custom-components/disclosures';
import { DocumentsSummary } from '../../custom-components/documents/documents-summary';
import { cf } from './applicant-information-stepper.scss';

const STEPPER_COLLAPSED_INDEX = 9;

const applicationInformationStepperComponent = ({ residentNumber, applicantInformation }) => {
  const {
    applicantDetailsModel,
    incomeSourceHistoryModel,
    addressHistoryModel,
    privateDocumentsModel,
    disclosuresModel,
    childrenModel,
    petsModel,
    vehiclesModel,
    sharedDocumentsModel,
  } = applicantInformation || {};

  return (
    <Stepper className={cf('application-stepper')} selectedIndex={STEPPER_COLLAPSED_INDEX} summaryOnly>
      <Step title={t('APPLICANT_DETAILS')}>
        <StepSummary>{applicantDetailsModel && <ApplicationDetailsSummary model={applicantDetailsModel} residentNumber={residentNumber} />}</StepSummary>
      </Step>
      <Step
        title={t('INCOME_SOURCE_plural')}
        helperText={t('INCOME_SOURCE_HELPER_TEXT', {
          income: applicantDetailsModel.fields.grossIncome.value,
          currency: '$',
        })}>
        <StepSummary>{incomeSourceHistoryModel && <IncomeSourceSummary incomeSources={incomeSourceHistoryModel.items} />}</StepSummary>
      </Step>
      <Step title={t('ADDRESS_HISTORY')} helperText={t('ADDRESS_HISTORY_HELPER_TEXT')}>
        <StepSummary>{addressHistoryModel && <AddressSummary addresses={addressHistoryModel.items} />}</StepSummary>
      </Step>
      <Step title={t('PRIVATE_DOCUMENT_plural')} helperText={t('PRIVATE_DOCUMENTS_HELPER_TEXT')}>
        <StepSummary>{privateDocumentsModel && <DocumentsSummary documents={privateDocumentsModel.files} shouldIncludeDownloadLink />}</StepSummary>
      </Step>
      <Step title={t('DISCLOSURE_plural')} helperText={t('DISCLOSURES_HELPER_TEXT')}>
        <StepSummary>{disclosuresModel && <DisclosureSummary disclosures={disclosuresModel.selected} />}</StepSummary>
      </Step>
      <Step title={t('MINORS')} helperText={t('CHILDREN_HELPER_TEXT')}>
        <StepSummary>{childrenModel && <ChildrenSummary>{childrenModel.items}</ChildrenSummary>}</StepSummary>
      </Step>
      <Step title={t('PETS_AND_ASSISTANCE_ANIMALS')} helperText={t('PETS_HELPER_TEXT')}>
        <StepSummary>{petsModel && <PetSummary pets={petsModel.items} />}</StepSummary>
      </Step>
      <Step title={t('VEHICLE_plural')} helperText={t('VEHICLES_HELPER_TEXT')}>
        <StepSummary>{vehiclesModel && <VehicleSummary vehicles={vehiclesModel.items} />}</StepSummary>
      </Step>
      <Step title={t('SHARED_DOCUMENT_plural')} helperText={t('SHARED_DOCUMENTS_HELPER_TEXT')}>
        <StepSummary>{sharedDocumentsModel && <DocumentsSummary documents={sharedDocumentsModel.files} shouldIncludeDownloadLink />}</StepSummary>
      </Step>
    </Stepper>
  );
};

export const ApplicantInformationStepper = observer(applicationInformationStepperComponent);
