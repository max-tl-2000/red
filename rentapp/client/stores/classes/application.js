/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed, toJS } from 'mobx';

import { ChildrenStore } from 'custom-components/PartyAdditionalInfo/Children';
import { VehicleStore } from 'custom-components/PartyAdditionalInfo/Vehicle';
import { PetStore } from 'custom-components/PartyAdditionalInfo/Pet';

import { logger } from 'client/logger';
import get from 'lodash/get';
import isUndefined from 'lodash/isUndefined';
import isEmpty from 'lodash/isEmpty';
import { IncomeSourceHistory } from './income-source-history';
import { AddressHistory } from './address-history';
import { Disclosure } from './disclosure';
import { Documents } from './documents';
import { InsuranceChoice } from './insurance-choice';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { applicantDetailsModel } from '../../models/applicant-details-model';
import { DATE_US_FORMAT, YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import { ApplicationFees } from './application-fees';
import { getPersonContactInfo, getPersonInfo } from '../../helpers/utils';
import { getApplicantName, shouldInviteGuarantor } from '../../../../common/helpers/applicants-utils';
import { applicationDocumentTypes } from '../../../common/application-constants';
import { getDisplayName } from '../../../../common/helpers/person-helper';
import { getApplicantProfile } from '../../helpers/applicant-local-profile';
import { toMoment } from '../../../../common/helpers/moment-utils';
import { ApplicationSections, ApplicationSettingsValues } from '../../../../common/enums/applicationTypes';
import { isGuarantor } from '../../../../common/helpers/party-utils';
import { RentappTypes } from '../../../common/enums/rentapp-types';

export class Application {
  @observable
  applicant;

  @observable
  personApplication;

  @observable
  personApplicationError;

  @observable
  additionalInfo;

  @observable
  details;

  @observable
  paymentDialogOpen;

  @observable
  paymentReceivedDialogOpen;

  @observable
  isPaymentDialogWaiting;

  @observable
  localProfile;

  @observable
  _displayMessages;

  @observable
  _applicationSettings;

  @observable
  applicantNotFoundError;

  @observable
  memberRemovedError;

  @observable
  partyClosedError;

  @observable
  memberMergedError;

  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.additionalInfo = {};
    this.details = {};
    this._applicantDetailsModel = null;
    this.runInitializations();
    this.details.applicationFees = new ApplicationFees({ apiClient, parent: this });
    this.paymentDialogOpen = false;
    this.paymentReceivedDialogOpen = false;
    this.isPaymentDialogWaiting = false;
    this.applicantNotFoundError = null;

    this.apiClient.on(
      'request:error',
      action((_evt, err) => {
        if (err.token === DALTypes.ApplicantErrors.APPLICANT_NOT_FOUND || err.token === DALTypes.ApplicantErrors.INACTIVE_PROPERTY) {
          this.applicantNotFoundError = err;
        }

        if (err.token === DALTypes.ApplicantErrors.PARTY_MEMBER_REMOVED) {
          this.memberRemovedError = err;
        }
        if (err.token === DALTypes.ApplicantErrors.PARTY_CLOSED) {
          this.partyClosedError = err;
        }

        if (err.token === DALTypes.ApplicantErrors.PARTY_MEMBER_MERGED) {
          this.memberMergedError = err;
        }
      }),
    );
  }

  @computed
  get applicantEmail() {
    return this._emailConfirmedInPartI || this.emailFromApplicantObject;
  }

  _getMemberDefaultEmail = (partyMembers, personId) => {
    const partyMember = partyMembers.find(pm => pm && pm.personId === personId);
    return partyMember?.contactInfo?.emails?.find(email => email.id === partyMember.contactInfo.defaultEmailId)?.value;
  };

  @computed
  get emailFromApplicantObject() {
    const { partyMembers, personId, commonUserEmail, _getMemberDefaultEmail } = this;
    return commonUserEmail || _getMemberDefaultEmail(partyMembers, personId);
  }

  @computed
  get applicantName() {
    const name = !this._applicantDetailsModel ? (this.applicant || {}).personName : this._applicantDetailsModel.fields.firstName.value;
    const applicantName = getApplicantName(name);

    if (!applicantName.firstName) {
      const contactInfo = (this.applicant && getPersonContactInfo(this.applicant.partyMembersInfo, this.applicant.personId)) || {};
      return { firstName: getDisplayName({ contactInfo }) };
    }

    return applicantName;
  }

  @computed
  get continueWithoutPayment() {
    return this.details.applicationFees.totalAmount === 0;
  }

  @computed
  get displayMessages() {
    return this._displayMessages;
  }

  @computed
  get quoteId() {
    return (this.applicant && this.applicant.quoteId) || '';
  }

  @computed
  get propertyId() {
    return (this.applicant && this.applicant.propertyId) || '';
  }

  @computed
  get propertyInfo() {
    return (this.applicant && this.applicant.propertyInfo) || {};
  }

  @computed
  get propertyName() {
    return (this.propertyInfo && this.propertyInfo.propertyName) || '';
  }

  @computed
  get contactUsLink() {
    return (this.applicant && this.applicant.contactUsLink) || '';
  }

  @computed
  get hasMultipleApplications() {
    return (this.applicant && this.applicant.hasMultipleApplications) || false;
  }

  @computed
  get shouldRedirectToApplicationList() {
    return (this.applicant && this.applicant.redirectToApplicationList) || false;
  }

  @computed
  get partyType() {
    return (this.applicant && this.applicant.partyType) || DALTypes.PartyTypes.TRADITIONAL;
  }

  @computed
  get isApplicantRemovedFromParty() {
    return !!this.applicantNotFoundError;
  }

  @computed
  get isMemberRemovedFromParty() {
    return !!this.memberRemovedError;
  }

  @computed
  get isPartyClosed() {
    return !!this.partyClosedError;
  }

  @computed
  get isPartyMemberMerged() {
    return !!this.memberMergedError;
  }

  generatePropertyPolicies(inventoryPropertyPolicies) {
    const propertyPolicies = [];
    inventoryPropertyPolicies.length > 0 && propertyPolicies.push(...inventoryPropertyPolicies);
    inventoryPropertyPolicies.length === 0 &&
      propertyPolicies.push(...((this.applicant && this.applicant.propertyInfo.propertyPolicies && toJS(this.applicant.propertyInfo.propertyPolicies)) || []));
    return propertyPolicies;
  }

  getApplicantDisplayName(usePreferred) {
    if (this.isApplicantRemovedFromParty) return { firstName: this.applicantNotFoundError?.data?.applicantName || '' };

    if (!this.applicant) return { firstName: '' };

    const person = getPersonInfo(this.applicant.partyMembersInfo, this.applicant.personId) || {};
    const options = usePreferred ? { usePreferred, ignoreContactInfo: true } : {};
    return { firstName: getDisplayName(person, options) };
  }

  @computed
  get partyId() {
    return (this.isApplicantRemovedFromParty ? this.applicantNotFoundError?.data?.partyId : this.applicant?.partyId) || '';
  }

  @computed
  get applicationObject() {
    const applicant = this.applicant || {};
    const applicationObject = applicant.applicationObject || {};
    return applicationObject;
  }

  @computed
  get isApplicationCompleted() {
    const applicationStatus = this.applicationObject.applicationStatus || '';
    return applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED;
  }

  @computed
  get partyApplicationId() {
    return this.applicationObject.partyApplicationId;
  }

  @computed
  get personApplicationId() {
    return this.applicationObject.id;
  }

  @computed
  get personId() {
    return (this.applicant && this.applicant.personId) || '';
  }

  @computed
  get tenantDomain() {
    if (this.applicant) return this.applicant.tenantDomain || '';

    return this.applicantNotFoundError?.data?.tenantDomain || '';
  }

  @computed
  get partyMembers() {
    return (this.applicant && this.applicant.partyMembersInfo) || [];
  }

  @computed
  get commonUserEmail() {
    return this.applicant && this.applicant.commonUserEmail;
  }

  @computed
  get leasingAgent() {
    return (this.applicant && this.applicant.leasingAgent) || {};
  }

  @computed
  get impersonatorUserId() {
    return !!this.applicant?.impersonatorUserId || false;
  }

  @computed
  get apiToken() {
    return this.apiClient.headers && this.apiClient.headers.apiToken;
  }

  @computed
  get initialAddress() {
    if (!this.hasPersonApplicationData && !this.hasApplicantDetailsData) return {};

    const { address, addressLine, addressLine1, addressLine2, city, state, zip, haveInternationalAddress: hasInternationalAddress } = this
      .hasPersonApplicationData
      ? this.personApplication.applicationData
      : this.applicantDetails;

    let addressEnteredByUser = {
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
    };

    if (address && address.enteredByUser) {
      addressEnteredByUser = address.enteredByUser;
    }
    return { ...addressEnteredByUser, addressLine, hasInternationalAddress };
  }

  @computed
  get hasPersonApplicationData() {
    return !!(this.personApplication && this.personApplication.applicationData);
  }

  @computed
  get hasApplicantDetailsData() {
    return !!this.applicantDetails;
  }

  @computed
  get initialIncomeSource() {
    if (!this.hasPersonApplicationData && !this.hasApplicantDetailsData) return {};
    const { grossIncome, grossIncomeFrequency } = this.hasPersonApplicationData ? this.personApplication.applicationData : this.applicantDetails;
    return { grossIncome, grossIncomeFrequency };
  }

  @computed
  get paymentCompleted() {
    return this.applicationObject.paymentCompleted;
  }

  @computed
  get applicantDetails() {
    const applicantDetails = this.applicationObject.applicationData || {};
    const { address = {}, dateOfBirth, ...rest } = applicantDetails;

    const addressEnteredByUser = address.enteredByUser || {};
    return toJS({
      ...rest,
      dateOfBirth: (dateOfBirth && toMoment(dateOfBirth, { parseFormat: YEAR_MONTH_DAY_FORMAT }).format(DATE_US_FORMAT)) || '',
      addressLine1: addressEnteredByUser.line1,
      addressLine2: addressEnteredByUser.line2,
      city: addressEnteredByUser.city,
      state: addressEnteredByUser.state,
      zip: addressEnteredByUser.postalCode,
    });
  }

  @computed
  get isReadOnly() {
    return (this.applicant || {}).isPromotionApproved;
  }

  @action
  setDisplayMessage(value) {
    // this will cause the reaction to be executed and sync the value
    this._displayMessages = value;
    this.localProfile.set('displayMessages', value);
  }

  @action
  syncLocalProfile() {
    if (!this.personApplicationId) return;
    this.localProfile = getApplicantProfile(this.personApplicationId);
    this._displayMessages = this.localProfile.get('displayMessages', true);
  }

  @action
  async fetchApplicant({ reload, forceFetch } = {}) {
    if (!this.applicant || forceFetch) {
      try {
        this.applicantNotFoundError = null;
        const params = {
          reload,
        };
        logger.debug('Fetching applicant from server');
        this.applicant = await this.apiClient.get('/applicant', { params });
        logger.debug({ applicant: this.applicant }, 'Got applicant');
        this.applicantDetailsModel.resetPrefilledState(forceFetch);
        this.syncLocalProfile();
        !forceFetch && this.runInitializations();
      } catch (err) {
        logger.error({ err }, 'Error getting applicant data');
        this.applicantNotFoundError = err;
      }
    }
    return this.applicant;
  }

  getApplicationDocumentsByType = queueType =>
    queueType === applicationDocumentTypes.PRIVATE_DOCUMENTS_TYPE
      ? this.additionalInfo.personApplicationDocuments
      : this.additionalInfo.partyApplicationDocuments;

  @action
  addApplicationDocuments(queueType, files) {
    const documents = this.getApplicationDocumentsByType(queueType);
    this._addDocumentsInFileList(documents, files);
  }

  @action
  updateCategoryInApplicationDocuments(queueType, fileId, categoryId) {
    const documents = this.getApplicationDocumentsByType(queueType);
    documents.updateCategory(fileId, categoryId);
  }

  @action
  removeFileFromApplicationDocuments(queueType, fileId) {
    const documents = this.getApplicationDocumentsByType(queueType);
    documents.removeFile(fileId);
  }

  @action
  _addDocumentsInFileList(fileList, files) {
    files.forEach(fileEntry => {
      fileEntry.isValid && fileList.addFile(fileEntry);
    });
  }

  @action
  _handleSubmitPersonApplicationError(err) {
    logger.error({ err }, 'Error updating person application');
    this.personApplicationError = err.token || err.message;
  }

  @action
  _handleSubmitPersonApplicationSuccess(result) {
    this.personApplication = result;
  }

  @action
  _updateConfirmedEmailInPartI = email => {
    this._emailConfirmedInPartI = email;
  };

  @action
  async submitPersonApplication(personApplication, shouldUpdatePerson) {
    logger.debug({ personApplication }, 'Updating person application with screeningData');
    personApplication = {
      data: { ...personApplication.data, shouldUpdatePerson },
    };

    try {
      this.personApplicationError = '';
      this.applicantNotFoundError = null;
      const resp = await this.apiClient.post('/personApplications/current/screeningData', personApplication);

      if (resp.error) {
        logger.warn(resp.error, 'Error updating person application');
        this.personApplicationError = resp.error.token;
        this.applicantDetailsModel.setApplicationError(this.personApplicationError, resp.error);
        return;
      }

      logger.debug({ personApplication: resp }, 'Got person application from updating screeningData');
      const applicationData = get(personApplication, 'data.applicationData');
      const ssn = get(resp, 'applicationData.ssn');
      const itin = get(resp, 'applicationData.itin');
      this.applicantDetailsModel.fillInformation({ ...applicationData, ssn, itin }, { reset: false });
      this._updateConfirmedEmailInPartI(applicationData.email);
      this._handleSubmitPersonApplicationSuccess(resp);
    } catch (err) {
      this._handleSubmitPersonApplicationError(err);
      this.applicantDetailsModel.setApplicationError(this.personApplicationError, err);
    }
  }

  // this is used when there is a timeout after payment completed to
  // handle cases in which we may have somehow missed the async notification
  // It ONLY updates the paymentCompleted field of the application object
  async fetchPaymentCompleted() {
    logger.debug('fetchPaymentCompleted');
    try {
      // use a fairly short timeout here since the user has been waiting awhile, and it's
      // likely at this point that something is quite wrong...
      const {
        applicationObject: { paymentCompleted },
      } = await this.apiClient.get('/applicant', { timeout: 2000 });
      logger.debug({ paymentCompleted }, 'Got applicant payment status');
      // should we bother updating the rest of the model here?
      this.applicationObject.paymentCompleted = paymentCompleted;
      return paymentCompleted;
    } catch (err) {
      // TODO : improve error handling
      logger.error({ err }, 'Unable to fetch payment status!');
      return Promise.reject(err);
    }
  }

  @action
  _handleCompletePersonApplicationError(err) {
    logger.error({ err }, 'Error completing the person application');
    this.personApplicationError = err.token || err.message;
  }

  @action
  _handleCompletePersonApplicationSuccess(personApplication) {
    logger.debug({ personApplication }, 'Got person application from updating complete status');
    this.personApplication = personApplication;
  }

  @action
  async completePersonApplication() {
    logger.debug('Update person appplication to complete status');
    try {
      if (this.isApplicationCompleted) return;
      this.personApplicationError = '';
      const resp = await this.apiClient.patch('/personApplications/current', { data: { applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED } });
      this._handleCompletePersonApplicationSuccess(resp);
    } catch (err) {
      this._handleCompletePersonApplicationError(err);
    }
  }

  @action
  initializePartyAdditionalInfo(apiClient, partyId) {
    if (!partyId) return;

    this.additionalInfo.children = new ChildrenStore({ apiClient, partyId });
    this.additionalInfo.vehicle = new VehicleStore({ apiClient, partyId });
    this.additionalInfo.pets = new PetStore({ apiClient, partyId });
    this.additionalInfo.insuranceChoice = new InsuranceChoice({ apiClient, partyId });
  }

  @action
  initializePersonApplicationAdditionalData(apiClient) {
    this.additionalInfo.incomeSourceHistory = new IncomeSourceHistory({ apiClient });
    this.additionalInfo.addressHistory = new AddressHistory({ apiClient });
    this.additionalInfo.disclosures = new Disclosure({ apiClient });
  }

  @action
  initializePartyApplicationDocuments() {
    this.additionalInfo.partyApplicationDocuments = new Documents({ apiClient: this.apiClient, path: '/partyApplications', userId: this.partyApplicationId });
  }

  @action
  initializePersonApplicationDocuments() {
    this.additionalInfo.personApplicationDocuments = new Documents({
      apiClient: this.apiClient,
      path: '/personApplications',
      userId: this.personApplicationId,
    });
  }

  @action
  runInitializations() {
    this.initializePartyAdditionalInfo(this.apiClient, this.partyId);
    this.initializePersonApplicationAdditionalData(this.apiClient);
    this.initializePartyApplicationDocuments();
    this.initializePersonApplicationDocuments();
  }

  @action
  async loadAdditionalDataModels() {
    logger.debug('Fetching additionalData from server');
    try {
      this.incomeSourceError = '';
      this.personApplicationError = '';
      const resp = await this.apiClient.get('/personApplications/current/additionalData');
      logger.debug({ additionalData: resp }, 'Got additionalData');
      const additionalData = (resp.additionalData && resp.additionalData) || {};
      const { incomeSourceHistory, addressHistory, disclosures } = additionalData;
      incomeSourceHistory && this.additionalInfo.incomeSourceHistory.populateIncomeSource(incomeSourceHistory);
      addressHistory && this.additionalInfo.addressHistory.createAddressModels(addressHistory);
      if (disclosures) {
        const disclosuresList = await this.apiClient.get('/disclosures');
        await this.additionalInfo.disclosures.fillItems(disclosuresList, false);
        this.additionalInfo.disclosures.selectDisclosures(disclosures);
        this.additionalInfo.disclosures.currentState = disclosures;
      }
      this.additionalInfo.insuranceChoice.loadInsuranceChoice();
    } catch (err) {
      logger.error({ err }, 'Error loading additional data');
      this.personApplicationError = err.token || err.message;
    }
  }

  @computed
  get isPersonGuarantor() {
    const members = this.partyMembers;
    const personId = this.personId;
    return members.some(member => member.personId === personId && member.memberType === DALTypes.MemberType.GUARANTOR);
  }

  // lazily evaluate the model creation to avoid
  // issues when the model is recreated because of
  // a page resize
  get applicantDetailsModel() {
    if (!this._applicantDetailsModel) {
      this._applicantDetailsModel = applicantDetailsModel.create(this);
    }
    return this._applicantDetailsModel;
  }

  @computed
  get displayRecommendedAddressDialog() {
    return this.applicantDetailsModel.hasRecommendedAddress;
  }

  @computed
  get isPartyLevelGuarantor() {
    const { residentOrPartyLevelGuarantor } = this.applicant || {};
    return residentOrPartyLevelGuarantor === DALTypes.GuarantorLevel.PARTY;
  }

  @computed
  get partyLevelGuarantor() {
    let partyLevelGuarantor;
    if (!this.isPartyLevelGuarantor) return partyLevelGuarantor;

    partyLevelGuarantor = (this.partyMembers || []).find(member => isGuarantor(member));

    return partyLevelGuarantor;
  }

  @computed
  get displayInviteGuarantor() {
    const members = this.partyMembers || [];
    const { residentOrPartyLevelGuarantor } = this.applicant || {};

    return shouldInviteGuarantor(members, this.personId, residentOrPartyLevelGuarantor);
  }

  @computed
  get memberType() {
    const { partyMembers: members, personId } = this;
    const currentMember = members.find(member => member.personId === personId);
    return currentMember && currentMember.memberType;
  }

  @action
  setPaymentDialogStatus(showDialog) {
    this.paymentDialogOpen = showDialog;
  }

  @action
  setPaymentDialogToWaitingMode(waiting) {
    if (waiting && !this.paymentDialogOpen) return;
    this.isPaymentDialogWaiting = waiting;
  }

  @action
  setPaymentReceivedDialogStatus(showDialog) {
    this.paymentReceivedDialogOpen = showDialog;
  }

  getPersonByEmail = async email => {
    const persons = await this.apiClient.post('/search/persons', {
      data: {
        emails: [email],
        filters: {
          includeSpam: true,
          excludedPersonId: this.personId,
        },
      },
    });
    if (!persons.length) return null;

    return persons.find(person => person.contactInfo.emails.some(e => e.value.toLowerCase() === email.toLowerCase()));
  };

  redirectToAdditionalInfo = (token, shouldShowPaymentReceivedDialog = false, origin = 'applicantDetails') => {
    const isReopened = this.paymentDialogOpen && !this.isPaymentDialogWaiting;
    if (shouldShowPaymentReceivedDialog && (!this.paymentDialogOpen || isReopened)) {
      this.isReopened && this.setPaymentDialogStatus(false);
      this.setPaymentReceivedDialogStatus(true);
      return;
    }

    this.setPaymentDialogToWaitingMode(false);
    this.setPaymentDialogStatus(false);
    window.location.replace(`/applicationAdditionalInfo/${token}?origin=${origin}`);

    // QUESTION we shouldn't ever get here, right?
    logger.trace('Payment receiver replaced URL to part 2');
  };

  saveEvent = async ({ eventType, localIP }) => {
    if (this.isApplicantRemovedFromParty || !this.personApplicationId) return;

    this.apiClient.post('/personApplications/current/events', { data: { eventType, localIP, personApplicationId: this.personApplicationId } });
  };

  @computed
  get shouldDisplayError() {
    if (this.additionalInfo) {
      const {
        partyApplicationDocuments,
        personApplicationDocuments,
        children,
        vehicle,
        pets,
        incomeSourceHistory,
        addressHistory,
        disclosures,
        insuranceChoice,
      } = this.additionalInfo;
      return (
        (partyApplicationDocuments && partyApplicationDocuments.documentsError) ||
        (personApplicationDocuments && personApplicationDocuments.documentsError) ||
        (children && children.partyAdditionalInfo && children.partyAdditionalInfo.additionalInfoError) ||
        (vehicle && vehicle.partyAdditionalInfo && vehicle.partyAdditionalInfo.additionalInfoError) ||
        (pets && pets.partyAdditionalInfo && pets.partyAdditionalInfo.additionalInfoError) ||
        (incomeSourceHistory && incomeSourceHistory.incomeSourceError) ||
        (addressHistory && addressHistory.additionalDataError) ||
        (disclosures && disclosures.additionalDataError) ||
        (insuranceChoice && insuranceChoice.additionalDataError)
      );
    }
    return false;
  }

  @action
  setApplicationSettings(applicationSettings) {
    this._applicationSettings = applicationSettings;
  }

  additionalInfoListHasItems = (section, list) => {
    if (
      this._applicationSettings[section] === ApplicationSettingsValues.REQUIRED &&
      this.additionalInfo &&
      this.additionalInfo[list] &&
      !this.additionalInfo[list].hasItems
    ) {
      return false;
    }
    return true;
  };

  addressHistoryHasValidOwnerName = () => {
    let validOwnerName = true;
    if (this.additionalInfo?.addressHistory) {
      const items = this.additionalInfo.addressHistory.items;
      validOwnerName = !items.some(item => item.ownOrRent === RentappTypes.PropertyType.RENT && isEmpty(item.ownerName));
    }
    return validOwnerName;
  };

  additionalInfoDocumentsHasItems = (section, documentName) => {
    if (
      this._applicationSettings[section] === ApplicationSettingsValues.REQUIRED &&
      this.additionalInfo &&
      this.additionalInfo[documentName] &&
      this.additionalInfo[documentName].documents &&
      !this.additionalInfo[documentName].documents.length
    ) {
      return false;
    }
    return true;
  };

  @computed
  get isIncomeSourcesSectionCompleted() {
    return (
      this._applicationSettings.skipIncomeSourcesSection || this.additionalInfoListHasItems(ApplicationSections.incomeSourcesSection, 'incomeSourceHistory')
    );
  }

  @computed
  get isAddressHistorySectionCompleted() {
    return (
      this._applicationSettings.skipAddressHistorySection ||
      (this.additionalInfoListHasItems(ApplicationSections.addressHistorySection, 'addressHistory') && this.addressHistoryHasValidOwnerName())
    );
  }

  @computed
  get isDisclosuresSectionCompleted() {
    return this.additionalInfoListHasItems(ApplicationSections.disclosuresSection, 'disclosures');
  }

  @computed
  get isPrivateDocumentsSectionCompleted() {
    return (
      this._applicationSettings.skipPrivateDocumentsSection ||
      this.additionalInfoDocumentsHasItems(ApplicationSections.privateDocumentsSection, 'personApplicationDocuments')
    );
  }

  @computed
  get isChildrenSectionCompleted() {
    return this._applicationSettings.skipChildrenSection || this.additionalInfoListHasItems(ApplicationSections.childrenSection, 'children');
  }

  @computed
  get isPetsSectionCompleted() {
    return this._applicationSettings.skipPetsSection || this.additionalInfoListHasItems(ApplicationSections.petsSection, 'pets');
  }

  @computed
  get isVehiclesSectionCompleted() {
    return this._applicationSettings.skipVehiclesSection || this.additionalInfoListHasItems(ApplicationSections.vehiclesSection, 'vehicle');
  }

  @computed
  get isSharedDocumentsSectionCompleted() {
    return (
      this._applicationSettings.skipSharedDocumentsSection ||
      this.additionalInfoDocumentsHasItems(ApplicationSections.sharedDocumentsSection, 'partyApplicationDocuments')
    );
  }

  @computed
  get isRentersInsuranceSectionCompleted() {
    if (this._applicationSettings[ApplicationSections.rentersInsuranceSection] === ApplicationSettingsValues.REQUIRED) {
      if (this.additionalInfo && this.additionalInfo.insuranceChoice && isUndefined(this.additionalInfo.insuranceChoice.defaultInsuranceSelected)) {
        return false;
      }
    }
    return true;
  }

  @computed
  get areRequiredSectionCompleted() {
    if (!this._applicationSettings) return false;

    return Object.values(ApplicationSections)
      .map(section => `${section[0].toUpperCase()}${section.substr(1)}`)
      .every(section => this[`is${section}Completed`]);
  }
}
