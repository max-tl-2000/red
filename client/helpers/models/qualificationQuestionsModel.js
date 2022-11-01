/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { FormModel } from 'helpers/Form/FormModel';
import { computed, observable, action, reaction, toJS } from 'mobx';
import { isNum } from 'helpers/type-of';
import { t } from 'i18next';
import { isCorporateGroupProfile as _isCorporateGroupProfile, getLeaseTypeForParty } from '../../../common/helpers/party-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { hasOwnProp } from '../../../common/helpers/objUtils';
export default class QualificationQuestionsModel extends FormModel {
  @observable
  _warningMode;

  @observable
  _initialGroupProfile;

  @observable
  _partyId;

  @computed
  get numBedrooms() {
    return this.valueOf('numBedrooms');
  }

  @computed
  get groupProfile() {
    return this.valueOf('groupProfile');
  }

  @computed
  get cashAvailable() {
    return this.valueOf('cashAvailable');
  }

  @computed
  get moveInTime() {
    return this.valueOf('moveInTime');
  }

  @computed
  get numberOfUnits() {
    return this.valueOf('numberOfUnits');
  }

  @computed
  get leaseLength() {
    return this.valueOf('leaseLength');
  }

  constructor(props, partyId, unkownQuestions) {
    const { initialState, validators } = props || {};
    super(initialState, validators);
    this._warningMode = false;
    this._initialGroupProfile = initialState.groupProfile;
    this._partyId = partyId;
    this._unkownQuestions = unkownQuestions || {};
    reaction(
      () => this.isCorporateGroupProfile,
      isCorporateGroupProfile => {
        if (isCorporateGroupProfile) {
          this.setCorporate();
        } else {
          this.setTraditional();
        }
      },
    );
  }

  @computed
  get isCorporateGroupProfile() {
    return _isCorporateGroupProfile({ groupProfile: this.groupProfile });
  }

  @computed
  get shouldShowWarning() {
    if (!this._initialGroupProfile || this._initialGroupProfile === this.groupProfile) return false;

    const corporateGroupProfile = DALTypes.QualificationQuestions.GroupProfile.CORPORATE;
    if (this._initialGroupProfile === corporateGroupProfile && this.groupProfile !== corporateGroupProfile) return true;

    return this._initialGroupProfile !== corporateGroupProfile && this.groupProfile === corporateGroupProfile;
  }

  @computed
  get showWarning() {
    return this.shouldShowWarning && this._warningMode;
  }

  @computed
  get qualificationQuestions() {
    const data = {
      numBedrooms: this.numBedrooms,
      groupProfile: this.groupProfile,
      moveInTime: this.moveInTime,
    };
    if (!this.isCorporateGroupProfile) {
      return {
        ...this._unkownQuestions,
        ...data,
        cashAvailable: this.cashAvailable,
      };
    }

    return {
      ...this._unkownQuestions,
      ...data,
      numberOfUnits: this.numberOfUnits,
      leaseLength: toJS(this.leaseLength),
    };
  }

  @computed
  get leaseTypeForParty() {
    return getLeaseTypeForParty({ qualificationQuestions: this.qualificationQuestions });
  }

  @action
  setCorporate() {
    super.updateFrom({
      cashAvailable: '',
    });
  }

  @action
  setTraditional() {
    super.updateFrom({
      numberOfUnits: null,
      leaseLength: null,
    });
  }

  @action
  setWarningMode(enable = true) {
    this._warningMode = enable;
  }

  @action
  updateInitialGroupProfile(groupProfile) {
    this._initialGroupProfile = groupProfile;
  }

  @action
  restoreData(questions, partyId) {
    questions = questions || {};
    if (hasOwnProp(questions, 'groupProfile')) {
      this.updateInitialGroupProfile(questions.groupProfile);
    }

    const validQuestions = this._fieldKeys().reduce((acc, key) => {
      if (!hasOwnProp(questions, key)) return acc;

      return {
        ...acc,
        [key]: questions[key],
      };
    }, {});

    this.updateFrom(validQuestions);
    this._partyId = partyId;
  }

  @action
  changePartyType(partyType) {
    const leaseType = partyType === DALTypes.PartyTypes.CORPORATE ? DALTypes.QualificationQuestions.GroupProfile.CORPORATE : '';
    this.restoreData({ groupProfile: leaseType });
  }

  @action
  clear() {
    this.updateFrom({ numBedrooms: [], groupProfile: '', cashAvailable: '', moveInTime: '', numberOfUnits: null, leaseLength: null });
  }

  @action
  clearForParty(partyId) {
    this._partyId = partyId;
    this.clear();
  }

  @computed
  get partyId() {
    return this._partyId;
  }
}

export const createQualificationQuestionsModel = (props, partyId) => {
  const { numBedrooms = [], groupProfile = '', cashAvailable = '', moveInTime = '', numberOfUnits = null, leaseLength = null, ...unkownQuestions } =
    props || {};

  const initialState = {
    numBedrooms,
    groupProfile,
    cashAvailable,
    moveInTime,
    numberOfUnits,
    leaseLength,
  };

  return new QualificationQuestionsModel(
    {
      initialState,
      validators: {
        numberOfUnits: {
          fn: field => {
            const num = parseInt(field.value, 10);
            if (isNum(num) && num > 0) {
              return true;
            }
            return { error: t('NUMBER_MUST_BE_GREATER_THAN_ZERO') };
          },
          // validation won't happen on every change
          interactive: false,
          // only after first blur validation will be executed
          waitForBlur: true,
        },
      },
    },
    partyId,
    unkownQuestions,
  );
};
