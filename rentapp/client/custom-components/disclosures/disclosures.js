/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { DisclosureItem } from './disclosure-item';

export const Disclosures = observer(({ viewModel }) => (
  <div>
    {viewModel.items.map((item, index) => (
      <DisclosureItem key={item.id} item={item} index={index} />
    ))}
  </div>
));

Disclosures.propTypes = {
  viewModel: PropTypes.object,
};

Disclosures.displayName = 'Disclosures';
