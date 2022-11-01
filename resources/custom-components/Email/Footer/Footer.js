/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import * as Typography from '../Typography/Typography';
import { bodyMailBorder } from '../../../react-email-template/commonStyles';

const { Text, Link, Caption } = Typography;

const Footer = ({ links, tallFooterText, allRightsReserved }) => (
  <div
    style={{
      width: '100%',
      height: tallFooterText ? 128 : 56,
      borderRadius: '3px',
      fontSize: '12px',
      display: 'inline-block',
      fontFamily: 'Roboto,sans-serif',
    }}>
    <div style={{ borderTop: '1px solid #e0e0e0', backgroundColor: '#f5f5f5' }}>
      <div style={{ padding: '20px 24px 16px 24px', borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
        {links.map((link, i, list, isNotLast = list.length - 1 > i) => (
          // TODO: We need to find a proper id here
          // eslint-disable-next-line react/no-array-index-key
          <Link key={`footer-${i}`} style={{ color: '#757575' }} href={link.url} inline>
            {link.text} {isNotLast && <span style={{ padding: '0 4px' }}>|</span>}{' '}
          </Link>
        ))}
      </div>
      {tallFooterText && (
        <Text
          secondary
          style={{
            padding: '0px 24px 31px 25px',
            fontSize: 12,
            borderLeft: bodyMailBorder,
            borderRight: bodyMailBorder,
            borderBottom: bodyMailBorder,
            borderBottomLeftRadius: '3px',
            borderBottomRightRadius: '3px',
          }}>
          {tallFooterText}
        </Text>
      )}
    </div>
    {allRightsReserved && (
      <Caption secondary style={{ padding: '12px 8px' }}>
        {allRightsReserved}
      </Caption>
    )}
  </div>
);

export default Footer;
