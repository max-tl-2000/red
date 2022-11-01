/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Avatar } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import { cf } from './styles.scss';

const AvatarDemo = () => {
  const userName = 'Red Admin';
  return (
    <DemoPage title="Avatar">
      <DemoSection title="Default, No Image">
        <p className="p">Basic use of the Avatar component with no src. Use className to specify svg render size.</p>
        <PrettyPrint>
          {`
                  <Avatar className={ cf('avatarSize') } userName={ username } />
                 `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <Avatar className={cf('avatarSize')} userName={userName} />
      </DemoSection>
      <DemoSection title="With Image">
        <p className="p">Basic use of the Avatar component with src. Image does not need to be square.</p>
        <PrettyPrint>
          {`
                  <Avatar className={ cf('avatarSize') } src="{ imageSrc }" />
                 `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <Avatar
          className={cf('avatarSize')}
          src="https://d13yacurqjgara.cloudfront.net/users/75868/screenshots/864006/screen_shot_2012-12-19_at_1.59.57_pm.jpg"
        />
      </DemoSection>
      <DemoSection title="With Icon">
        <p className="p">Basic use of the Avatar component with icon.</p>
        <PrettyPrint>
          {`
                  <Avatar className={ cf('avatarSize') } iconName={ iconName } />
                 `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <Avatar className={cf('avatarSize')} iconName="people" />
      </DemoSection>
      <DemoSection title="With Color/Non-transparent Background">
        <p className="p">Avatar by default has a transparent background. This is easily overiden via className.</p>
        <PrettyPrint>
          {`
                  .avatarBlue {
                    svg {
                      background:$blue300;
                    }
                  }
                  <Avatar className={ cf('avatarSize', 'avatarBlue') } userName={ userName }" />
                 `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <Avatar className={cf('avatarSize', 'avatarBlue')} userName={userName} />
      </DemoSection>
    </DemoPage>
  );
};

export default AvatarDemo;
