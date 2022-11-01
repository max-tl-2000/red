/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { t } from 'i18next';
import VehicleCard from './VehicleCard';
import { cf } from './VehicleSummary.scss';

export const VehicleSummary = observer(({ vehicles }) => {
  if (!vehicles || vehicles.length === 0) {
    return <EmptyMessage message={t('NO_VEHICLES_ADDED')} />;
  }

  return (
    <div className={cf('vehicle-summary')}>
      {vehicles.map(vehicle => (
        <div key={vehicle.id}>
          <VehicleCard item={vehicle} className={cf('vehicle-card')} />
        </div>
      ))}
    </div>
  );
});

VehicleSummary.propTypes = {
  vehicles: PropTypes.array,
};
