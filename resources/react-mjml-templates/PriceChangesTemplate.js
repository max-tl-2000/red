/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';

export default ({ priceChanges }) => {
  const renderPriceChanges = ({ currentCharge, currentChargeDate, amenityName, inventory }) => {
    const { property = {}, building = {} } = inventory;
    return (
      <tr>
        <td>{property.displayName}</td>
        <td>{building.displayName}</td>
        <td>{inventory.name}</td>
        <td>{inventory.externalId}</td>
        <td>{amenityName}</td>
        <td align="right">{currentCharge}</td>
        <td>{currentChargeDate}</td>
      </tr>
    );
  };

  return (
    <mj-table font-family="Roboto" color="#212121" line-height="20px" font-size="13px" padding-top="4px" padding-bottom="24px">
      <tr style={{ color: '#757575' }}>
        <td>Property</td>
        <td>Building</td>
        <td>Unit</td>
        <td>Yardi unit name</td>
        <td>Amenity</td>
        <td>Price</td>
        <td>Date</td>
      </tr>
      {priceChanges.map(unit => renderPriceChanges(unit))}
    </mj-table>
  );
};
