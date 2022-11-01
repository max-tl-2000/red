/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import rand from 'helpers/rand';
import { Dropdown, Button, RedList, Typography, Field } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import MDBlock from '../DemoElements/MDBlock';

const { ListItem, MainSection } = RedList;

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

export default class DropdownDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.data1 = getGroups(5);
    this.data2 = getItems(20);
    this.data3 = [
      {
        id: '1',
        text: 'Filter By',
        items: [
          {
            id: '1_1',
            text: 'Time',
          },
          {
            id: '1_2',
            text: 'Agent',
          },
          {
            id: '1_3',
            text: 'Action',
          },
        ],
      },
    ];

    this.data4 = [
      {
        id: '2_1',
        text: 'Time',
      },
      {
        id: '2_2',
        text: 'Agent with a very long name that will force some change',
      },
      {
        id: '2_3',
        text: 'Action',
      },
    ];

    this.state = {
      itemsForDD: this.data3,
      selectedValueForDD: '1_3',
      selectedValue: ['0_0'],
    };

    this.leaseTermsData = [
      {
        id: 'leaseTerm1',
        termDuration: 18,
        specials: true,
        endsOn: 'Nov 15, 2016',
      },
      {
        id: 'leaseTerm2',
        termDuration: 15,
        specials: false,
        endsOn: 'Jan 15, 2016',
      },
      {
        id: 'leaseTerm3',
        termDuration: 12,
        specials: true,
        endsOn: 'Apr 5, 2016',
      },
      {
        id: 'leaseTerm4',
        termDuration: 9,
        specials: false,
        endsOn: 'Jul 3, 2016',
      },
      {
        id: 'leaseTerm5',
        termDuration: 6,
        specials: false,
        endsOn: 'Jan 3, 2016',
      },
      {
        id: 'leaseTerm6',
        termDuration: 3,
        specials: false,
        endsOn: 'Jul 3, 2016',
      },
      {
        id: 'leaseTerm7',
        termDuration: 1,
        specials: false,
        endsOn: 'Jan 3, 2016',
      },
    ];
  }

  renderItem({ item: { originalItem }, selectAffordance /* , selected */ }) {
    const { termDuration, specials, endsOn } = originalItem;
    const label = `${termDuration} ${termDuration === 1 ? 'month' : 'months'}`;
    return (
      <ListItem>
        {selectAffordance}
        <MainSection>
          <Text>
            {label}{' '}
            {specials && (
              <Text inline highlight>
                (specials)
              </Text>
            )}
          </Text>
          {endsOn && <Text secondary>{endsOn}</Text>}
        </MainSection>
      </ListItem>
    );
  }

  formatSelected(args) {
    const periods = args.selected.map(item => item.originalItem.termDuration).join(', ');
    return `${periods} months`;
  }

  render() {
    const { itemsForDD, selectedValueForDD } = this.state;
    return (
      <DemoPage title="Dropdown">
        <DemoSection title="Filterable Dropdown">
          <p className="p">Single selection dropdown</p>
          <PrettyPrint className="javascript">
            {`
                <Dropdown multiple wide label="Something to search" placeholder="Please select a value" items={ this.data1 } filterable />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Field columns={6} inline last>
            <Dropdown multiple wide label="Something to search" placeholder="Please select a value" items={this.data1} filterable />
          </Field>
        </DemoSection>
        <DemoSection title="Dropdown single">
          <p className="p">Single selection dropdown</p>
          <PrettyPrint className="javascript">
            {`
                <Dropdown placeholder="Please select a value" items={ this.data1 } />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dropdown placeholder="Please select a value" items={this.data1} />
        </DemoSection>

        <DemoSection title="Dropdown multiple">
          <p className="p">Multiple selection dropdown</p>
          <PrettyPrint className="javascript">
            {`
                <Dropdown placeholder="Please select a value"
                         items={ this.data2 }
                         selectedValue={ [ '_1', '_3'] }
                         onChange={(args) => console.log(args) } // eslint-disable-line
                         multiple />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dropdown placeholder="Please select a value" items={this.data2} selectedValue={['_1', '_3']} onChange={args => console.log(args)} multiple />
        </DemoSection>

        <DemoSection title="Dropdown - Single select list">
          <p className="p">A single selection List</p>
          <PrettyPrint>
            {`
                <Dropdown placeholder="Select a value"
                         items={ itemsForDD }
                         selectedValue={ selectedValueForDD }
                         onChange={ (args) => {
                            this.setState({
                              selectedValueForDD: args.id,
                            });
                          }}
                         />
                 <Button style={{ marginTop: 40 }} label="Toggle data" onClick={ () => this.setState({
                    itemsForDD: itemsForDD === this.data3 ? this.data4 : this.data3,
                 })} />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dropdown
            placeholder="Select a value"
            items={itemsForDD}
            selectedValue={selectedValueForDD}
            onChange={args => {
              this.setState({
                selectedValueForDD: args.id,
              });
            }}
          />
          <Button
            style={{ marginTop: 40, display: 'block' }}
            label="Toggle data"
            onClick={() =>
              this.setState({
                itemsForDD: itemsForDD === this.data3 ? this.data4 : this.data3,
              })
            }
          />
        </DemoSection>

        <DemoSection title="Lease term selector">
          <MDBlock>{`
                 This is a demo of how to use the Dropdown component to render the **Lease Term Selector**
               `}</MDBlock>
          <PrettyPrint>{`
                  renderItem({ item: { originalItem }, selectAfforance /* , selected */ }) {
                    const { termDuration, specials, endsOn } = originalItem;
                    const label = \`\${termDuration} \${termDuration === 1 ? 'Month' : 'Months'}\`;
                    return <ListItem>
                             {selectAfforance}
                             <MainSection>
                               <Text>{label} { specials && <Text inline highlight>(specials)</Text>}</Text>
                               <Text secondary>{endsOn}</Text>
                             </MainSection>
                           </ListItem>;
                  }

                  formatSelected(args) {
                    const periods = args.selected.map((item) => item.originalItem.termDuration).join(', ');
                    return \`\${periods} Months\`;
                  }
                  <Dropdown triggerStyle={{ width: 300 }}
                    placeholder="Lease Term"
                    items={ this.leaseTermsData }
                    multiple
                    renderItem={this.renderItem} // use this to render the Custom Item
                    formatSelected={this.formatSelected} // use this to format the selected label
                    useTooltip={false} // use formatTooltip to format the tooltip that is displayed over the trigger
                    />
                `}</PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dropdown
            triggerStyle={{ width: 300 }}
            placeholder="Lease Term"
            items={this.leaseTermsData}
            multiple
            renderItem={this.renderItem}
            formatSelected={this.formatSelected}
            useTooltip={false}
          />
        </DemoSection>
      </DemoPage>
    );
  }
}
