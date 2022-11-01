/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import rand from 'helpers/rand';
import { RedList, CheckBox, Icon, IconButton, Typography } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

const loremIpsumArr = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 Proin fringilla commodo dui sit amet gravida. Suspendisse finibus nec lacus
 eget consequat. Cras laoreet semper tellus at aliquam.
 Aliquam lacinia diam lectus, aliquam ultricies
 justo tristique ut. Vivamus pulvinar
 blandit maximus. Duis id leo ex.
 Ut ullamcorper nec nisi porta fringilla.
 Pellentesque nunc ante, finibus nec enim in,
 imperdiet porta mi. Etiam a eros mattis,
 interdum erat non, hendrerit dui.
 Fusce convallis sapien nec purus rutrum semper.
 Maecenas dolor libero, consequat nec mauris quis,
 porttitor condimentum justo. Pellentesque habitant morbi
 tristique senectus et netus et malesuada fames ac turpis egestas.
 Fusce hendrerit mattis nulla sit amet dictum.
 Aliquam luctus rutrum massa et hendrerit.
 Morbi quam mauris, consequat vitae ultrices tincidunt,
 pulvinar vel arcu. Morbi maximus viverra venenatis.
 Integer tempor, ante quis tempus ullamcorper,
 lacus urna dapibus nunc, ut malesuada purus sem nec nulla.
 Curabitur ut varius massa, id aliquam mauris.
 Mauris ornare orci vel velit condimentum tempus.`.split(/\n/);

const getItems = n => {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: i,
      title: loremIpsumArr[rand(0, loremIpsumArr.length - 1)].substr(0, 20),
      text: loremIpsumArr[rand(0, loremIpsumArr.length - 1)],
    });
  }
  return arr;
};

const getGroups = n => {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: i,
      title: `Group: ${loremIpsumArr[rand(0, loremIpsumArr.length - 1)].substr(0, 30)}`,
      items: getItems(rand(1, 10)),
    });
  }
  return arr;
};

const { List, ListItem, MainSection, GroupSection, AvatarSection, ActionSection, Text, TextTitle } = RedList;

const { Caption } = Typography;

export default class ListDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="List">
        <DemoSection title="Simple List">
          <Text>Simple List</Text>
          <PrettyPrint className="javascript">
            {`
                  <List>
                  { ((items) => items.map((item) => <ListItem
                                                      key={item.id}
                                                    >
                                                      <MainSection>{item.text}</MainSection>
                                                    </ListItem>))(getItems(10)) }
                  </List>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            {(items =>
              items.map(item => (
                <ListItem key={item.id}>
                  <MainSection>{item.text}</MainSection>
                </ListItem>
              )))(getItems(5))}
          </List>
        </DemoSection>

        <DemoSection title="List with groups">
          <Text>This is an example of a list with groups</Text>
          <PrettyPrint className="javascript">
            {`
                  <List>
                  { ((groups) => groups.reduce((acc, group) => {
                    acc.push(<GroupSection key={group.id}><Caption>{ group.title }</Caption></GroupSection>);
                    group.items.forEach((item) => {
                      acc.push(<ListItem
                                    key={\`\${group.id}_\${item.id}\`}
                                  >
                                  <MainSection>{item.text}</MainSection>
                                </ListItem>);
                    });
                    return acc;
                  }, []))(getGroups(3)) }
                  </List>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            {(groups =>
              groups.reduce((acc, group) => {
                acc.push(
                  <GroupSection key={group.id}>
                    <Caption>{group.title}</Caption>
                  </GroupSection>,
                );
                group.items.forEach(item => {
                  acc.push(
                    <ListItem key={`${group.id}_${item.id}`}>
                      <MainSection>{item.text}</MainSection>
                    </ListItem>,
                  );
                });
                return acc;
              }, []))(getGroups(3))}
          </List>
        </DemoSection>

        <DemoSection title="List with Avatar">
          <Text>This example includes a section for an avatar or for other icons</Text>
          <PrettyPrint className="javascript">
            {`
                 <List>
                  { ((groups) => groups.reduce((acc, group) => {
                    acc.push(<GroupSection key={group.id}><Caption>{ group.title }</Caption></GroupSection>);
                    group.items.forEach((item) => {
                      acc.push(<ListItem
                                    key={\`\${group.id}_\${item.id}\`}
                                  >
                                  <AvatarSection><Icon name="check"/></AvatarSection>
                                  <MainSection>{item.text}</MainSection>
                                </ListItem>);
                    });
                    return acc;
                  }, []))(getGroups(3)) }
                 </List>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            {(groups =>
              groups.reduce((acc, group) => {
                acc.push(
                  <GroupSection key={group.id}>
                    <Caption>{group.title}</Caption>
                  </GroupSection>,
                );
                group.items.forEach(item => {
                  acc.push(
                    <ListItem key={`${group.id}_${item.id}`}>
                      <AvatarSection>
                        <Icon name="check" />
                      </AvatarSection>
                      <MainSection>{item.text}</MainSection>
                    </ListItem>,
                  );
                });
                return acc;
              }, []))(getGroups(3))}
          </List>
        </DemoSection>

        <DemoSection title="List with title and description">
          <Text>List with title and descriptions</Text>
          <PrettyPrint className="javascript">
            {`
                 <List>
                  { ((items) => items.map((item) => <ListItem
                                    key={item.id}
                                  >
                                  <MainSection>
                                    <TextTitle>{item.title}</TextTitle>
                                    <Text>{item.text} {item.text}</Text>
                                  </MainSection>
                                </ListItem>))(getItems(5)) }
                 </List>
              `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            {(items =>
              items.map(item => (
                <ListItem key={item.id}>
                  <MainSection>
                    <TextTitle>{item.title}</TextTitle>
                    <Text>
                      {item.text} {item.text}
                    </Text>
                  </MainSection>
                </ListItem>
              )))(getItems(5))}
          </List>
        </DemoSection>

        <DemoSection title="List with title and description and actions">
          <Text>List with title and descriptions</Text>
          <PrettyPrint className="javascript">
            {`
                <List>
                  { ((items) => items.map((item) => <ListItem
                                  key={item.id}
                                >
                                <MainSection>
                                  <TextTitle>{item.title}</TextTitle>
                                  <Text>{item.text} {item.text}</Text>
                                </MainSection>
                                <ActionSection><IconButton iconName="delete" /></ActionSection>
                              </ListItem>))(getItems(5)) }
                </List>
              `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            {(items =>
              items.map(item => (
                <ListItem key={item.id}>
                  <MainSection>
                    <TextTitle>{item.title}</TextTitle>
                    <Text>
                      {item.text} {item.text}
                    </Text>
                  </MainSection>
                  <ActionSection>
                    <IconButton iconName="delete" />
                  </ActionSection>
                </ListItem>
              )))(getItems(5))}
          </List>
        </DemoSection>

        <DemoSection title="List with avatar and actions">
          <Text>List with a block for an avatar or other icons and a section for actions</Text>
          <PrettyPrint className="javascript">
            {`
                 <List>
                  { ((items) => items.map((item) => <ListItem rowStyle="mixed"
                                    key={item.id}
                                  >
                                  <AvatarSection>
                                    <div style={{borderRadius: '50%', background: '#ddd', height: 36, width: 36}} />
                                  </AvatarSection>
                                  <MainSection>
                                    <TextTitle>{item.title}</TextTitle>
                                    <Text>{item.text} {item.text}</Text>
                                  </MainSection>
                                  <ActionSection><IconButton iconName="delete" /></ActionSection>
                                </ListItem>))(getItems(5)) }
                 </List>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            {(items =>
              items.map(item => (
                <ListItem rowStyle="mixed" key={item.id}>
                  <AvatarSection>
                    <div
                      style={{
                        borderRadius: '50%',
                        background: '#ddd',
                        height: 36,
                        width: 36,
                      }}
                    />
                  </AvatarSection>
                  <MainSection>
                    <TextTitle>{item.title}</TextTitle>
                    <Text>
                      {item.text} {item.text}
                    </Text>
                  </MainSection>
                  <ActionSection>
                    <IconButton iconName="delete" />
                  </ActionSection>
                </ListItem>
              )))(getItems(5))}
          </List>
        </DemoSection>

        <DemoSection title="List with title and description">
          <Text>List with title and descriptions</Text>
          <PrettyPrint className="javascript">
            {`
                <List>
                  <GroupSection>
                    <Caption>Group divider</Caption>
                  </GroupSection>
                  <ListItem>
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                    </MainSection>
                  </ListItem>
                  <ListItem>
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                    </MainSection>
                    <ActionSection>
                      <Icon name="close" />
                    </ActionSection>
                  </ListItem>
                  <GroupSection>
                    <TextTitle>Group divider</TextTitle>
                  </GroupSection>
                  <ListItem>
                    <ActionSection>
                      <CheckBox />
                    </ActionSection>
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                    </MainSection>
                  </ListItem>
                  <ListItem>
                    <AvatarSection>
                      <div style={{width: 24, height: 24, background: 'red'}} />
                    </AvatarSection>
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                    </MainSection>
                  </ListItem>
                  <ListItem rowStyle="mixed">
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                      <Text>Single Line item</Text>
                    </MainSection>
                  </ListItem>
                  <ListItem rowStyle="mixed">
                    <AvatarSection>
                      <div style={{width: 24, height: 24, background: 'red'}} />
                    </AvatarSection>
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                    </MainSection>
                  </ListItem>
                  <ListItem rowStyle="mixed">
                    <AvatarSection>
                      <div style={{width: 24, height: 24, background: 'red'}} />
                    </AvatarSection>
                    <MainSection>
                      <TextTitle>Single Line item</TextTitle>
                      <Text>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris et dui non neque ullamcorper efficitur et non tellus. In tincidunt elit et magna tempus, in ornare eros dictum. Praesent sed ultrices ante. Curabitur a vulputate quam. Proin lacinia nibh et tellus bibendum, at porttitor turpis iaculis. Curabitur pretium libero sed aliquam tempor. Mauris tempor feugiat urna, vel condimentum odio venenatis ac</Text>
                    </MainSection>
                  </ListItem>
                 </List>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <List>
            <GroupSection>
              <Caption>Group divider</Caption>
            </GroupSection>
            <ListItem>
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
              </MainSection>
            </ListItem>
            <ListItem>
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
              </MainSection>
              <ActionSection>
                <Icon name="close" />
              </ActionSection>
            </ListItem>
            <GroupSection>
              <Caption>Group divider</Caption>
            </GroupSection>
            <ListItem>
              <ActionSection>
                <CheckBox />
              </ActionSection>
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
              </MainSection>
            </ListItem>
            <ListItem>
              <AvatarSection>
                <div style={{ width: 24, height: 24, background: 'red' }} />
              </AvatarSection>
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
              </MainSection>
            </ListItem>
            <ListItem rowStyle="mixed">
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
                <Text>Single Line item</Text>
              </MainSection>
            </ListItem>
            <ListItem rowStyle="mixed">
              <AvatarSection>
                <div style={{ width: 24, height: 24, background: 'red' }} />
              </AvatarSection>
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
              </MainSection>
            </ListItem>
            <ListItem rowStyle="mixed">
              <AvatarSection>
                <div style={{ width: 24, height: 24, background: 'red' }} />
              </AvatarSection>
              <MainSection>
                <TextTitle>Single Line item</TextTitle>
                <Text>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris et dui non neque ullamcorper efficitur et non tellus. In tincidunt elit et
                  magna tempus, in ornare eros dictum. Praesent sed ultrices ante. Curabitur a vulputate quam. Proin lacinia nibh et tellus bibendum, at
                  porttitor turpis iaculis. Curabitur pretium libero sed aliquam tempor. Mauris tempor feugiat urna, vel condimentum odio venenatis ac
                </Text>
              </MainSection>
            </ListItem>
          </List>
        </DemoSection>
      </DemoPage>
    );
  }
}
