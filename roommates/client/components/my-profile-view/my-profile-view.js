/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { Typography, Button } from 'components';
import { t } from 'i18next';
import { cf } from './my-profile-view.scss';
import SvgChevronRight from '../../../../resources/icons/chevron-right.svg';
import { FullProfileView } from '../full-profile-view/full-profile-view';
import { push } from '../../../../client/helpers/navigator';

const { Caption } = Typography;

export const MyProfileView = observer(({ profile }) => {
  const handleGoToMyProfile = () => push('/profile');
  return (
    <div className={cf('my-profile-view')}>
      <div className={cf('details')}>
        <Caption secondary>{t('MY_ROOMMATE_PROFILE')}</Caption>
        <FullProfileView profile={profile} isMyProfile />
      </div>
      <div className={cf('actions')}>
        <Button useWaves type="flat" btnRole="primary" className={cf('full-profile-btn')} onClick={handleGoToMyProfile}>
          <span>{t('ROOMMATE_FULL_PROFILE')}</span>
          <SvgChevronRight />
        </Button>
      </div>
    </div>
  );
});

MyProfileView.propTypes = {
  profile: PropTypes.object,
};
