/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import debounce from 'debouncy';

import newUUID from 'uuid/v4';
import {
  TextBox,
  PhoneTextBox,
  Card,
  Button,
  Typography,
  Dialog,
  DialogOverlay,
  DialogActions,
  PreloaderBlock,
  Validator,
  Scrollable,
  NotificationBanner,
  MsgBox,
  FormattedMarkdown,
} from 'components';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { loadMatches, clearResults } from 'redux/modules/search';
import { fetchResults as searchPersons, clearMergeError } from 'redux/modules/personsStore';
import { validatePhone as validatePhoneFormat, formatPhone } from 'helpers/phone-utils';
import { isAnonymousEmail } from '../../../common/helpers/anonymous-email';
import PersonCard from '../../containers/SearchResultCard/PersonCard';
import MergePersons from './MergePersons/MergePersons';

import { DALTypes } from '../../../common/enums/DALTypes';
import SvgNoResults from '../../../resources/pictographs/no-search-results.svg';

import { ClientConstants } from '../../helpers/clientConstants';
import {
  markAsPrimary,
  unmarkAsPrimary,
  setFirstContactInfoAsPrimary,
  enhance as enhanceContactInfos,
  contactInfoListContainsValue,
} from '../../../common/helpers/contactInfoUtils';

import { formatPhoneToDisplay } from '../../../common/helpers/phone/phone-helper';
import { cf } from './CreateEditResidentForm.scss';
import { isEmailValid, isPhoneValid, isCommonWords, hasSpecialCharacter } from '../../../common/helpers/validations';
import cfg from '../../helpers/cfg';

const { Text, Title } = Typography;

const INVALID_LEGAL_NAME_TYPES = {
  PHONE_NUMBER: 'phoneNumber',
  EMAIL: 'email',
};

const BothPersonsAppliedToken = 'ERROR_BOTH_PERSONS_APPLIED';

@connect(
  state => ({
    searchResults: state.search.searchResults,
    personSearchResults: state.personsStore.searchResultsList,
    isMergingPersons: state.personsStore.isMergingPersons,
    mergeError: state.personsStore.mergePersonsError,
    isLoading: state.search.loading,
    searchId: state.search.searchId,
  }),
  dispatch =>
    bindActionCreators(
      {
        loadMatches,
        clearResults,
        searchPersons,
        clearMergeError,
      },
      dispatch,
    ),
)
export default class CreateEditResidentForm extends Component {
  static propTypes = {
    onAddPerson: PropTypes.func,
    onUpdatePerson: PropTypes.func,
    onCancel: PropTypes.func,
    person: PropTypes.object,
    searchResults: PropTypes.object,
    personSearchResults: PropTypes.array,
    isLoading: PropTypes.bool,
    loadMatches: PropTypes.func.isRequired,
    clearResults: PropTypes.func.isRequired,
    searchPersons: PropTypes.func.isRequired,
    onMergePersons: PropTypes.func.isRequired,
    hideCancelButton: PropTypes.bool,
    displayDuplicatePersonNotification: PropTypes.bool,
    associatedPartyTypes: PropTypes.instanceOf(Set),
    isMergingPersons: PropTypes.bool,
    isPointOfContact: PropTypes.bool,
    mergeError: PropTypes.string,
    isMergeInProgress: PropTypes.bool,
  };

  initialState = {
    legalName: '',
    legalNameErrorText: '',
    preferredName: null,
    showPreferredNameInput: false,
    showAddPointOfContactNameInput: true,
    phoneNumbers: [],
    emailAddresses: [],
    dismissExistingMatches: false,
    openMergeDialog: false,
    openInvalidLegalNameDialog: false,
    invalidLegalNameType: '',
    dismissedMatches: [],
    associatedPartyTypes: new Set([DALTypes.PartyTypes.TRADITIONAL]),
    isMergingPersons: false,
    mergeError: '',
    searchResults: [],
    searchId: newUUID(),
    searchStarted: false,
    mergeInProgress: false,
  };

  constructor(props) {
    super(props);
    const { person, associatedPartyTypes = this.initialState.associatedPartyTypes } = props;

    this.clearNewContactInfoError = debounce(this._clearNewContactInfoError, 100, this, true /* immediate */);

    if (person) {
      const { contactInfo = {} } = person;
      const emailAddresses = this.enhanceContactMeansWithPrimary((contactInfo.emails || []).reverse(), contactInfo.defaultEmailId);
      const belongsToCorporate = this.partyTypeIsInSet(associatedPartyTypes, DALTypes.PartyTypes.CORPORATE);

      this.state = {
        ...this.initialState,
        legalName: person.fullName,
        legalNameErrorText: '',
        preferredName: person.preferredName,
        showPreferredNameInput: !!person.preferredName,
        showAddPointOfContactNameInput: belongsToCorporate,
        phoneNumbers: (person.contactInfo && person.contactInfo.phones.reverse()) || [],
        emailAddresses,
      };
    } else {
      this.state = { ...this.initialState };
    }
  }

  componentWillReceiveProps(nextProps) {
    const belongsToCorporate = nextProps.associatedPartyTypes && this.partyTypeIsInSet(nextProps.associatedPartyTypes, DALTypes.PartyTypes.CORPORATE);
    if (nextProps.associatedPartyTypes && belongsToCorporate !== this.hasCorporateTypeOnAssociatedPartyTypes()) {
      this.setState(
        {
          showAddPointOfContactNameInput: belongsToCorporate,
        },
        () => this.setFocusOnPartyTypes(),
      );
    }

    if ('person' in nextProps) {
      const { person } = nextProps;
      if (person !== this.props.person) {
        this.populateForm(person);
      }
    }

    const isDoneMergingPersons = this.props.isMergingPersons && !nextProps.isMergingPersons;
    if (isDoneMergingPersons) {
      nextProps.mergeError === BothPersonsAppliedToken ? this.setState({ showMergeErrorDialog: true }) : this.props.onCancel();
    }

    const searchCompleted = this.props.isLoading && !nextProps.isLoading;
    if (searchCompleted && nextProps.searchId === this.state.searchId) {
      const searchResults = nextProps.searchResults;
      this.setState({ searchResults });
    }
  }

  shouldComponentUpdate(nextProps) {
    const searchInProgress = this.props.isLoading || nextProps.isLoading;
    if (searchInProgress && nextProps.searchId !== this.state.searchId) {
      return false;
    }
    return true;
  }

  componentDidUpdate() {
    this.scrollableResults && this.scrollableResults.updateScrollProps();
  }

  componentDidMount() {
    this._mounted = true;
    this.doSearch();
  }

  componentWillUnmount = () => {
    this._mounted = false;
    this.props.clearResults();
  };

  setFocusOnPartyTypes = () => {
    const primaryInput = this.txtLegalName;
    primaryInput && primaryInput.focus();
  };

  populateForm = person => {
    if (person && person !== this.props.person) {
      const { contactInfo = {} } = person;
      const emailAddresses = this.enhanceContactMeansWithPrimary(contactInfo.emails, contactInfo.defaultEmailId);
      this.setState({
        preferredName: person.preferredName,
        showPreferredNameInput: !!person.preferredName,
        phoneNumbers: contactInfo.phones || [],
        emailAddresses,
        dismissExistingMatches: true,
      });
      this.handleLegalNameChanged({ value: person.fullName });
    } else {
      this.setState(this.initialState);
    }

    this.setFocusOnPartyTypes();
  };

  enhanceContactMeansWithPrimary = (contactMeans, primaryId) =>
    (contactMeans || []).map(contactInfo => (contactInfo.id === primaryId ? markAsPrimary(contactInfo) : unmarkAsPrimary(contactInfo)));

  getAllContactInfos = () => (this.state.emailAddresses || []).concat(this.state.phoneNumbers || []);

  getPhoneNumbersForSearch = () => {
    const existingPhoneNumbers =
      this.props.person && this.props.person.contactInfo && this.props.person.contactInfo.phones
        ? this.props.person.contactInfo.phones.map(item => item.value)
        : [];
    const newPhoneNumbers = this.state.phoneNumbers
      ? this.state.phoneNumbers.filter(item => !existingPhoneNumbers.includes(item.value)).map(item => item.value)
      : [];
    return {
      existingPhoneNumbers: existingPhoneNumbers.concat(newPhoneNumbers),
      newPhoneNumbers,
    };
  };

  doSearch = debounce(
    () => {
      const payload = {
        name: this.state.legalName,
        dismissExistingMatches: this.state.dismissExistingMatches,
        personId: this.props.person && this.props.person.id,
        emails: this.state.emailAddresses.map(item => item.value),
        phones: this.getPhoneNumbersForSearch(),
        searchId: this.state.searchId,
      };

      const { name, personId, emails, phones } = payload;
      const { existingPhoneNumbers, newPhoneNumbers } = phones;

      const hasValidData = name || personId || emails.length > 0 || existingPhoneNumbers.length > 0 || newPhoneNumbers.length > 0;
      if (hasValidData) {
        this.props.loadMatches(payload);
      }
      this.setState({ searchStarted: false });
    },
    ClientConstants.SEARCH_DEBOUNCE_INTERVAL,
    this,
  );

  validations = value => {
    let errorMessage = '';
    if (value) {
      if (isCommonWords(cfg('forbiddenLegalNames'), value) || hasSpecialCharacter(value)) errorMessage = 'NOT_RECOGNIZED_AS_LEGAL_NAME';
      if (isPhoneValid(value)) errorMessage = 'LOOKS_LIKE_A_PHONE_NUMBER';
      if (isEmailValid(value)) errorMessage = 'LOOKS_LIKE_AN_EMAIL';
    }
    return errorMessage;
  };

  handleLegalNameChanged = event => {
    this.setState({
      legalName: event.value,
      legalNameErrorText: this.validations(event.value),
      dismissExistingMatches: true,
    });
    this.doSearch();
  };

  partyTypeIsInSet = (partyTypes, leaseType, leaseTypeOnly = false) => {
    const belongsToLeaseType = partyTypes.has(leaseType);
    return leaseTypeOnly ? partyTypes.size === 1 && belongsToLeaseType : belongsToLeaseType;
  };

  hasCorporateTypeOnAssociatedPartyTypes = (corporateOnly = false) => {
    const { associatedPartyTypes, isPointOfContact = true } = this.props;
    return this.partyTypeIsInSet(associatedPartyTypes, DALTypes.PartyTypes.CORPORATE, corporateOnly) && isPointOfContact;
  };

  hasTraditionalTypeOnAssociatedPartyTypes = (traditionalOnly = false) =>
    this.partyTypeIsInSet(this.props.associatedPartyTypes, DALTypes.PartyTypes.TRADITIONAL, traditionalOnly);

  getAdditionalFields = () => {
    const { preferredName } = this.state;
    const additionalFields = {};
    this.shouldDisplayPreferredName() && Object.assign(additionalFields, { preferredName });
    return additionalFields;
  };

  areRequiredFieldsFilled = () => {
    const commonRequiredFieldsFilled = this.state.legalName || this.state.phoneNumbers.length || this.state.emailAddresses.length;
    return commonRequiredFieldsFilled;
  };

  _addPerson = async () => {
    const { legalName } = this.state;

    this.props.onAddPerson &&
      (await this.props.onAddPerson({
        ...this.getAdditionalFields(),
        fullName: legalName,
        contactInfo: enhanceContactInfos(this.getAllContactInfos()),
        dismissedMatches: this.state.dismissedMatches,
      }));
  };

  addPerson = () => {
    this.setState({ addGuestError: false }, async () => {
      try {
        await this._addPerson();
        this.handleCloseInvalidLegalNameDialog();
      } catch (err) {
        err.__handled = true; // prevent the unhandled snackbar error from appear
        this.setState({ addGuestError: err });
      }
    });
  };

  clearError = () => {
    this._mounted && this.setState({ addGuestError: false });
  };

  updatePerson = () => {
    const { legalName } = this.state;

    this.props.onUpdatePerson &&
      this.props.onUpdatePerson(
        {
          id: this.props.person.id,
          ...this.getAdditionalFields(),
          fullName: legalName,
          contactInfo: enhanceContactInfos(this.getAllContactInfos()),
        },
        this.state.dismissedMatches,
      );
  };

  addPatchedPerson = (personId, contactInfo, additionalContactInfo = [], dontChangePrimaryFlag = false) => {
    // we are adding an existing person and some new contact infos
    const payload = {
      personId,
      contactInfo: enhanceContactInfos(contactInfo, { additionalContactInfo }, dontChangePrimaryFlag),
    };

    this.props.onAddPerson(payload);
  };

  handleMergePersons = ({ firstPersonId, secondPersonId, contactInfoToUpdate }) => {
    if (!firstPersonId) {
      const { secondPerson } = this.state;
      const secondPersonContactInfos = secondPerson.contactInfo || [];
      const onlyNewAddedContactInfos = this.getAllContactInfos().filter(cI => !contactInfoListContainsValue(secondPersonContactInfos, cI));
      const isPrimarySet = {
        email: !!secondPersonContactInfos.find(ci => ci.type === 'email'),
        phone: !!secondPersonContactInfos.find(ci => ci.type === 'phone'),
      };
      const newArray = onlyNewAddedContactInfos.map(item => {
        if (isPrimarySet[item.type]) {
          return { ...item, isPrimary: false };
        }
        isPrimarySet[item.type] = true;
        return { ...item, isPrimary: true };
      });
      if ((!secondPerson.fullName || isEmailValid(secondPerson.fullName) || isPhoneValid(secondPerson.fullName)) && this.state.legalName) {
        this.props.onUpdatePerson &&
          this.props.onUpdatePerson({
            id: secondPersonId,
            fullName: this.state.legalName,
          });
      }
      this.addPatchedPerson(secondPersonId, newArray, secondPersonContactInfos, true);
    } else {
      const payload = {
        firstPersonId,
        secondPersonId,
        contactInfoToUpdate,
        dismissedMatches: this.state.dismissedMatches,
      };
      this.props.onMergePersons(payload);
    }

    this.closeMergeDialog();
  };

  validateEmailFormat = value => {
    const valid = isEmailValid(value);
    return {
      valid,
      reason: (!valid && 'INVALID_EMAIL') || '',
    };
  };

  _clearNewContactInfoError = () => {
    const { newContactInfo } = this.state;

    if (!newContactInfo || !newContactInfo.errorMessage) return;

    this.setState({
      newContactInfo: {
        ...newContactInfo,
        valid: undefined,
        errorMessage: '',
      },
    });
  };

  validateNewContactInfo = (value, type, cb) => {
    const validationResult = type === DALTypes.ContactInfoType.PHONE ? validatePhoneFormat(value) : this.validateEmailFormat(value);

    this.setState(
      {
        newContactInfo: {
          value,
          type,
          valid: validationResult.valid,
          errorMessage: (!validationResult.valid && t(validationResult.reason)) || '',
        },
      },
      () => {
        if (!validationResult.valid) {
          cb && cb(false);
          return;
        }

        if (this.newContactInfoIsDuplicated()) {
          cb && cb(false);
          return;
        }

        cb && cb(true);
      },
    );
  };

  getPersonByExactContactInfo = (persons, contactInfo) => persons.find(person => contactInfoListContainsValue(person.contactInfo.all, contactInfo));

  newContactInfoIsDuplicated = () => {
    const { newContactInfo } = this.state;
    const allContactInfos = this.getAllContactInfos();

    const contactInfoAlreadyAdded = contactInfoListContainsValue(allContactInfos, newContactInfo);

    if (contactInfoAlreadyAdded) {
      const errorMessage =
        newContactInfo.type === DALTypes.ContactInfoType.PHONE
          ? `${t('DUPLICATED_PHONE_FOUND', { entry: newContactInfo.value })}`
          : `${t('DUPLICATED_EMAIL_FOUND', { entry: newContactInfo.value })}`;

      this.setState({
        newContactInfo: {
          ...newContactInfo,
          valid: false,
          errorMessage,
        },
      });
      return true;
    }
    return false;
  };

  verifyNewContactInfo = () => {
    const { newContactInfo } = this.state;

    const personWithThisContactInfo = this.getPersonByExactContactInfo(this.props.personSearchResults, newContactInfo);
    if (personWithThisContactInfo && personWithThisContactInfo.contactInfo.isSpam) {
      const errorMessage = newContactInfo.type === DALTypes.ContactInfoType.PHONE ? t('PHONE_BLACKLISTED') : t('EMAIL_BLACKLISTED');
      this.setState({
        newContactInfo: {
          ...newContactInfo,
          errorMessage,
        },
      });
      return false;
    }
    return true;
  };

  isUsername = contactInfo => {
    const { person } = this.props;

    return contactInfo && person.commonUserEmail && person.commonUserEmail.toLowerCase() === contactInfo.value.toLowerCase();
  };

  addPhoneNumber = phoneNumber => {
    if (this.verifyNewContactInfo()) {
      const phoneNumberObject = {
        value: phoneNumber,
        type: DALTypes.ContactInfoType.PHONE,
        id: newUUID(),
        isPrimary: !this.state.phoneNumbers.length,
      };
      this.setState({
        phoneNumbers: [...this.state.phoneNumbers, phoneNumberObject],
        dismissExistingMatches: true,
      });

      this.closeContactInfoDialog(this.phoneDialog);
      this.doSearch();
    }
  };

  removePhoneNumber = phoneNumber => {
    let filteredNumbers = this.state.phoneNumbers.filter(pn => pn.id !== phoneNumber.id);
    if (phoneNumber.isPrimary && filteredNumbers.length) {
      filteredNumbers = setFirstContactInfoAsPrimary(filteredNumbers);
    }
    this.setState({ phoneNumbers: filteredNumbers });
    this.doSearch();
  };

  addEmailAddress = emailAddress => {
    if (this.verifyNewContactInfo()) {
      const emailAddressObject = {
        value: emailAddress,
        type: DALTypes.ContactInfoType.EMAIL,
        id: newUUID(),
        isPrimary: !this.state.emailAddresses.length,
      };
      this.setState({
        emailAddresses: [...this.state.emailAddresses, emailAddressObject],
        dismissExistingMatches: true,
      });

      this.closeContactInfoDialog(this.emailDialog);
      this.doSearch();
    }
  };

  removeEmailAddress = emailAddress => {
    let filteredAddresses = this.state.emailAddresses.filter(em => em.id !== emailAddress.id);
    if (emailAddress.isPrimary && filteredAddresses.length) {
      filteredAddresses = setFirstContactInfoAsPrimary(filteredAddresses);
    }
    this.setState({ emailAddresses: filteredAddresses });
    this.doSearch();
  };

  markEmailAsPrimary = newPrimaryEmailId => {
    const emailAddresses = this.enhanceContactMeansWithPrimary(this.state.emailAddresses, newPrimaryEmailId);
    this.setState({ emailAddresses });
  };

  markPhoneAsPrimary = newPrimaryPhoneId => {
    const phoneNumbers = this.enhanceContactMeansWithPrimary(this.state.phoneNumbers, newPrimaryPhoneId);
    this.setState({ phoneNumbers });
  };

  closeContactInfoDialog = dialog => {
    this.setState({
      newContactInfo: undefined,
    });

    dialog.close();
  };

  getSearchResultsEmailErrorMessage = contactInfo => {
    const match =
      this.props.searchResults &&
      this.props.searchResults.matchedPersons &&
      this.props.searchResults.matchedPersons.find(mP =>
        (mP.personObject.contactInfo || []).some(cI => cI.value.toLowerCase() === contactInfo.value.toLowerCase()),
      );

    if (match && match.exactEmailMatch) {
      return t('EMAIL_ALREADY_USED');
    }
    return '';
  };

  renderContactInfoRow = (contactInfo, index) => {
    const isEmailType = contactInfo.type === DALTypes.ContactInfoType.EMAIL;
    if (!isEmailType) return this.renderValidContactInfoRow(contactInfo, isEmailType, index + 1);

    const emailErrorMessage = this.getSearchResultsEmailErrorMessage(contactInfo);
    const isAnonymousEmailAddress = isEmailType && isAnonymousEmail(contactInfo.value);
    if (emailErrorMessage || isAnonymousEmailAddress) {
      return this.renderInvalidContactInfoRow(contactInfo, emailErrorMessage, isAnonymousEmailAddress);
    }
    return this.renderValidContactInfoRow(contactInfo, isEmailType, index + 1);
  };

  renderValidContactInfoRow = (contactInfo, isEmailType, index) => {
    const contactTypeAdded = isEmailType ? `addEmailText${index}` : `addPhoneText${index}`;
    const primaryContact = isEmailType ? `primaryEmailText${index}` : `primaryPhoneText${index}`;
    const makePrimaryContact = isEmailType ? `makePrimaryEmailBtn${index}` : `makePrimaryPhoneBtn${index}`;
    return (
      <div key={contactInfo.id}>
        <div className={cf('validContactInfoRow')}>
          <Text data-id={contactTypeAdded}>{isEmailType ? contactInfo.value : formatPhoneToDisplay(contactInfo.value)}</Text>
          <div className={cf('contactInfoButtons')}>
            {contactInfo.isPrimary ? (
              <Text data-id={primaryContact}>{t('PRIMARY')} </Text>
            ) : (
              <Button
                id={makePrimaryContact}
                type={'flat'}
                btnRole={'primary'}
                label={t('MAKE_PRIMARY')}
                onClick={() => {
                  isEmailType ? this.markEmailAsPrimary(contactInfo.id) : this.markPhoneAsPrimary(contactInfo.id);
                }}
              />
            )}
            {this.isUsername(contactInfo) ? (
              <Text>{t('USERNAME')}</Text>
            ) : (
              <Button
                data-action={isEmailType ? 'remove-email' : 'remove-phone'}
                type={'flat'}
                btnRole={'primary'}
                label={t('REMOVE')}
                onClick={() => {
                  isEmailType ? this.removeEmailAddress(contactInfo) : this.removePhoneNumber(contactInfo);
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  renderInvalidContactInfoRow = (contactInfo, errorMessage, isAnonymousEmailAddress) => {
    errorMessage = isAnonymousEmailAddress ? t('TEMPORARY_EMAIL_ERROR_MESSAGE') : errorMessage;
    return (
      <div key={contactInfo.id}>
        <div className={cf('invalidContactInfoRow', { isAnonymousEmailAddress })} data-id={'invalidContactEmail'}>
          <Text>{contactInfo.value}</Text>
          <div className={cf('contactInfoButtons')}>
            <Button type={'flat'} btnRole={'primary'} label={t('REMOVE')} onClick={() => this.removeEmailAddress(contactInfo)} />
          </div>
        </div>
        {errorMessage && <Validator errorMessage={errorMessage} />}
      </div>
    );
  };

  handleAddPointOfContactNameClicked = () => this.setState({ showAddPointOfContactNameInput: true });

  handleAddPointOfContactNameBlurred = () =>
    this.hasCorporateTypeOnAssociatedPartyTypes() && this.setState({ showAddPointOfContactNameInput: !!this.state.legalName });

  renderLegalName = () => {
    const belongsToCorporate = this.hasCorporateTypeOnAssociatedPartyTypes();
    if (belongsToCorporate && !this.state.showAddPointOfContactNameInput) {
      return (
        <Button
          data-id="addPointOfContactNameBtn"
          style={{ marginLeft: -6, marginTop: '.5rem', marginBottom: this.hasTraditionalTypeOnAssociatedPartyTypes() ? '1rem' : '0rem' }}
          btnRole={'primary'}
          disabled={this.props.formDisabled}
          type={'flat'}
          label={t('ADD_POINT_OF_CONTACT_NAME')}
          onClick={this.handleAddPointOfContactNameClicked}
        />
      );
    }

    const legalNameLabelTransToken = belongsToCorporate ? 'POINT_OF_CONTACT_TEXTBOX_LABEL' : 'LEGAL_NAME_TEXTBOX_LABEL';
    const legalNamePlaceholderTransToken = belongsToCorporate ? 'POINT_OF_CONTACT_TEXTBOX_PLACEHOLDER' : 'LEGAL_NAME_TEXTBOX_PLACEHOLDER';

    return (
      <TextBox
        style={{ marginBottom: this.hasCorporateTypeOnAssociatedPartyTypes(true) ? '1rem' : '1.5rem' }}
        ref={ref => (this.txtLegalName = ref)}
        label={t(legalNameLabelTransToken)}
        id="txtLegalName"
        placeholder={t(legalNamePlaceholderTransToken)}
        value={this.state.legalName}
        disabled={this.props.formDisabled}
        autoFocus={!belongsToCorporate || !(this.props.person && this.props.person.id)}
        showClear
        wide
        errorMessage={this.state.legalNameErrorText && t(this.state.legalNameErrorText)}
        onChange={this.handleLegalNameChanged}
        onBlur={this.handleAddPointOfContactNameBlurred}
      />
    );
  };

  renderPreferredName = () =>
    this.state.showPreferredNameInput ? (
      <TextBox
        id="txtPreferredName"
        style={{ marginBottom: '1rem' }}
        ref={ref => (this.txtPreferredName = ref)}
        disabled={this.props.formDisabled}
        label={t('PREFERRED_NAME_TEXTBOX_LABEL')}
        placeholder={t('PREFERRED_NAME_TEXTBOX_PLACEHOLDER')}
        value={this.state.preferredName}
        onChange={this.handlePreferredNameChanged}
        onBlur={this.handlePreferredNameBlurred}
        showClear
        wide
      />
    ) : (
      <Button
        id="addPreferredNameBtn"
        disabled={this.props.formDisabled}
        style={{ marginLeft: -6, marginTop: '.5rem' }}
        btnRole={'primary'}
        type={'flat'}
        label={t('ADD_PREFERRED_NAME_BTN_LABEL')}
        onClick={this.handlePreferredNameClicked}
      />
    );

  handlePreferredNameClicked = () => this.setState({ showPreferredNameInput: true }, () => this.txtPreferredName && this.txtPreferredName.focus());

  handlePreferredNameChanged = event => this.setState({ preferredName: event.value });

  handlePreferredNameBlurred = () => this.setState({ showPreferredNameInput: !!this.state.preferredName });

  renderPhoneNumbers = () => {
    const { phoneNumbers = [] } = this.state;
    const notEmpty = phoneNumbers.length > 0;
    return <div className={cf('contactInfoContainer', { notEmpty })}>{phoneNumbers.map(this.renderContactInfoRow)}</div>;
  };

  renderEmailAddresses = () => {
    const { emailAddresses = [] } = this.state;
    const notEmpty = emailAddresses.length > 0;

    return <div className={cf('contactInfoContainer', { notEmpty })}>{emailAddresses.map(this.renderContactInfoRow)}</div>;
  };

  handleSubmit = () => {
    const isPhoneNumber = isPhoneValid(this.state.legalName);
    const isEmail = isEmailValid(this.state.legalName);
    if (isPhoneNumber) this.setState({ invalidLegalNameType: INVALID_LEGAL_NAME_TYPES.PHONE_NUMBER });
    if (isEmail) this.setState({ invalidLegalNameType: INVALID_LEGAL_NAME_TYPES.EMAIL });
    if (isPhoneNumber || isEmail) {
      this.setState({ openInvalidLegalNameDialog: true });
    } else {
      // for performance reasons textboxes fire change after 50ms, so we need to be sure we have the values in the state so we can perform the addition
      setTimeout(() => {
        this.addPerson();
      }, 100);
    }
  };

  handleUpdate = () => {
    // for performance reasons textboxes fire change after 50ms, so we need to be sure we have the values in the state so we can perform the addition
    setTimeout(() => {
      this.updatePerson();
    }, 100);
  };

  handleCloseInvalidLegalNameDialog = () => {
    this._mounted && this.setState({ openInvalidLegalNameDialog: false });
  };

  buildPersonForMerging = () => {
    const { person } = this.props;

    return {
      ...person,
      fullName: this.state.legalName,
      preferredName: this.state.preferredName,
      contactInfo: enhanceContactInfos(this.getAllContactInfos()),
    };
  };

  handleMatchConfirmed = person => {
    this.setState({ mergeInProgress: true });
    const isThereDataToMerge = this.props.person.id || this.getAllContactInfos().length;

    if (isThereDataToMerge) {
      this.setState({
        openMergeDialog: true,
        firstPerson: this.buildPersonForMerging(),
        secondPerson: person,
      });
      return;
    }

    this.addPatchedPerson(person.id, []);
  };

  closeMergeDialog = () => this.setState({ openMergeDialog: false });

  dismissMatch = personId => {
    this.setState({
      dismissedMatches: [...this.state.dismissedMatches, personId],
    });
  };

  getSearchResults = (checkAllResults = false) => {
    if (checkAllResults) return this.state.searchResults?.matchedPersons;

    return (
      this.state.searchResults &&
      this.state.searchResults.matchedPersons &&
      this.state.searchResults.matchedPersons.filter(res => !this.state.dismissedMatches.includes(res.personObject.id))
    );
  };

  getHighlights = () => {
    const name = this.state.legalName || '';
    const phones = this.state.phoneNumbers && this.state.phoneNumbers.map(item => formatPhone(item.value));
    const emails = this.state.emailAddresses && this.state.emailAddresses.map(item => item.value);

    return {
      name: [name],
      phones: { phones, exactMatch: true },
      emails: { emails, exactMatch: true },
    };
  };

  isFormEmpty = () => !this.state.legalName && !this.state.phoneNumbers.length && !this.state.emailAddresses.length;

  validateAndAddPhoneNumber = value => {
    this.validateNewContactInfo(value, DALTypes.ContactInfoType.PHONE, isValid => {
      if (!isValid) return;
      this.addPhoneNumber(value);
      this.scrollableArea.updateScrollProps();
    });
  };

  validateAndAddEmailAddress = value => {
    this.validateNewContactInfo(value, DALTypes.ContactInfoType.EMAIL, isValid => {
      if (!isValid) return;
      this.setState({ searchStarted: true });
      this.addEmailAddress(value);
      this.scrollableArea.updateScrollProps();
    });
  };

  shouldDisplayPreferredName = () => {
    if (this.hasTraditionalTypeOnAssociatedPartyTypes()) return true;

    return !this.hasCorporateTypeOnAssociatedPartyTypes();
  };

  renderInvalidLegalNameDialogContent = () => {
    let type = '';
    const { invalidLegalNameType, legalName } = this.state;
    if (invalidLegalNameType === INVALID_LEGAL_NAME_TYPES.PHONE_NUMBER) type = t('PHONE_NO');
    if (invalidLegalNameType === INVALID_LEGAL_NAME_TYPES.EMAIL) type = t('EMAIL_ADDRESS');
    type = type.toLowerCase();
    return <FormattedMarkdown>{t('INVALID_LEGAL_NAME_DIALOG_TEXT', { type, legalName })}</FormattedMarkdown>;
  };

  renderMergeErrorDialogContent = () => (
    <div>
      <div className={cf('dialogTitle')}>
        <Title>{t('MERGE_ERROR_TITLE')}</Title>
      </div>
      <Text>{t('MERGE_ERROR_EXISTING_APPLICATIONS_TEXT')}</Text>
    </div>
  );

  getCreatePersonButtonLabel = () => {
    const createPersonTransToken = this.hasCorporateTypeOnAssociatedPartyTypes() ? 'CREATE_POINT_OF_CONTACT' : 'CREATE_PERSON_BTN_LABEL';
    return this.props.person.id ? t('SAVE_BUTTON') : t(createPersonTransToken);
  };

  getInfoMessage = allEmailAddressesValid => {
    if (!allEmailAddressesValid) return t('REMOVE_DUPLICATE_EMAIL');
    return '';
  };

  exitFromMergeDialog = () => this.setState({ mergeInProgress: false, openMergeDialog: false });

  render = ({ isLoading, displayDuplicatePersonNotification } = this.props) => {
    const searchResultsWithoutDismissedMatches = this.getSearchResults();
    const isThereAStrongPhoneMatch = (searchResultsWithoutDismissedMatches || []).filter(
      item => item.type === DALTypes.PersonMatchType.STRONG && !item.exactEmailMatch,
    ).length;
    const resultsExist = searchResultsWithoutDismissedMatches && searchResultsWithoutDismissedMatches.length;
    const allSearchResults = this.getSearchResults(true);
    const existingResultsIncludingDismissedMatches = allSearchResults && allSearchResults.length;
    const allEmailAddressesValid =
      !existingResultsIncludingDismissedMatches || (existingResultsIncludingDismissedMatches && !allSearchResults.some(m => m.exactEmailMatch));
    const requiredFieldsFilled = this.areRequiredFieldsFilled();

    const resultsSection =
      resultsExist &&
      searchResultsWithoutDismissedMatches.map(item => (
        <PersonCard
          key={item.personObject.id}
          asListItem
          person={item.personObject}
          query={this.getHighlights()}
          parties={this.state.searchResults.partiesForMatches.filter(p => p.partyMembers.some(pm => pm.personId === item.personObject.id))}
          displayActionButtons={true}
          canDismissMatch={!item.exactEmailMatch}
          dismissMatch={this.dismissMatch}
          confirmMerge={this.handleMatchConfirmed}
          isMergeInProgress={this.state.mergeInProgress}
        />
      ));

    const noResults = this.isFormEmpty() ? (
      <div className={cf('noResults')} />
    ) : (
      <div className={cf('noResults')}>
        <SvgNoResults className={cf('noResultSVG')} />
        <Text>{t('NO_MATCHES_TEXT')}</Text>
      </div>
    );

    const loadingSection = <div>{<PreloaderBlock />}</div>;

    const mergeDialog = this.state.openMergeDialog && (
      <MergePersons
        firstPerson={this.state.firstPerson}
        secondPerson={this.state.secondPerson}
        open={this.state.openMergeDialog}
        onCloseRequest={this.exitFromMergeDialog}
        onMergePersons={this.handleMergePersons}
        dismissedMatches={this.state.dismissedMatches}
      />
    );

    const MAX_CARD_WIDTH = 768;
    const createPersonTransToken = this.hasCorporateTypeOnAssociatedPartyTypes() ? 'CREATE_COMPANY' : 'CREATE_PERSON_BTN_LABEL';

    return (
      <Card container={false} style={{ maxWidth: MAX_CARD_WIDTH }}>
        {this.state.openInvalidLegalNameDialog && (
          <MsgBox
            open={this.state.openInvalidLegalNameDialog}
            title={t('INVALID_LEGAL_NAME_DIALOG_TITLE')}
            lblOK={t(createPersonTransToken)}
            btnOKRole="primary"
            onOKClick={this.addPerson}
            onCloseRequest={this.handleCloseInvalidLegalNameDialog}>
            <div className={cf('no-legal-dialog-content')}>{this.renderInvalidLegalNameDialogContent()}</div>
          </MsgBox>
        )}
        <MsgBox
          open={this.state.showMergeErrorDialog}
          content={this.renderMergeErrorDialogContent()}
          onCloseRequest={() => {
            this.setState({ showMergeErrorDialog: false });
            this.props.clearMergeError();
          }}
          lblOK={t('CLOSE')}
          hideCancelButton
        />
        <NotificationBanner visible={!!this.state.addGuestError} content={t('ADD_MEMBER_ERROR')} closeable type="warning" onClose={this.clearError} />
        {!!isThereAStrongPhoneMatch && displayDuplicatePersonNotification && (
          <NotificationBanner content={t('STRONG_MATCH_BANNER_TEXT')} type="merge" data-id="possibleMatchesBanner" />
        )}
        <div className={cf('mainPanel')}>
          <div className={cf('topPanel')}>
            <div className={cf('dataPanel')}>
              <Scrollable ref={ref => (this.scrollableArea = ref)} height={437} fixedDimensions>
                <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem' }}>
                  {this.renderLegalName()}
                  {this.shouldDisplayPreferredName() && this.renderPreferredName()}
                  {this.renderPhoneNumbers()}
                  <Dialog
                    id="addPhoneDialog"
                    ref={d => (this.phoneDialog = d)}
                    onOpen={() => this.phoneTextBox.focus()}
                    type="modal"
                    onClosing={() => this.btnAddPhone.focus()}
                    onCloseRequest={() => this.closeContactInfoDialog(this.phoneDialog)}>
                    <Button
                      id="addPhoneBtn"
                      ref={ref => (this.btnAddPhone = ref)}
                      disabled={this.props.formDisabled}
                      style={{ marginLeft: -6, marginTop: '.5rem' }}
                      btnRole={'primary'}
                      type={'flat'}
                      label={t('ADD_PHONE_BTN_LABEL')}
                    />
                    <DialogOverlay>
                      <PhoneTextBox
                        label={t('PHONE')}
                        id="newPhoneText"
                        wide
                        useActiveLabel
                        showClear
                        onEnterPress={() => this.validateAndAddPhoneNumber(this.phoneTextBox.value)}
                        ref={txt => (this.phoneTextBox = txt)}
                        errorMessage={this.state.newContactInfo && this.state.newContactInfo.errorMessage}
                        onChange={this.clearNewContactInfoError}
                      />
                      <DialogActions>
                        <Button onClick={() => this.closeContactInfoDialog(this.phoneDialog)} label={t('CANCEL')} type="flat" />
                        <Button
                          id="verifyPhoneNumberBtn"
                          onClick={() => this.validateAndAddPhoneNumber(this.phoneTextBox.value)}
                          label={'VERIFY PHONE'}
                          type="flat"
                        />
                      </DialogActions>
                    </DialogOverlay>
                  </Dialog>
                  {this.renderEmailAddresses()}
                  <Dialog
                    ref={d => (this.emailDialog = d)}
                    type="modal"
                    id="addEmailDialog"
                    onOpen={() => this.emailTextBox.focus()}
                    onClosing={() => this.btnAddEmail.focus()}
                    onCloseRequest={() => this.closeContactInfoDialog(this.emailDialog)}>
                    <Button
                      id="btnAddEmail"
                      ref={ref => (this.btnAddEmail = ref)}
                      style={{ marginLeft: -6, marginTop: '.5rem' }}
                      disabled={this.props.formDisabled}
                      btnRole={'primary'}
                      type={'flat'}
                      label={t('ADD_EMAIL_BTN_LABEL')}
                    />
                    <DialogOverlay>
                      <div>
                        <TextBox
                          label={t('EMAIL')}
                          id="txtNewEmail"
                          useActiveLabel
                          showClear
                          forceLowerCase
                          wide
                          ref={txt => (this.emailTextBox = txt)}
                          errorMessage={this.state.newContactInfo && this.state.newContactInfo.errorMessage}
                          onChange={this.clearNewContactInfoError}
                          onEnterPress={() => this.validateAndAddEmailAddress(this.emailTextBox.value)}
                        />
                      </div>
                      <DialogActions>
                        <Button onClick={() => this.closeContactInfoDialog(this.emailDialog)} label={t('CANCEL')} type="flat" />
                        <Button
                          id="btnVerifyEmailAddress"
                          onClick={() => this.validateAndAddEmailAddress(this.emailTextBox.value)}
                          label={'VERIFY EMAIL'}
                          type="flat"
                        />
                      </DialogActions>
                    </DialogOverlay>
                  </Dialog>
                </div>
              </Scrollable>
            </div>
            <div data-id="personMatchingPanel" className={cf('searchPanel')}>
              {!!resultsExist && (
                <div style={{ padding: '1rem 1.5rem' }}>
                  <Text bold>{t('FAMILIARITY_TEXT')}</Text>
                </div>
              )}
              <div className={cf('searchResults')}>
                <Scrollable ref={ref => (this.scrollableResults = ref)} height={384} fixedDimensions>
                  {isLoading && loadingSection}
                  {!isLoading && (resultsExist ? resultsSection : noResults)}
                  {!isLoading && mergeDialog}
                </Scrollable>
              </div>
            </div>
          </div>
          <div className={cf('bottomPanel')}>
            <Text>{this.getInfoMessage(allEmailAddressesValid)}</Text>
            <div>
              {!this.props.hideCancelButton && (
                <Button btnRole={'secondary'} id="btnCancelEditContactInfo" label={t('CANCEL')} onClick={() => this.props.onCancel()} />
              )}
              <Button
                btnRole={'primary'}
                id="btnCreatePerson"
                loading={this.props.addButtonBusy}
                disabled={
                  this.state.searchStarted ||
                  isLoading ||
                  !requiredFieldsFilled ||
                  !allEmailAddressesValid ||
                  this.props.formDisabled ||
                  this.state.mergeInProgress
                }
                onClick={this.props.person.id ? this.handleUpdate : this.handleSubmit}
                label={this.getCreatePersonButtonLabel()}
              />
            </div>
          </div>
        </div>
      </Card>
    );
  };
}
