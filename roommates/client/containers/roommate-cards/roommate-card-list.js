/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import { Typography } from 'components';
import { RoommateCard } from './roommate-card';
import { cf } from './roommate-card-list.scss';
import SvgSignIn from '../../../../consumer/static/graphics/ig-app-review.svg';
import { groupFilterTypes } from '../../../common/enums/filter-constants';

const { SubHeader } = Typography;

const renderSignInWarningMessage = () => (
  <div className={cf('sign-in-note-container')}>
    <div className={cf('sign-in-note')}>
      <SvgSignIn />
      <SubHeader>{t('SIGN_IN_ROOMMATES_NOTE')}</SubHeader>
    </div>
  </div>
);

const renderNoRoommatesMessage = selectedGroupFilter => {
  let message;

  switch (selectedGroupFilter) {
    case groupFilterTypes.ALL:
      message = t('NO_ROOMMATE_MATCHES_NOTE');
      break;
    case groupFilterTypes.CONTACTED:
      message = t('NO_CONTACTED_ROOMMATES_NOTE');
      break;
    case groupFilterTypes.FAVORITED:
      message = t('NO_FAVORITED_ROOMMATES_NOTE');
      break;
    default:
      message = t('NO_ROOMMATE_MATCHES_NOTE');
  }

  return (
    <div className={cf('sign-in-note-container')}>
      <SubHeader secondary>{message}</SubHeader>
    </div>
  );
};

export const RoommateCardList = observer(({ roommates, onSelectContact, isAuthenticated, selectedGroupFilter }) => (
  <div>
    <div className={cf('card-list')}>
      {roommates.map((roommate, index) => (
        // TODO: We should use a real id in this case
        // eslint-disable-next-line react/no-array-index-key
        <RoommateCard roommate={roommate} key={`roommate-card-${index}`} onSelectContact={onSelectContact} />
      ))}
    </div>
    {!isAuthenticated && renderSignInWarningMessage()}
    {isAuthenticated && !roommates.length && renderNoRoommatesMessage(selectedGroupFilter)}
  </div>
));

RoommateCardList.propTypes = {
  roommates: PropTypes.array,
  onSelectContact: PropTypes.func,
};
