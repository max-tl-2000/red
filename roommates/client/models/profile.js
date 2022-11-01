/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { observable, action, computed } from 'mobx';
import { t } from 'i18next';
import { createModel } from 'helpers/Form/FormModel';
import mapValues from 'lodash/mapValues';
import { now } from '../../../common/helpers/moment-utils';
import { VALIDATION_TYPES } from '../../../client/helpers/Form/Validation';

export default class ProfileModel {
  @observable
  onAppBarIconSectionClick;

  constructor(profile) {
    this.profile = profile;
  }

  @action
  createAndFillModel({ initialState }) {
    const model = createModel(
      {
        fullName: '',
        preferredName: '',
        moveInDateFrom: '',
        moveInDateTo: '',
        gender: '',
        age: '',
        collegeYear: '',
        academicMajor: '',
        preferLiveWith: '',
        likeKeepApartment: '',
        normallyWakeUp: '',
        normallyGoBed: '',
        likeStudyIn: '',
        likeHaveGatheringsInApartment: '',
        preferPetFreeApartment: '',
        shouldKnowAboutMe: '',
        isActive: true,
      },
      {
        fullName: {
          waitForBlur: true,
          required: t('FULL_NAME_REQUIRED'),
        },
        preferredName: {
          waitForBlur: true,
          required: t('PREFERRED_NAME_REQUIRED'),
        },
        moveInDateFrom: {
          required: t('ROOMMATE_PREFERRED_MOVE_IN_DATE_RANGE_REQUIRED'),
          validationType: [
            {
              type: VALIDATION_TYPES.DATE,
              errorMessage: t('INVALID_DATE_FORMAT'),
              args: {
                // let moment use the ISO format
                format: undefined,
              },
            },
          ],
        },
        moveInDateTo: {
          required: t('ROOMMATE_PREFERRED_MOVE_IN_DATE_RANGE_REQUIRED'),
          validationType: [
            {
              type: VALIDATION_TYPES.DATE,
              args: {
                // let moment use the ISO format
                format: undefined,
                minYear: now().year(),
                maxYear: Infinity,
              },
              errorMessage: t('INVALID_DATE_FORMAT'),
              formatError: (token, { minYear: min, maxYear: max, format }) => {
                if (token === 'INVALID_DATE') {
                  return t('INVALID_DATE_FORMAT', { format });
                }
                if (token === 'INVALID_DATE_RANGE') {
                  return t('INVALID_DATE_RANGE_NO_MAX', { format });
                }
                return t(token, { min, max });
              },
            },
          ],
        },
        gender: { required: t('GENDER_REQUIRED') },
        age: { required: t('AGE_REQUIRED') },
        collegeYear: { required: t('ROOMMATE_CURRENT_COLLEGE_YEAR_REQUIRED') },
        preferLiveWith: { required: t('ROOMMATE_LIVE_WITH_REQUIRED') },
        likeKeepApartment: { required: t('ROOMMATE_KEEP_APARTMENT_REQUIRED') },
        normallyWakeUp: { required: t('ROOMMATE_NORMALLY_WAKE_UP_REQUIRED') },
        normallyGoBed: { required: t('ROOMMATE_NORMALLY_GO_BED_REQUIRED') },
      },
    );

    if (initialState) {
      const { id, updated_at, properties, ...initialData } = initialState;
      model.updateFrom(initialData);
    }

    model.fillPreferredName = action(() => {
      const preferredName = model.valueOf('preferredName');
      if (!preferredName) {
        const fullName = model.valueOf('fullName') || '';
        model.updateField('preferredName', fullName.split(' ')[0]);
      }
    });

    return model;
  }

  @action
  create({ initialState }) {
    this.model = this.createAndFillModel({ initialState });
    return this.model;
  }

  @computed
  get currentModel() {
    return this.model;
  }

  @action
  setOnAppBarIconSectionClick(value) {
    this.onAppBarIconSectionClick = value;
  }

  @action
  submitProfileForm(userId, profile) {
    if (profile.isActive === '' || profile.isActive == null) {
      profile.isActive = true;
    }
    return this.profile.saveProfile(userId, { data: profile });
  }

  @action
  deactivateProfile(userId, { isActive }) {
    return this.profile.saveProfile(userId, { data: { isActive } });
  }

  @action
  isProfileCompleted(profile) {
    const model = this.createAndFillModel({ initialState: profile });
    // TODO: this should be using the FormModel computed property
    // return model.requiredAllFilled;
    const profileWithRequiredFields = mapValues(model.fields, field => field.required);
    return !Object.keys(profileWithRequiredFields).some(key => profileWithRequiredFields[key] && (profile[key] == null || profile[key] === ''));
  }
}
