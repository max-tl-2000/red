/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Typography as T } from 'components';
import React from 'react';
import MDBlock from './MDBlock';
import { cf } from './styles.scss';
import Icon from '../../components/Icon/Icon';

export default function PropertiesTable({ id, data = [], title = 'Properties' }) {
  const linkId = (id || title).replace(/\s+/g, '_');
  const rows = data.map((row, i) => {
    const subLinkId = `${linkId}_${(row[0] || '').replace(/\s+/g, '_')}`;

    // eslint-disable-next-line react/no-array-index-key
    const key = i;

    return (
      <div key={key} className={cf('prop')}>
        <div className={cf('prop-meta')}>
          <T.SubHeader id={subLinkId} data-linkable={true} bold>
            <a href={`#${subLinkId}`} className={cf('section-link')}>
              <Icon name="link" />
            </a>
            {row[0]}
          </T.SubHeader>
          <T.Text secondary>
            Type: {row[1]} {row[2] && <span>Default: {row[2]}</span>}
          </T.Text>
        </div>
        <MDBlock className={cf('mdblock')}>{`${row[3]}`}</MDBlock>
      </div>
    );
  });

  return (
    <div>
      <T.Title id={linkId} data-linkable={true}>
        <a className={cf('section-link')} href={`#${linkId}`}>
          <Icon name="link" />
        </a>
        {title}
      </T.Title>
      <div className={cf('props')}>{rows}</div>
    </div>
  );
}
