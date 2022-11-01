/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import Text from 'components/Typography/Text';
import { cf, g } from './ChildrenCard.scss';

export const ChildrenCard = observer(({ item: child, onItemSelected = () => {}, className }) => {
  const handleOnTouchTapItem = e => onItemSelected(e, child);

  return (
    <div onClick={handleOnTouchTapItem} className={cf('children-card', g(className))}>
      <div>
        <Text> {child.preferredName}</Text>
        <Text data-id="childFullNameLabelText" secondary>
          {child.fullName}
        </Text>
      </div>
    </div>
  );
});

ChildrenCard.propTypes = {
  item: PropTypes.object,
  onItemSelected: PropTypes.func,
};
