/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import createElement from './create-element';
const Text = createElement('text');

export const DisclosureCard = observer(({ item, className }) => (
  <div className={`card ${className}`}>
    <div>
      <Text style={{ fontSize: 7 }}>{item.displayName}</Text>
      <Text style={{ fontSize: 7, color: '#A8A8A8' }} secondary>
        {item.comment}
      </Text>
    </div>
  </div>
));

DisclosureCard.propTypes = {
  item: PropTypes.object,
};
