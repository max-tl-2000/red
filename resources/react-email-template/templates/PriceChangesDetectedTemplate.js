/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import { Box } from '../../../common/react-html-email-wrapper';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import { firstTextPadding } from '../commonStyles';

const { Text } = Typography;

export default ({ priceChanges, requestUpdateText, thirdPartySystem }) => {
  const renderHeaderCell = text => (
    <Text inline secondary>
      {text}
    </Text>
  );

  const renderPriceChanges = ({ currentCharge, currentChargeDate, amenityName, inventory }) => {
    const { property = {}, building = {} } = inventory;
    return (
      <tr style={{ verticalAlign: 'top' }}>
        <td style={{ paddingLeft: '0px' }} valign="top">
          {property.displayName}
        </td>
        <td valign="top">{building.displayName}</td>
        <td valign="top">{inventory.name}</td>
        <td valign="top">{inventory.externalId}</td>
        <td valign="top">{amenityName}</td>
        <td style={{ textAlign: 'right' }} valign="top">
          {currentCharge}
        </td>
        <td style={{ textAlign: 'center', paddingRight: '0px' }} valign="top">
          {currentChargeDate}
        </td>
      </tr>
    );
  };

  return (
    <Layout>
      <TopBar title="Reva" />
      <Text style={firstTextPadding}>{requestUpdateText}</Text>
      <Box style={{ width: '100%', padding: '24px' }} width="100%" cellPadding="6">
        <tr style={{ verticalAlign: 'top' }}>
          <td style={{ width: '20%', paddingLeft: '0px' }} valign="top">
            {renderHeaderCell('Property')}
          </td>
          <td style={{ width: '15%' }} valign="top">
            {renderHeaderCell('Building')}
          </td>
          <td style={{ width: '10%' }} valign="top">
            {renderHeaderCell('Unit name')}
          </td>
          <td valign="top">{renderHeaderCell(`${thirdPartySystem} unit name`)}</td>
          <td valign="top">{renderHeaderCell('Amenity')}</td>
          <td style={{ width: '10%' }} valign="top">
            {renderHeaderCell('Price')}
          </td>
          <td style={{ width: '15%', paddingRight: '0px' }} valign="top">
            {renderHeaderCell('Date')}
          </td>
        </tr>
        {priceChanges.map(unit => renderPriceChanges(unit))}
      </Box>
    </Layout>
  );
};
