/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Truncate, Typography as T, Button, Avatar } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['className', 'String', '', 'The className of the component'],
  ['direction', 'String', '', 'One of `["vertical", "horizontal"]`. Which direction the fade effect will be rendered'],
  ['moreAffordace', 'Component', '', 'A react component to render instead of the default "more" button'],
  ['lessAffordace', 'Component', '', 'A react component to render instead of the default "less" button'],
  ['collapsible', 'Boolean', 'false', "Whether the Truncate component can be collapsed back. Only works in case of `direction='vertical'`"],
  ['bgColor', 'Array', '', 'An array with the following shape `[r, g, b, a]`. Example `[255, 20, 20, 1]`'],
];

export default class TruncateDemo extends Component { // eslint-disable-line
  render() {
    return (
      <DemoPage title="Truncate">
        <PropertiesTable firstColumWidth={220} data={api} />
        <DemoSection title="How do I make a section to be truncated with fade vertically?">
          <MDBlock>
            {`
                   Specify \`direction\` as \`vertical\` and make sure you specify a \`maxHeight\` as well as the \`collapsible\` property
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <Truncate direction="vertical" maxHeight={ 120 } collapsible>
                     <Button label="some nice label" onClick={ () => console.log('>>> clicked inside a foreignObject') } />
                     <T.Text>
                       Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                       sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                       Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                       nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                       reprehenderit in voluptate velit esse cillum dolore eu fugiat
                       nulla pariatur. Excepteur sint occaecat cupidatat non proident,
                       sunt in culpa qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                     </T.Text>
                   </Truncate>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Truncate direction="vertical" maxHeight={150} collapsible>
            <T.Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
              veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
              velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim
              id est laborum. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Excepteur sint
              occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </T.Text>
          </Truncate>
        </DemoSection>

        <DemoSection title="How do I make a section to be truncated with fade horizontally?">
          <MDBlock>
            {`
                just specify \`direction\` as \`horizontal\`, in this mode the component will
                take \`100%\` of the \`width\` of the parent, so that's why we don't really need a \`maxWidth\`
                as like in the vertical case where we do need the \`maxHeight\`.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <Truncate direction="horizontal">
                     <T.SubHeader>Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                       sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                     </T.SubHeader>
                     <T.Text>
                       Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                       sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                       Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                       nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                       reprehenderit in voluptate velit esse cillum dolore eu fugiat
                       nulla pariatur. Excepteur sint occaecat cupidatat non proident,
                       sunt in culpa qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                     </T.Text>
                   </Truncate>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Truncate direction="horizontal">
            <T.SubHeader>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </T.SubHeader>
            <T.Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
              veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
              velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim
              id est laborum. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Excepteur sint
              occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </T.Text>
          </Truncate>
        </DemoSection>

        <DemoSection title="How do I make a truncate component that cannot be collapsed back?">
          <MDBlock>
            {`
                  Specify the \`direction\` property to \`vertical\` and a \`maxHeight\`.
                  Do not include the \`collapsible\` property or set it to \`false\`.
                  `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <Truncate direction="vertical" maxHeight={ 120 }>
                     <Button label="some nice label" onClick={ () => console.log('>>> clicked inside a foreignObject') } />
                     <T.Text>
                       Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                       sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                       Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                       nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                       reprehenderit in voluptate velit esse cillum dolore eu fugiat
                       nulla pariatur. Excepteur sint occaecat cupidatat non proident,
                       sunt in culpa qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                     </T.Text>
                   </Truncate>
                   `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Truncate direction="vertical" maxHeight={120}>
            <Button label="some nice label" onClick={() => console.log('>>> clicked inside a foreignObject')} />
            <T.Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
              veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
              velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim
              id est laborum. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Excepteur sint
              occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </T.Text>
          </Truncate>
        </DemoSection>

        <DemoSection title="Should it work with a different background?">
          <MDBlock>
            {`
                  Yes it will work well **if the background color is a solid color**. By default the component will try to use the first non
                  transparent color background. Take in mind there are some exceptions:
                  - when the componet background is a gradient or use an alpha channel.
                  - when there is an absolute positioned element messing up with the \`parentElement\` hierarchy.
                    Since the component attempts to detect the bgColor of the first parent element with a background color set,
                    it might fail if an element is behind this component instance using absolute positioning, but it is not a direct
                    parentElement.
                  - In cases where there are failures you can use the \`bgColor\` property to specify a custom background color.
                  `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <Truncate direction="vertical" maxHeight={ 120 }>
                     <Button label="some nice label" onClick={ () => console.log('>>> clicked inside a foreignObject') } />
                     <T.Text>
                       Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                       sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                       Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                       nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                       reprehenderit in voluptate velit esse cillum dolore eu fugiat
                       nulla pariatur. Excepteur sint occaecat cupidatat non proident,
                       sunt in culpa qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                       Excepteur sint occaecat cupidatat non proident, sunt in culpa
                       qui officia deserunt mollit anim id est laborum.
                     </T.Text>
                   </Truncate>
                   `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div style={{ padding: 40, background: '#eee' }}>
            <Truncate direction="vertical" maxHeight={80} collapsible>
              <Avatar userName="Roy Riojas" />
              <T.Text>
                Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
                veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
                velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
                anim id est laborum. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Excepteur
                sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </T.Text>
            </Truncate>
          </div>
          <div style={{ padding: 40, background: '#eee', marginTop: 20 }}>
            <Truncate direction="horizontal">
              <T.SubHeader>
                Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </T.SubHeader>
              <T.Text>
                Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
                veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
                velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
                anim id est laborum. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Excepteur
                sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </T.Text>
            </Truncate>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}
