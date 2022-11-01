/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Alert } from '@redisrupt/red-svg-icons/dist/web/icons/ui/alert';
import { Emoticon } from '@redisrupt/red-svg-icons/dist/web/icons/ui/emoticon';
import { Delete } from '@redisrupt/red-svg-icons/dist/web/icons/ui/delete';
import { Pencil } from '@redisrupt/red-svg-icons/dist/web/icons/ui/pencil';
import { Information } from '@redisrupt/red-svg-icons/dist/web/icons/ui/information';

import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';
import IconButton from '../../components/IconButton/IconButton';

export default class SVGDemo extends Component {
  // eslint-disable-line
  render() {
    return (
      <DemoPage title="Loading SVG Icons from red-svg-icons package">
        <DemoSection title="Loading a web icon">
          <MDBlock>
            {`
                Loading an svg icon is as simple as importing it directly from the following path @redisrupt/red-svg-icons/dist/web/icons/
                `}
          </MDBlock>
          <PrettyPrint>
            {`
            import { Alert } from '@redisrupt/red-svg-s/dist/web/s/ui/alert';
            import { Emoticon } from '@redisrupt/red-svg-s/dist/web/s/ui/emoticon';
            import { Delete } from '@redisrupt/red-svg-s/dist/web/s/ui/delete';
            import { Pencil } from '@redisrupt/red-svg-s/dist/web/s/ui/pencil';
            import { Information } from '@redisrupt/red-svg-s/dist/web/s/ui/information';
            import IconButton from '../../components/IconButton/IconButton';

            <SubHeader>Plain s</SubHeader>
            <Alert />
            <Emoticon width={40} height={40} style={{ fill: 'red' }} />

            <SubHeader>Usage with IconButton</SubHeader>
            <IconButton IconName={() => <Delete />} />
            <IconButton IconName={() => <Pencil />} />
            <IconButton IconName={() => <Information />} />

                 `}
          </PrettyPrint>
          <SubHeader>Plain s</SubHeader>
          <Alert />
          <Emoticon width={40} height={40} style={{ fill: 'red' }} />

          <SubHeader>Usage with Button</SubHeader>
          <IconButton IconName={() => <Delete />} />
          <IconButton IconName={() => <Pencil />} />
          <IconButton IconName={() => <Information />} />
        </DemoSection>
      </DemoPage>
    );
  }
}
