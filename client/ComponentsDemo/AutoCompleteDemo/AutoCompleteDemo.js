/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { Dropdown, RedList, Avatar, Typography, Chip } from 'components';
import fuzzysearch from 'fuzzysearch';

import rand from 'helpers/rand';
import { books, users } from './data';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';

const { Title, Caption } = Typography;

const theUsers = users.map(user => ({
  ...user,
  get fullName() {
    return `${user.last_name}, ${user.first_name}`;
  },
}));

const theGroupedUsers = theUsers.reduce((acc, user) => {
  const groupId = user.id % 10;
  acc.set(groupId, {
    id: groupId,
    text: `Group ${groupId}`,
    items: [...((acc.get(groupId) || {}).items || []), user],
  });
  return acc;
}, new Map());
const groupedOptions = [...theGroupedUsers.values()];

export default class AutoCompleteDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {};
  }

  renderItem({ item, query, highlightMatches }) {
    const text = highlightMatches(item.text, query, { bold: true });
    const phoneText = highlightMatches(item.originalItem.phone, query, {
      secondary: true,
    });

    return (
      <RedList.ListItem rowStyle="mixed">
        <RedList.AvatarSection>
          <Avatar userName={item.text} />
        </RedList.AvatarSection>
        <RedList.MainSection>
          {text}
          {phoneText}
        </RedList.MainSection>
      </RedList.ListItem>
    );
  }

  renderGroupItem({ item }) {
    return <Title>{item.originalItem.text}</Title>;
  }

  matchQuery(query, { originalItem: item }) {
    if (item.items) {
      // we don't perform matching on the group items
      return false;
    }
    return fuzzysearch(query, item.fullName.toLowerCase()) || fuzzysearch(query, item.phone.toLowerCase());
  }

  handleAsync = ({ query }) => {
    if (!query) {
      return Promise.resolve([]);
    }

    return new Promise(resolve => {
      setTimeout(() => {
        const res = theUsers.filter(user => fuzzysearch(query, user.fullName.toLowerCase()) || fuzzysearch(query, user.phone.toLowerCase()));
        resolve(res);
      }, rand(500, 1000));
    });
  };

  handleBookChange = ({ ids }) => this.setState({ selectedBookIds: ids });

  // Example of how to pass custom react components to the chipText component
  handleFormatChipText = item => (
    <Caption inline>
      {item.text}{' '}
      <Caption inline highlight>
        {'<<>>'}
      </Caption>
    </Caption>
  );

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);

    return (
      <DemoPage id={theId} title="AutoComplete">
        <DemoSection title="AutoComplete">
          <MDBlock>
            {`
                An autocomplete is a UI component that allows search thru the elements in a given dataset and show only the ones
                that match the filtering criteria.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  // Example of how to pass custom react components to the chipText component
                  handleFormatChipText = (item) =>
                    <Text inline>{ item.text } <Text inline highlight>{ '<<>>' }</Text></Text>;

                  <Dropdown placeholder="Please select"
                         autocomplete
                         wide
                         items={ books }
                         formatChipText={ this.handleFormatChipText }
                         selectedValue={ this.state.selectedBookIds }
                         onChange={ this.handleBookChange }
                         multiple
                         textField="title"
                         valueField="id" />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Chip text="Model unit-2" deletable onRemove={() => console.log('Removing chip')} />
          <Chip text="Model unit-2" deletable onRemove={() => console.log('Removing chip')} />
          <Dropdown
            placeholder="Please select"
            autocomplete
            wide
            label="Books"
            items={books}
            formatChipText={this.handleFormatChipText}
            selectedValue={this.state.selectedBookIds}
            onChange={this.handleBookChange}
            multiple
            textField="title"
            valueField="id"
          />
        </DemoSection>

        <DemoSection title="Users autoComplete example">
          <MDBlock>{`
                 This is another example that use a custom item template, and a custom logic to match the elements
               `}</MDBlock>
          <PrettyPrint>
            {`
                   <Dropdown placeholder="Please select"
                         autocomplete
                         items={ theUsers }
                         multiple
                         matchQuery={ this.matchQuery }
                         renderItem={ this.renderItem }
                         textField="fullName"
                         valueField="id" />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dropdown
            placeholder="Please select"
            autocomplete
            items={theUsers}
            multiple
            matchQuery={this.matchQuery}
            renderItem={this.renderItem}
            textField="fullName"
            valueField="id"
          />
        </DemoSection>

        <DemoSection title="Grouped users autoComplete example">
          <MDBlock>
            {`
                   This is another example that use a custom item template, and a custom logic to match the elements for grouped items
                 `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <Dropdown placeholder="Please select"
                             autocomplete
                             items={ groupedOptions }
                             multiple
                             matchQuery={ this.matchQuery }
                             renderItem={ this.renderItem }
                             renderGroupItem={ this.renderGroupItem }
                             textField="fullName"
                             valueField="id" />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dropdown
            placeholder="Please select"
            autocomplete
            items={groupedOptions}
            multiple
            matchQuery={this.matchQuery}
            renderItem={this.renderItem}
            renderGroupItem={this.renderGroupItem}
            textField="fullName"
            valueField="id"
          />
        </DemoSection>

        <DemoSection title="Users autoComplete. External DataSource">
          <MDBlock>{`
                 This is another example that use a custom item template, and a custom logic to match the elements
               `}</MDBlock>
          <PrettyPrint>
            {`
                   <Dropdown placeholder="Please select"
                         autocomplete
                         multiple
                         source={ this.handleAsync }
                         matchQuery={ this.matchQuery }
                         renderItem={ this.renderItem }
                         textField="fullName"
                         valueField="id" />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div style={{ paddingBottom: 400 }}>
            <Dropdown
              placeholder="Please select"
              autocomplete
              multiple
              source={this.handleAsync}
              matchQuery={this.matchQuery}
              renderItem={this.renderItem}
              textField="fullName"
              valueField="id"
            />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}
