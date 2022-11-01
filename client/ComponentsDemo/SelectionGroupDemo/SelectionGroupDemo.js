/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import rand from 'helpers/rand';
import { SelectionGroup, TileSelectionGroup, AutoSize, RedList, Button, Icon, Typography } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';

const { ListItem, AvatarSection, MainSection } = RedList;

const { Text } = Typography;

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

const getItems = (n, parentId = '') => {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: `${parentId}_${i}`,
      disabled: i % 3 === 0,
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
      text: `Group: ${loremIpsumArr[rand(0, loremIpsumArr.length - 1)].substr(0, 30)}`,
      items: getItems(rand(1, 10), i),
    });
  }
  return arr;
};

const colors = ['#B3E5FC', '#FFE0B2', '#FFCCBC', '#B2DFDB', '#D7CCC8', '#FFF9C4', '#C8E6C9', '#B2EBF2', '#F0F4C3', '#DCEDC8'];

const getIcon = (multiple, selected) => {
  if (multiple) {
    // checkbox
    return selected ? 'checkbox-marked' : 'checkbox-blank-outline';
  }
  // radio
  return selected ? 'radiobox-marked' : 'radiobox-blank';
};

export default class SelectionGroupDemo extends Component {
  state = {
    selectionData: [],
  };

  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this._data1 = getGroups(3);
    this._data2 = getItems(7);
    this._data3 = [
      { id: 1, text: 'One', disabled: true },
      { id: 2, text: 'Two' },
      { id: 3, text: 'Three' },
      { id: 4, text: 'Four' },
      { id: 5, text: 'Five', disabled: true },
      { id: 6, text: 'Six' },
      { id: 7, text: 'Seven' },
      { id: 8, text: 'Eight' },
      { id: 9, text: 'Nine' },
      { id: 10, text: 'Ten' },
    ];
    this._itemTemplate1 = ({ item: { text, disabled }, selected, multiple }) => (
      <ListItem disabled={disabled}>
        <AvatarSection>
          <Icon style={{ fill: selected ? '#0096f6' : '' }} name={getIcon(multiple, selected)} />
        </AvatarSection>
        <MainSection>
          <Text>{text}</Text>
          <Text secondary>{'Some random text here'}</Text>
        </MainSection>
      </ListItem>
    );

    this._itemTemplate2 = ({ item: { id, text, disabled }, selected }) => (
      <div
        style={{
          height: 100,
          marginBottom: 20,
          textAlign: 'center',
          border: selected ? '1px solid black' : '1px solid transparent',
          background: disabled ? 'rgba(0,0,0,.24)' : colors[id - 1],
        }}>
        {text}
        {disabled && '- disabled.'}
      </div>
    );

    this.state = { tileWidth: 250 };
  }

  handleSelection(ids) {
    this.setState({ selectionData: ids });
  }

  // Returns a random integer between min (included) and max (included)
  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  toggleReadOnly = () => {
    const { readOnly } = this.state;
    this.setState({ readOnly: !readOnly });
  };

  render() {
    return (
      <DemoPage title="SelectionGroup">
        <DemoSection title="Readonly Selection Group">
          <SubHeader>Result</SubHeader>
          <Button label="Toggle readonly" onClick={this.toggleReadOnly} />
          <SelectionGroup
            readOnly={this.state.readOnly}
            multiple
            selectedValue={this.state.selectionData}
            items={this._data1}
            onChange={({ ids }) => this.handleSelection(ids)}
            columns={2}
          />
        </DemoSection>
        <DemoSection title="Single Selection">
          <Text>Only select one element at a time</Text>
          <PrettyPrint className="javascript">
            {`
                <SelectionGroup items={this._data1} columns={2} />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <AutoSize breakpoints={false}>
            {({ width }) => {
              const columns = width > 1200 ? 4 : Math.floor(width / 200);
              return <SelectionGroup items={this._data1} columns={columns} />;
            }}
          </AutoSize>
        </DemoSection>
        <DemoSection title="Multiple Selection">
          <Text>Select several elements at a time</Text>
          <PrettyPrint className="javascript">
            {`
                <SelectionGroup items={this._data2} multiple columns={2} />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <AutoSize breakpoints={false}>
            {({ width }) => {
              const columns = width > 1200 ? 4 : Math.floor(width / 200);
              return <SelectionGroup items={this._data2} multiple columns={columns} />;
            }}
          </AutoSize>
        </DemoSection>
        <DemoSection title="Custom Items Selection">
          <MDBlock>{`
                 Render any kind of item, that you provide as an \`itemTemplate\`. The template should be a function
                 with two parameters (\`itemObject\` and \`isSelected\`) that renders the item accordingly.
                 `}</MDBlock>
          <PrettyPrint className="javascript">
            {`
                <SelectionGroup items={this._data3} itemTemplate={this._itemTemplate1} columns={2} />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <AutoSize breakpoints={false}>
            {({ width }) => {
              const columns = width > 1200 ? 4 : Math.floor(width / 200);
              return <SelectionGroup items={this._data3} multiple itemTemplate={this._itemTemplate1} columns={columns} />;
            }}
          </AutoSize>
        </DemoSection>
        <DemoSection title="Tile Selection Group">
          <MDBlock>{`
                 A custom selection group for items provided as an \`itemTemplate\`. Besides the template, you should provide the
                 \`baseWidth\` which will be the desired width of the element, and the \`gutter\` which is the space between items.
                 Items width will be flexible, based on the values provided, while the gutter will always be the same.
                 `}</MDBlock>
          <PrettyPrint className="javascript">
            {`
                <TileSelectionGroup items={this._data3} itemTemplate={this._itemTemplate2} baseWidth={ 150 } gutter={ 20 } />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button
            label="Random width"
            onClick={() =>
              this.setState({
                tileWidth: SelectionGroupDemo.getRandomInt(100, 400),
              })
            }
          />
          <p>
            Current base width: {this.state.tileWidth}
            px
          </p>
          <TileSelectionGroup items={this._data3} itemTemplate={this._itemTemplate2} baseWidth={this.state.tileWidth} gutter={20} />
        </DemoSection>
      </DemoPage>
    );
  }
}
