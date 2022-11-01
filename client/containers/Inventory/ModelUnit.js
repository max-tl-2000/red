/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import InventoryDetails from './InventoryDetails';
import InventoryActions from './InventoryActions';
import { cf } from './ModelUnit.scss';

export default class ModelUnit extends Component { // eslint-disable-line
  render() {
    const { inventory, partyId, timezone } = this.props;

    return (
      <div className={cf('model-unit')}>
        <InventoryDetails inventory={inventory} />
        <InventoryActions unit={inventory} partyId={partyId} timezone={timezone} />
      </div>
    );
  }
}
