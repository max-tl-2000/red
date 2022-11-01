/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { DALTypes } from '../../../common/enums/dal-types';
import { cf, g } from './full-profile-view.scss';

const getPropertyByValue = (dalType, value) => Object.keys(dalType).find(key => dalType[key] === value);

const getTranslatedValue = (dalType, value) => t(getPropertyByValue(dalType, value));

const profilePreferences = [
  {
    prop: 'likeKeepApartment',
    dalType: 'LikeKeepApartment',
    token: 'ROOMMATE_KEEP_APARTMENT',
  },
  {
    prop: 'normallyWakeUp',
    dalType: 'NormallyWakeUp',
    token: 'ROOMMATE_NORMALLY_WAKE_UP',
  },
  {
    prop: 'normallyGoBed',
    dalType: 'NormallyGoBed',
    token: 'ROOMMATE_NORMALLY_GO_BED',
  },
  { prop: 'likeStudyIn', dalType: 'LikeStudyIn', token: 'ROOMMATE_LIKE_STUDY' },
  {
    prop: 'likeHaveGatheringsInApartment',
    dalType: 'LikeHaveGatheringsInApartment',
    token: 'ROOMMATE_LIKE_GATHERINGS',
  },
  {
    prop: 'preferPetFreeApartment',
    dalType: 'PreferPetFreeApartment',
    token: 'ROOMMATE_PET_FREE',
  },
];

export class FullProfileView extends Component {
  static propTypes = {
    profile: PropTypes.object,
  };

  renderPreference = (token, value) => {
    const id = generateId(this);
    const theId = clsc(id, this.id);
    return (
      <div key={theId} className={cf('profile-preference')}>
        <T.Caption secondary>{t(token)}:</T.Caption>
        <T.Text>{value}</T.Text>
      </div>
    );
  };

  renderProfilePreferences = profile =>
    profilePreferences.map(preference => {
      const { prop, dalType, token } = preference;
      const value = profile[prop];
      if (!value) return undefined;
      const translatedValue = getTranslatedValue(DALTypes[dalType], value);
      return this.renderPreference(token, translatedValue);
    });

  render() {
    const { profile, profile: { preferredName, age, gender, collegeYear, academicMajor } = {} } = this.props;
    return (
      <div className={cf(g('full-profile-view'))}>
        <div className={cf('profile-header')}>
          <div>{preferredName && <T.Text inline>{preferredName} </T.Text>}</div>
          <div>
            {gender && <T.Text inline>{gender}, </T.Text>}
            {age && <T.Text inline>{t('ROOMMATE_PROFILE_AGE', { age })}</T.Text>}
          </div>
          <div>
            {collegeYear && <T.Text inline>{collegeYear}</T.Text>}
            {academicMajor && <T.Text inline>, {academicMajor}</T.Text>}
          </div>
        </div>
        {this.renderProfilePreferences(profile)}
      </div>
    );
  }
}
