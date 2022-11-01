/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { action, extendObservable, autorun, reaction, computed } from 'mobx';
import { createModel } from 'helpers/Form/FormModel';
import { t } from 'i18next';
import isEqual from 'lodash/isEqual';
import { validatePhone as validatePhoneFormat } from 'helpers/phone-utils';
import nullish from 'helpers/nullish';
import { DALTypes } from '../../../common/enums/DALTypes';
import { canMemberBeInvitedToApply } from '../../../common/helpers/quotes';
import { isSSNValid } from '../../../common/helpers/validations';
import { isValidDOB } from '../../../common/helpers/form-validations/dob';
import { isEmailValid } from '../../../common/helpers/validations/email';
import PaymentModel from './payment-model';
import { parseApplicantAddress, isIncomeSourceNegative, incomeSourceFieldHasValue } from '../helpers/utils';
import { checkPrefix, checkSuffix, getLastNameAndMiddlename } from '../../../common/helpers/applicants-utils';
import { isItin } from '../../../common/helpers/validations/ssn';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { isAnonymousEmail } from '../../../common/helpers/anonymous-email';
import { APPLICANT_SUFFIX_MAX_CHARACTERS } from '../../common/application-constants';

export const applicantDetailsModel = {
  create(application) {
    let prefilledEmail;

    const doesPersonAlreadyExists = email => application.getPersonByEmail(email);
    const isDifferentThanPrefilledEmail = email => prefilledEmail !== email;
    const wasAlreadyInvited = (currentInvites, newInvites) => currentInvites.some(currentInvite => newInvites.some(({ text }) => currentInvite.text === text));

    const initialState = {
      id: '',
      firstName: '',
      lastName: '',
      middleName: '',
      suffix: '',
      dateOfBirth: '',
      email: '',
      phone: '',
      socSecNumber: '',
      grossIncome: '',
      grossIncomeFrequency: 'YEARLY',
      haveInternationalAddress: false,
      addressLine: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
      invitedToApply: '',
      otherApplicants: [],
      guarantors: [],
      reportCopyRequested: true,
    };

    const model = createModel(initialState, {
      firstName: { required: t('FIRST_NAME_REQUIRED') },
      lastName: { required: t('LAST_NAME_REQUIRED') },
      suffix: {
        fn: async field => {
          const { value } = field;
          if (!value) return true;

          if (value.length > APPLICANT_SUFFIX_MAX_CHARACTERS) {
            return { error: t('SUFFIX_TOO_LONG') };
          }

          return true;
        },
      },
      city: { required: t('CITY_REQUIRED') },
      state: { required: t('STATE_REQUIRED') },
      zip: { required: t('ZIP_REQUIRED') },
      addressLine: { required: t('ADDRESS_LINE_REQUIRED') },
      addressLine1: { required: t('ADDRESS_LINE_1_REQUIRED') },
      dateOfBirth: {
        waitForBlur: true,
        required: t('DATEOFBIRTH_REQUIRED'),
        fn: isValidDOB,
      },
      email: {
        required: t('EMAIL_REQUIRED'),
        interactive: false,
        waitForBlur: true,
        fn: async field => {
          const { value } = field;
          if (!value) return true;

          if (!isEmailValid(value)) {
            return { error: t('INVALID_EMAIL') };
          }

          if (isAnonymousEmail(value)) {
            return { error: t('TEMPORARY_EMAIL_ERROR_MESSAGE') };
          }

          if (isDifferentThanPrefilledEmail(value) && (await doesPersonAlreadyExists(value))) {
            return { error: t('EMAIL_ALREADY_EXISTS') };
          }

          return true;
        },
      },
      phone: {
        interactive: false,
        waitForBlur: true,
        fn: async field => {
          const { value } = field;
          if (!value) return true;

          const validationResult = validatePhoneFormat(value);
          if (!validationResult.valid) {
            return { error: t(validationResult.reason) };
          }

          return true;
        },
      },
      grossIncome: {
        required: t('GROSS_INCOME_REQUIRED'),
        fn: field => isIncomeSourceNegative(field),
        hasValue: value => incomeSourceFieldHasValue(value),
      },
      socSecNumber: {
        waitForBlur: true,
        errorMessage: t('SSN_INVALID'),
        fn: data => !data.value || isSSNValid(data.value) || data.value === model._initialData.socSecNumber,
      },
      otherApplicants: {
        interactive: false,
        fn: (field, fields) => {
          const { value } = field;
          if (!value) return true;

          const { guarantors } = fields;

          return wasAlreadyInvited(guarantors.value, value) ? { error: t('ALREADY_INVITED_ERROR_MESSAGE') } : true;
        },
      },
      guarantors: {
        interactive: false,
        fn: (field, fields) => {
          const { value } = field;
          if (!value) return true;

          const { otherApplicants } = fields;

          return wasAlreadyInvited(otherApplicants.value, value) ? { error: t('ALREADY_INVITED_ERROR_MESSAGE') } : true;
        },
      },
    });

    const getInvitedToApply = (members, currentPersonId) => {
      const invitedToApply = members
        .filter(member => member.personId !== currentPersonId && canMemberBeInvitedToApply(member))
        .map(item => {
          if (item.memberType === DALTypes.MemberType.GUARANTOR) {
            const guaranteedByList = members.filter(x => x.guaranteedBy === item.id);
            const guaranteedBy = guaranteedByList
              .reduce((acc, guaranteed) => {
                acc.push(getDisplayName(guaranteed, { usePreferred: true }));
                return acc;
              }, [])
              .join(', ');
            const preferredDisplayName = getDisplayName(item, { usePreferred: true });
            return guaranteedBy
              ? `${preferredDisplayName} (${t('GUARANTOR_FOR', {
                  displayName: guaranteedBy,
                })})`
              : `${preferredDisplayName} (${t('GUARANTOR')})`;
          }
          return getDisplayName(item, { usePreferred: true });
        });
      return invitedToApply.join(', ');
    };

    const getPersonFieldValue = (members, currentPersonId, field, subField = '') => {
      const member = members.filter(person => person.personId === currentPersonId);
      const fieldValue = member && member[0] ? member[0][field] : '';
      if (fieldValue && subField) {
        return fieldValue[subField][0] && fieldValue[subField][0].value ? fieldValue[subField][0].value : '';
      }
      return fieldValue || '';
    };

    const findMemberById = (members, memberId) => (members && members.find(member => member && member.personId === memberId)) || {};

    const getPersonDefaultEmailAddress = person => person.contactInfo.emails.find(email => email.id === person.contactInfo.defaultEmailId) || {};
    const getPersonDefaultPhone = person => person.contactInfo.phones.find(phone => phone.id === person.contactInfo.defaultPhoneId) || {};

    const getMemberDefaultEmailAddressFromList = (members, memberId) => {
      const member = findMemberById(members, memberId);
      const emailAddress = getPersonDefaultEmailAddress(member);
      const textEmailAddress = !emailAddress.isAnonymous ? member.contactInfo.defaultEmail : '';
      return { emailAddress, textEmailAddress };
    };

    const getMemberDefaulPhoneFromList = (members, memberId) => {
      const member = findMemberById(members, memberId);
      const phone = getPersonDefaultPhone(member);
      const textPhone = !phone.isAnonymous ? member.contactInfo.defaultPhone : '';
      return { phone, textPhone };
    };

    const getFormDataForMemberId = (members, memberId, commonUserEmail) => {
      const fullName = getPersonFieldValue(members, memberId, 'fullName');
      const fullNameArray = fullName.split(' ');

      if (checkPrefix(fullNameArray[0])) fullNameArray.shift();
      if (!checkSuffix(fullNameArray[fullNameArray.length - 1])) fullNameArray.push('');

      return {
        fullName,
        fullNameArray,
        email: commonUserEmail || getMemberDefaultEmailAddressFromList(members, memberId).textEmailAddress,
        phone: getMemberDefaulPhoneFromList(members, memberId).textPhone,
      };
    };

    const updatePersonModel = (fullNameArray, email, phone) => {
      model.updateField('firstName', fullNameArray.shift(), true);
      model.updateField('suffix', fullNameArray.pop(), true);
      const partialLastName = fullNameArray.pop();

      const { middleName, lastName } = getLastNameAndMiddlename(fullNameArray, partialLastName);

      model.updateField('lastName', lastName, true);
      model.updateField('middleName', middleName, true);
      model.updateField('email', email, true);
      model.updateField('phone', phone, true);
    };

    let currentState = { ...model.serializedData };

    extendObservable(model, {
      _members: [],
      _currentPersonId: '',
      _recommendedAddress: null,
      _useRecommendedAddress: false,
    });

    model._initialData = {};

    const applicantDetailsViewModel = extendObservable(model, {
      _fullName: '',
      _shouldValidateLegalName: true,
      _previousFullName: '',
      // TODO This has been built for this field so that it can be called in the UI directly. All fields should follow this approach client/components/Persons/PersonModel.js
      // this model can be refactored in another task.
      invitedToApply(val) {
        model.updateField('invitedToApply', val);
      },
      get originalFullName() {
        return this._fullName;
      },
      get isDirty() {
        if (applicantDetailsViewModel.personApplicationError) return true;

        const data = applicantDetailsViewModel.serializedData;
        return !isEqual(data, currentState);
      },
      get personApplicationError() {
        return application.personApplicationError;
      },
      get emails() {
        const {
          fields: { otherApplicants, guarantors },
        } = applicantDetailsViewModel;
        return [...otherApplicants.value, ...guarantors.value].map(mail => mail.text).join(', ');
      },
      get guarantorEmails() {
        const {
          fields: { guarantors },
        } = applicantDetailsViewModel;
        return guarantors.value.map(mail => mail.text).join(', ');
      },
      get hasAddress() {
        const {
          fields: { addressLine1, addressLine2, city, state, zip },
        } = applicantDetailsViewModel;
        return addressLine1.value || addressLine2.value || city.value || state.value || zip.value;
      },

      get hasRecommendedAddress() {
        return this._recommendedAddress && !!Object.keys(this._recommendedAddress).length;
      },

      get reportCopyRequested() {
        const {
          fields: { reportCopyRequested },
        } = applicantDetailsViewModel;
        return reportCopyRequested.value;
      },

      get currentFullName() {
        return [this.valueOf('firstName'), this.valueOf('middleName'), this.valueOf('lastName'), this.valueOf('suffix')].filter(part => !!part).join(' ');
      },

      get previousFullName() {
        return this._previousFullName;
      },

      get shouldValidateLegalName() {
        return !this.previousFullName || this.previousFullName !== this.currentFullName;
      },

      get applicantNameChanged() {
        return this.currentFullName !== this.originalFullName;
      },

      setPreviousFullName: action(() => {
        model._previousFullName = model.currentFullName;
      }),

      get currentPersonId() {
        return this._currentPersonId;
      },
      get members() {
        return this._members;
      },
      get defaultEmailAddress() {
        const { textEmailAddress } = getMemberDefaultEmailAddressFromList(this.members, this.currentPersonId);
        return textEmailAddress || '';
      },
      get hasTemporaryEmailDomain() {
        const { emailAddress } = getMemberDefaultEmailAddressFromList(this.members, this.currentPersonId);
        return emailAddress && emailAddress.isAnonymous;
      },
      labelSocSecNumber: computed(() => {
        const {
          fields: { socSecNumber },
        } = applicantDetailsViewModel;
        if (socSecNumber.value) {
          if (isItin(socSecNumber.value)) return 'APPLICANT_INDIVIDUAL_TAX_IDENTIFIER';
          return 'APPLICANT_SOCIAL_SECURITY';
        }
        return 'APPLICANT_SOCIAL_SECURITY_OR_ITIN';
      }),

      cleanRecommendedAddress: action(() => {
        model._recommendedAddress = null;
        model._useRecommendedAddress = false;
      }),

      setApplicationError: action((personApplicationErrorToken, error = {}) => {
        switch (personApplicationErrorToken) {
          case 'PO_BOX_ADDRESS': {
            const fieldName = model.fields.haveInternationalAddress.value ? 'addressLine' : 'addressLine1';
            model.fields[fieldName].errorMessage = t('ERROR_POBOX_ADDRESS');
            break;
          }
          case 'ADDRESS_STANDARDIZATION_ERROR': {
            const { data } = error;
            if (!data || !Object.keys(data).length) return;
            model._useRecommendedAddress = false;
            model._recommendedAddress = data;
            break;
          }
          case 'EMAIL_ALREADY_USED': {
            model.fields.email.errorMessage = t('EMAIL_ALREADY_EXISTS');
            break;
          }
          case 'SUFFIX_TOO_LONG': {
            model.fields.suffix.errorMessage = t('SUFFIX_TOO_LONG');
            break;
          }
          default:
            break;
        }
      }),

      setAddressRecommendationAction: action((isValidAddress, useRecommendedchanges) => {
        if (!isValidAddress) {
          model.cleanRecommendedAddress();
          return;
        }

        model._useRecommendedAddress = useRecommendedchanges;
        if (!useRecommendedchanges || !model.hasRecommendedAddress) return;

        const { addressLine1, addressLine2, city, state, zip } = model._recommendedAddress;
        model.updateFrom({ addressLine1, addressLine2, city, state, zip });
      }),

      resetPrefilledState: action(reset => {
        if (!reset) return;
        model.prefilledAlready = false;
      }),
      // this method prefill information to the applicant from the person, but this process only need to be done in the first page (applicant details)
      // but not in the second page (applicant additional info) because we already created the applicant.
      prefill: action(({ partyMembers, personId, initializeData = true, commonUserEmail = null, isOnPaymentStep }) => {
        model._members = partyMembers;
        model._currentPersonId = personId;
        model.cleanRecommendedAddress();
        const personData = getFormDataForMemberId(partyMembers, personId, commonUserEmail);
        prefilledEmail = personData.email;
        model.invitedToApply = getInvitedToApply(partyMembers, personId);
        const fullNameArray = initializeData
          ? personData.fullNameArray
          : [currentState.firstName, currentState.middleName, currentState.lastName, currentState.suffix];
        updatePersonModel(fullNameArray, personData.email, personData.phone);
        model._fullName = personData.fullName;
        model.prefilledAlready = true;
        model.resetInteractedFlag();
        const {
          fields: { guarantors },
        } = model;

        !isOnPaymentStep && !application.displayInviteGuarantor && guarantors.setValue([]);
      }),
      fillInformation: action((applicantData = {}, { reset = true } = {}) => {
        const socSecNumber = applicantData.ssn || applicantData.itin;
        model._initialData = { ...applicantData, socSecNumber };
        model.cleanRecommendedAddress();
        Object.keys(initialState).forEach(key => !nullish(applicantData[key]) && model.updateField(key, applicantData[key]));
        model.updateField('socSecNumber', socSecNumber);
        currentState = applicantDetailsViewModel.serializedData;
        reset && model.resetInteractedFlag();
      }),
      autocompleteAddress: action((address = {}, isLocalAddress = true) => {
        const applicantAddress = parseApplicantAddress(address, isLocalAddress);
        model.updateField('haveInternationalAddress', !isLocalAddress);
        model.updateFrom({ addressLine1: '', addressLine: '' });
        const { addressLine1, addressLine, ...rest } = applicantAddress;
        model.updateFrom(rest, false);

        setTimeout(() => model.updateFrom({ addressLine1, addressLine }), 0);
      }),
      restoreInitialData: action(() => {
        model.cleanRecommendedAddress();
        const initialData = model._initialData;
        Object.keys(model.fields).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(initialData, key)) {
            model.fields[key].setValue(initialData[key], true);
          }
        });
      }),
      prefilledAlready: false,
    });

    applicantDetailsViewModel.validateEmail = email => isEmailValid(email);

    applicantDetailsViewModel.submit = async (personId, partyId, shouldUpdatePerson) => {
      const skipStandardizedAddressValidation = model.hasRecommendedAddress ? !model._useRecommendedAddress : false;
      model.cleanRecommendedAddress();

      currentState = applicantDetailsViewModel.serializedData;

      const toSend = {};
      toSend.data = {
        personId,
        partyId,
        skipStandardizedAddressValidation,
        applicationData: currentState,
      };
      await application.submitPersonApplication(toSend, shouldUpdatePerson);
    };

    applicantDetailsViewModel.complete = async () => await application.completePersonApplication();

    // why is this store created in the model that handles the form state?
    // this should be part of be created at the application store
    // we don't reference the PaymentModel from other places
    applicantDetailsViewModel.paymentModel = new PaymentModel({ apiClient: (application || {}).apiClient });

    applicantDetailsViewModel.enableInternationalAddress = action(() => {
      // enable the addressLine (international)
      applicantDetailsViewModel.enableFields(['addressLine']);
      // and disable the validators from the local address
      applicantDetailsViewModel.disableFields(['addressLine1', 'city', 'state', 'zip']);
    });

    applicantDetailsViewModel.enableLocalAddress = action(() => {
      // enable the local address validators
      applicantDetailsViewModel.enableFields(['addressLine1', 'city', 'state', 'zip']);
      // and disable the international one
      applicantDetailsViewModel.disableFields(['addressLine']);
    });

    applicantDetailsViewModel.updateReportCopyRequest = action(value => {
      applicantDetailsViewModel.fields.reportCopyRequested.setValue(value);
    });

    applicantDetailsViewModel.validateOtherApplicantsAndGuarantors = action(() => {
      const {
        fields: { otherApplicants, guarantors },
      } = applicantDetailsViewModel;

      otherApplicants.validate();
      guarantors.validate();
    });

    // the following autorun handler will disable/enable
    // the validators on the international and local addresses
    autorun(() => {
      // if the field haveInternationalAddress.value is true
      if (applicantDetailsViewModel.fields.haveInternationalAddress.value) {
        applicantDetailsViewModel.enableInternationalAddress();
      } else {
        applicantDetailsViewModel.enableLocalAddress();
      }
    });

    const fields = applicantDetailsViewModel.fields;

    // when the value changes, execute both validations
    reaction(
      () => ({
        otherApplicants: fields.otherApplicants.value,
        guarantors: fields.guarantors.value,
      }),
      () => {
        applicantDetailsViewModel.validateOtherApplicantsAndGuarantors();
      },
    );

    return applicantDetailsViewModel;
  },
};
