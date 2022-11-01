/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

import TileSelectionGroup from '../../components/SelectionGroup/TileSelectionGroup';
import LifestylePreference from './LifestylePreference';

import { cf } from './LifeStyleSelector.scss';

const LifestyleSelector = ({ preferences, selectedPreferences, matchingPreferences, onSelectionChange }) => {
  const itemTemplate = ({
    item: {
      originalItem: { displayName, infographicName },
    },
    selected,
  }) => (
    <LifestylePreference
      key={displayName}
      text={displayName}
      iconName={`${infographicName}-outline`}
      iconNameSelected={infographicName}
      selected={selected}
      matching={(matchingPreferences || []).includes(displayName)}
    />
  );

  const baseWidth = 96;
  const gutter = 12;

  return (
    <div className={cf('life-style-selector')}>
      <TileSelectionGroup
        items={preferences}
        baseWidth={baseWidth}
        numColsPreferred={3}
        gutter={gutter}
        multiple
        onChange={onSelectionChange}
        selectedValue={selectedPreferences || []}
        itemTemplate={itemTemplate}
      />
    </div>
  );
};

export default LifestyleSelector;
