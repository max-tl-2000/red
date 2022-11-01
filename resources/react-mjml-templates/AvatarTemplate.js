/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import get from 'lodash/get';
import { getMetaFromName } from '../../common/helpers/avatar-helpers';

export default class Avatar extends Component {
  static propTypes = {
    id: PropTypes.string,
    userName: PropTypes.string,
    src: PropTypes.string,
  };

  render() {
    const { employee } = this.props;
    const imageUrl = get(employee, 'avatarImage.imageUrl');
    const employeeName = get(employee, 'fullName');

    const meta = employeeName && getMetaFromName(employeeName);
    const backgroundColor = (meta && meta.color) || '#e0e0e0';

    const renderImage = () =>
      imageUrl ? (
        <mj-image
          src={imageUrl}
          padding="0px 8px 8px 8px"
          border="mediumpx none rgb(128, 128, 128)"
          width="40px"
          height="40px"
          border-radius="50% 50% 50% 50%"
          container-background-color="transparent"
        />
      ) : (
        <mj-text align="right" font-family="Roboto" font-size="14px">
          <span
            style={{
              backgroundColor,
              display: 'inline-block',
              width: '48px',
              height: '100%',
              verticalAlign: 'middle',
              padding: '16px 0px',
              textAlign: 'center',
              borderRadius: '50%',
              border: 'none',
              boxShadow: '0px 0px',
            }}>
            {(meta && meta.initials) || '^.^'}
          </span>
        </mj-text>
      );

    return <mj-container>{renderImage()}</mj-container>;
  }
}
