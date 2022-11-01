/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { getStyleFor } from './Styles';
import { Title, SubHeader } from '../Typography/Typography';
import { Box } from '../../../../common/react-html-email-wrapper';

const TopBar = ({ id, titleSection, tall, subHeaderSection, rightSectionTopPadding, rightSectionWidth = '50%', title, subHeader, ...rest }) => {
  if (!titleSection && title) {
    titleSection = <Title lighter>{title}</Title>;
  }

  if (!subHeaderSection && subHeader) {
    subHeaderSection = <SubHeader lighter>{subHeader}</SubHeader>;
  }

  const tallStyle = tall ? { verticalAlign: 'top', paddingTop: '15px' } : {};

  if (rightSectionTopPadding === undefined) {
    rightSectionTopPadding = tall ? '15px' : 0;
  }

  return (
    <Box width="100%" bgcolor="#2196f3" style={getStyleFor('topBar')} id={id} cellSpacing="0" cellPadding="0" {...rest}>
      <tr height={!tall ? 56 : 104} style={{ height: !tall ? 56 : 104 }}>
        <td style={getStyleFor('titleSection', { ...tallStyle, color: '#fff' })} valign={tall ? 'top' : 'middle'}>
          {titleSection}
        </td>
        <td
          style={getStyleFor('subjectSection', { ...tallStyle, width: rightSectionWidth, paddingTop: rightSectionTopPadding })}
          align="right"
          width={rightSectionWidth}
          valign={tall ? 'top' : 'middle'}>
          {subHeaderSection}
        </td>
      </tr>
    </Box>
  );
};

export default TopBar;
