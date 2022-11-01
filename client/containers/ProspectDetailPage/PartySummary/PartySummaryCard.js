/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { Typography, Icon } from 'components';
import { cf, g } from './PartySummaryCard.scss';
import { getMetaFromName } from '../../../../common/helpers/avatar-helpers';

const { Text, Caption } = Typography;

const Avatar = ({ text, avatarClassName }) => (
  <div className={cf('avatar')}>
    <div className={cf('avatar-wrapper')}>
      <div className={cf('letters', avatarClassName)}>
        <Text inline>{text}</Text>
      </div>
    </div>
  </div>
);

const PartySummaryCard = ({ className, style, displayIconOnly, iconName, value, cssClassIcon, avatarClassName, label, dataId }) => (
  <div data-id={dataId} style={style} className={cf('card', g(className))}>
    {do {
      if (iconName) {
        <Icon name={iconName} className={cf('icon', cssClassIcon)} />;
      } else {
        <Avatar text={getMetaFromName(value, true).initials} avatarClassName={avatarClassName} />;
      }
    }}
    {!displayIconOnly && label && <Caption secondary>{label}</Caption>}
    {!displayIconOnly && <Text>{value}</Text>}
  </div>
);

PartySummaryCard.propTypes = {
  displayIconOnly: PropTypes.bool,
  iconName: PropTypes.string,
  cssClassIcon: PropTypes.string,
};

export default PartySummaryCard;
