/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import fuzzysearch from 'fuzzysearch';
import SearchForm from 'custom-components/SearchForm/SearchForm';
import { RedList, Avatar, Typography } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';
import { colors, users, suggestedColors } from './data';

const { Caption } = Typography;

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

export default class SearchFormDemo extends Component {
  matchColor = (query, { originalItem: item }) => fuzzysearch(query, item.name.toLowerCase());

  renderColor = ({ item, query, highlightMatches }) => {
    const text = highlightMatches(item.text, query, { bold: true });

    return (
      <RedList.ListItem rowStyle="mixed">
        <RedList.AvatarSection>
          <div
            style={{
              height: 30,
              width: 30,
              background: item.originalItem.hex,
            }}
          />
        </RedList.AvatarSection>
        <RedList.MainSection>
          {text}
          {item.originalItem.rgb}
        </RedList.MainSection>
      </RedList.ListItem>
    );
  };

  matchQuery = (query, { originalItem: item }) => {
    if (item.items) {
      // we don't perform matching on the group items
      return false;
    }
    return fuzzysearch(query, item.fullName.toLowerCase()) || fuzzysearch(query, item.phone.toLowerCase());
  };

  renderItem = ({ item, query, highlightMatches }) => {
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
  };

  renderGroupItem = ({ item }) => <Caption>{item.originalItem.text}</Caption>;

  render() {
    return (
      <DemoPage title="SearchForm">
        <DemoSection title="SearchForm">
          <MDBlock>
            {`
              A search form is a UI component that allows search thru the elements in a given dataset and show only the ones
              that match the filtering criteria.
            `}
          </MDBlock>
          <PrettyPrint>
            {`
              <SearchForm placeholder="Please select"
                          items={ colors }
                          textField="name"
                          valueField="id" />
            `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <SearchForm placeholder="Please select" items={colors} onChange={selection => console.log(selection)} textField="name" valueField="id" />
        </DemoSection>

        <DemoSection title="Custome item template">
          <MDBlock>
            {`
            This is another example that use a custom item template, and a custom logic to match the elements
            `}
          </MDBlock>
          <PrettyPrint>
            {`
            <SearchForm placeholder="Please select"
                        items={ colors }
                        matchQuery={ this.matchColor }
                        renderItem={ this.renderColor }
                        textField="name"
                        valueField="id" />
            `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <SearchForm
            placeholder="Please select"
            items={colors}
            onChange={selection => console.log(selection)}
            matchQuery={this.matchColor}
            renderItem={this.renderColor}
            textField="name"
            valueField="id"
          />
        </DemoSection>

        <DemoSection title="Grouped users search form">
          <MDBlock>
            {`
              This is another example that use a custom item template, and a custom logic to match the elements for grouped items
            `}
          </MDBlock>
          <PrettyPrint>
            {`
              <SearchForm placeholder="Please select"
                          items={ groupedOptions }
                          matchQuery={ this.matchQuery }
                          renderItem={ this.renderItem }
                          renderGroupItem={ this.renderGroupItem }
                          textField="fullName"
                          valueField="id" />
            `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <SearchForm
            placeholder="Please select"
            items={groupedOptions}
            onChange={selection => console.log(selection)}
            matchQuery={this.matchQuery}
            renderItem={this.renderItem}
            renderGroupItem={this.renderGroupItem}
            textField="fullName"
            valueField="id"
          />
        </DemoSection>

        <DemoSection title="Suggestion lists">
          <MDBlock>
            {`
            This example uses a suggestion list, which is shown when no query is entered yet.
            Once a search is started, the suggestions are replaced by the search results.
            `}
          </MDBlock>
          <PrettyPrint>
            {`
            <SearchForm placeholder="Type for more"
                        items={ colors }
                        suggestedItems={ suggestedColors }
                        matchQuery={ this.matchColor }
                        renderItem={ this.renderColor }
                        textField="name"
                        valueField="id" />
            `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <SearchForm
            placeholder="Type for more"
            items={colors}
            suggestedItems={suggestedColors}
            onChange={selection => console.log(selection)}
            matchQuery={this.matchColor}
            renderItem={this.renderColor}
            textField="name"
            valueField="id"
          />
        </DemoSection>
      </DemoPage>
    );
  }
}
