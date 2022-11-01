/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, reaction } from 'mobx';

import { ChildrenStore } from 'custom-components/PartyAdditionalInfo/Children';
import { VehicleStore } from 'custom-components/PartyAdditionalInfo/Vehicle';
import { PetStore } from 'custom-components/PartyAdditionalInfo/Pet';

import { IncomeSourceHistory } from './income-source-history';
import { AddressHistory } from './address-history';
import { Disclosure } from './disclosure';
import { Documents } from './documents';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { applicantDetailsModel as applicantDetailsFactory } from '../../models/applicant-details-model';
import { getApplicantName } from '../../../../common/helpers/applicants-utils';
import { isResident, isOccupant, isGuarantor } from '../../../../common/helpers/party-utils';
import { addParamsToUrl } from '../../../../common/helpers/urlParams';

export class ApprovalProcessSummary {
  @observable
  screeningSummary;

  @observable
  screeningSummaryError;

  @observable
  loadingData;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
  }

  @action
  initializeComponents({ agentToken, partyId }) {
    this.partyId = partyId;
    const apiClient = this.apiClient;

    // TODO: The store doesn't need to know about the token.
    // since this will be executed inside an iframe. We need to create another entry point
    // the creation of this entry point will be done as part of another story.
    if (agentToken) {
      apiClient.setExtraHeaders({
        Authorization: `Bearer ${agentToken}`,
      });
    }
    this.loadingData = true;
    reaction(
      () => ({ incompleteRecommendation: this.incompleteRecommendation }),
      ({ incompleteRecommendation }) => {
        if (!(incompleteRecommendation && incompleteRecommendation.membersWithIncompleteApplications.length)) {
          this.loadingData = false;
          return;
        }

        incompleteRecommendation.membersWithIncompleteApplications.forEach(applicant => {
          applicant.applicantName = applicant.fullName;
          applicant.applicantDetails = {
            ...getApplicantName(applicant.fullName),
            email: (applicant.contactInfo || {}).defaultEmail,
          };
          this.createApplicantDetailsStoreHandler(applicant);
        });
        this.loadingData = false;
      },
    );
  }

  isAnApplicant(personId) {
    return [...this.residents, ...this.occupants, ...this.guarantors].some(member => member.personId === personId);
  }

  getCompletedApplications(personApplications) {
    return personApplications.filter(
      application => application.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED && this.isAnApplicant(application.personId),
    );
  }

  // the flow must show at least paid to start the screening, we should revisit once we start using all the states
  getNotStartedApplications(personApplications) {
    return personApplications.filter(
      application =>
        application.applicationStatus !== DALTypes.PersonApplicationStatus.COMPLETED &&
        application.applicationStatus !== DALTypes.PersonApplicationStatus.PAID &&
        this.isAnApplicant(application.personId),
    );
  }

  getIncompleteApplicants(partyMembers = [], applications = [], translationToken, isCompleteApplicationData = false) {
    const membersWithIncompleteApplications = partyMembers.filter(
      partyMember =>
        !applications.some(
          applicant => applicant.personId === partyMember.personId && [DALTypes.PersonApplicationStatus.COMPLETED].includes(applicant.applicationStatus),
        ),
    );

    if (!(membersWithIncompleteApplications && membersWithIncompleteApplications.length)) {
      return undefined;
    }

    return {
      membersWithIncompleteApplications,
      translationToken,
      isCompleteApplicationData,
    };
  }

  @computed
  get incompleteRecommendation() {
    const { residents = [], guarantors = [], occupants = [] } = this.screeningSummary || {};
    const completedApplicants = residents.concat(occupants, guarantors);

    const incompleteApplicants = this.getIncompleteApplicants(this.partyMembers || [], completedApplicants, 'INCOMPLETE_DATA');
    return (
      incompleteApplicants ||
      this.getIncompleteApplicants((this.residents || []).concat(this.occupants || []), this.completedApplications, 'INCOMPLETE_APPLICATION_DATA', true)
    );
  }

  @action
  _handleFetchScreeningSummaryError(err) {
    this.screeningSummaryError = err.token || err.message;
  }

  @action
  _handleFetchScreeningSummarySuccess(result) {
    this.screeningSummary = result;
  }

  @action
  async fetchScreeningSummary({ partyId, quoteId, leaseTermId }) {
    if (!this.screeningSummary) {
      try {
        const url = addParamsToUrl(`/screeningSummary/${partyId}`, { quoteId, leaseTermId });
        const fetchResult = await this.apiClient.get(url);
        const [partyMembers, personApplications] = await Promise.all([
          this.apiClient.get(`/parties/${partyId}/members`),
          this.apiClient.get(`/party/${partyId}/personApplications`),
        ]);

        this.partyMembers = partyMembers;
        this.residents = partyMembers.filter(member => isResident(member.memberType));
        this.occupants = partyMembers.filter(member => isOccupant(member.memberType));
        this.guarantors = partyMembers.filter(member => isGuarantor(member.memberType));
        this.completedApplications = this.getCompletedApplications(personApplications);
        this.notStartedApplications = this.getNotStartedApplications(personApplications);
        this._handleFetchScreeningSummarySuccess(fetchResult);
        this.createApplicantDetailsStores();
        if (!this.incompleteRecommendation) {
          this.loadingData = false;
        }
      } catch (e) {
        this.loadingData = false;
        this._handleFetchScreeningSummaryError(e);
      }
    }
    return this.screeningSummary;
  }

  formatApplicantDetails = (applicantDetails = {}) => {
    const { enteredByUser: addressEnteredByUser = {} } = applicantDetails.address || {};

    return {
      ...applicantDetails,
      addressLine1: addressEnteredByUser.line1,
      addressLine2: addressEnteredByUser.line2,
      city: addressEnteredByUser.city,
      state: addressEnteredByUser.state,
      zip: addressEnteredByUser.postalCode,
    };
  };

  createApplicantDetailsStoreHandler = async item => {
    const apiClient = this.apiClient;
    const partyId = this.partyId;
    const applicantInformation = {
      applicantDetailsModel: applicantDetailsFactory.create(),
      incomeSourceHistoryModel: new IncomeSourceHistory({ apiClient }),
      addressHistoryModel: new AddressHistory({ apiClient }),
      privateDocumentsModel: new Documents({ apiClient }),
      disclosuresModel: new Disclosure({ apiClient }),
      childrenModel: new ChildrenStore({ apiClient, partyId }),
      petsModel: new PetStore({ apiClient, partyId }),
      vehiclesModel: new VehicleStore({ apiClient, partyId }),
      sharedDocumentsModel: new Documents({ apiClient }),
    };
    const { applicantDetails, incomeSourceHistory, addressHistory, privateDocuments, disclosures, children, pets, vehicles, sharedDocuments } = item;
    applicantInformation.applicantDetailsModel.fillInformation(this.formatApplicantDetails(applicantDetails));

    applicantInformation.incomeSourceHistoryModel.populateIncomeSource(incomeSourceHistory);

    applicantInformation.addressHistoryModel.createAddressModels(addressHistory);

    applicantInformation.privateDocumentsModel.fillItems(privateDocuments);

    await applicantInformation.disclosuresModel.loadDisclosures(false);
    applicantInformation.disclosuresModel.selectDisclosures(disclosures);

    applicantInformation.childrenModel.fillItems(children);

    applicantInformation.petsModel.fillItems(pets);

    applicantInformation.vehiclesModel.fillItems(vehicles);

    applicantInformation.sharedDocumentsModel.fillItems(sharedDocuments);

    item.applicantInformation = applicantInformation;
  };

  createApplicantDetailsStores = () => {
    const { residents = [], guarantors = [], occupants = [] } = this.screeningSummary;
    residents.forEach(item => this.createApplicantDetailsStoreHandler(item));
    guarantors.forEach(item => this.createApplicantDetailsStoreHandler(item));
    occupants.forEach(item => this.createApplicantDetailsStoreHandler(item));
  };
}
