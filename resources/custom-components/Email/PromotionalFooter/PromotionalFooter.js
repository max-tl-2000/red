/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import * as Typography from '../Typography/Typography';
import Image from '../Image/Image';

const { Text, Link } = Typography;

const PromotionalFooter = ({ links, appTextString }) => (
  <div
    style={{
      width: 680,
      height: 92,
      borderRadius: 3,
      fontSize: 12,
    }}>
    <div style={{ borderTop: '1px solid #e0e0e0' }}>
      <div style={{ margin: '16px auto' }}>
        <Text secondary style={{ textAlign: 'center' }}>
          {appTextString}
        </Text>
        <div style={{ textAlign: 'center', margin: '16px auto' }}>
          {
            // TODO: We need to find a proper id here

            links.map((link, i) => {
              // eslint-disable-next-line react/no-array-index-key
              const key = i;
              return (
                <Link
                  key={key}
                  style={{
                    display: 'inline-block',
                    width: 96,
                    height: 30,
                    marginRight: 8,
                  }}
                  href={link.storeUrl}>
                  <Image width="100%" src={link.imgUrl} />
                </Link>
              );
            })
          }
        </div>
      </div>
    </div>
  </div>
);

export default PromotionalFooter;
