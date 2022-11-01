/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { RedTable, Button, Typography as T, CheckBox, IconButton } from 'components';
import notifier from 'helpers/notifier/notifier';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

import multiselectData from './demoData/multiselect';
import monthlyChargesData from './demoData/monthlyCharges';
import otherChargesData from './demoData/otherCharges';

import DataTable from './GroupTable/model/DataTable';
import GroupTable from './GroupTable/GroupTable';

const { Table, Header, Title, SubTitle, Row, RowHeader, Cell, TextPrimary, TextSecondary, TextHighlight, Money, HeaderActions } = RedTable;

export default class TableDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.multiselectModel = new DataTable(multiselectData);
    this.aditionalDataModel = new DataTable(monthlyChargesData);
    this.otherChargesModel = new DataTable(otherChargesData);
  }

  render() {
    return (
      <DemoPage title="Table">
        <DemoSection title="Read Only Table">
          <p className="p">
            The following markup provides the basic elements to construct tables. A more complex abstraction can be made on top of this. It also showcase the{' '}
            <code>Money</code> Component
          </p>
          <PrettyPrint className="javascript">
            {`
                  import { RedTable } from 'components';

                  const {
                    Table,
                    Header,
                    Title,
                    SubTitle,
                    Row,
                    RowHeader,
                    Cell,
                    TextPrimary,
                    TextSecondary,
                    TextHighlight,
                    Money,
                  } = RedTable;

                  <Table type="readOnly">
                    <Header>
                      <Title>Table title goes here</Title>
                      <SubTitle>Optional subtitle goes here</SubTitle>
                   </Header>
                   <RowHeader key="r-1">
                     <Cell>
                       Some title goes here
                     </Cell>
                     <Cell width={150} textAlign="right">
                       6 - months
                     </Cell>
                     <Cell width={150} textAlign="right">
                       12 - months
                     </Cell>
                   </RowHeader>
                   <Row key="r-2">
                     <Cell>
                       October 2015
                     </Cell>
                     <Cell>
                       <Money amount={3500.136} currency="USD" />
                     </Cell>
                     <Cell>
                       <Money amount={2890.00} currency="USD" />
                       <TextHighlight>Save: <Money amount={750.00} noFormat currency="USD" /></TextHighlight>
                     </Cell>
                   </Row>
                   <Row key="r-3">
                     <Cell>
                       November 2015 - Febuary 2016
                     </Cell>
                     <Cell>
                       <Money amount={5595.00} currency="USD" />
                     </Cell>
                     <Cell>
                       <Money amount={4595.00} currency="USD" />
                       <TextHighlight>Save: <Money amount={400.00} noFormat currency="USD" /></TextHighlight>
                     </Cell>
                   </Row>
                   <Row key="r-4">
                     <Cell>
                       <TextPrimary>March 2016</TextPrimary>
                       <TextSecondary>Lorem ipsum dolor sit amet, consectetuer.</TextSecondary>
                     </Cell>
                     <Cell>
                       <Money amount={3490.00} currency="USD" />
                     </Cell>
                     <Cell>
                       <Money amount={2890.00} currency="USD" />
                       <TextHighlight>Save: <Money amount={950.00} noFormat currency="USD" /></TextHighlight>
                     </Cell>
                   </Row>
                   <Row key="r-5">
                     <Cell>
                       <TextPrimary>April 2016 - September 2016</TextPrimary>
                     </Cell>
                     <Cell />
                     <Cell>
                       <Money amount={4595.00} currency="USD" />
                     </Cell>
                   </Row>
                   <Row key="r-6">
                     <Cell>
                       <TextPrimary>October 2016</TextPrimary>
                     </Cell>
                     <Cell />
                     <Cell>
                       <Money amount={2597.00} currency="USD" />
                     </Cell>
                   </Row>
                  </Table>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Table type="readOnly">
            <Header>
              <Title>Table title goes here</Title>
              <SubTitle>Optional subtitle goes here</SubTitle>
            </Header>
            <RowHeader key="r-1">
              <Cell>Some title goes here</Cell>
              <Cell width={150} textAlign="right">
                6 - months
              </Cell>
              <Cell width={150} textAlign="right">
                12 - months
              </Cell>
            </RowHeader>
            <Row
                   onClick={() => notifier.info('touch on row')} // eslint-disable-line
              key="r-2">
              <Cell>October 2015</Cell>
              <Cell>
                <Money amount={3500.136} currency="USD" />
              </Cell>
              <Cell>
                <Money amount={2890.0} currency="USD" />
                <TextHighlight>
                  Save: <Money amount={750.0} noFormat currency="USD" />
                </TextHighlight>
              </Cell>
            </Row>
            <Row key="r-3">
              <Cell>November 2015 - Febuary 2016</Cell>
              <Cell>
                <Money amount={5595.0} currency="USD" />
              </Cell>
              <Cell>
                <Money amount={4595.0} currency="USD" />
                <TextHighlight>
                  Save: <Money amount={400.0} noFormat currency="USD" />
                </TextHighlight>
              </Cell>
            </Row>
            <Row key="r-4">
              <Cell>
                <TextPrimary>March 2016</TextPrimary>
                <TextSecondary>Lorem ipsum dolor sit amet, consectetuer.</TextSecondary>
              </Cell>
              <Cell>
                <Money amount={3490.0} currency="USD" />
              </Cell>
              <Cell>
                <Money amount={2890.0} currency="USD" />
                <TextHighlight>
                  Save: <Money amount={950.0} noFormat currency="USD" />
                </TextHighlight>
              </Cell>
            </Row>
            <Row key="r-5">
              <Cell>
                <TextPrimary>April 2016 - September 2016</TextPrimary>
              </Cell>
              <Cell />
              <Cell>
                <Money amount={4595.0} currency="USD" />
              </Cell>
            </Row>
            <Row key="r-6">
              <Cell>
                <TextPrimary>October 2016</TextPrimary>
              </Cell>
              <Cell />
              <Cell>
                <Money amount={2597.0} currency="USD" />
              </Cell>
            </Row>
          </Table>
        </DemoSection>

        <DemoSection title="Nested Table">
          <MDBlock>{`
                To make a nested table make sure you wrap the rows in a div and set an indent level for some of those rows.

                \`<Row />\` elements have 2 properties that control the indent to look like their are nested.
                - \`indentLevel\`: A positive number greater than 0. By default is 0 (no indent)
                - \`indentSize\`: The size of the indent in pixels. 50 is the deafult.
                `}</MDBlock>
          <PrettyPrint>
            {`
                   <Table>
                     <Header>
                        <Title>Nested table</Title>
                        <SubTitle>A very simple example of how to make a table with nested rows</SubTitle>
                     </Header>
                     <RowHeader key="r-1">
                       <Cell>
                         Description
                       </Cell>
                       <Cell width={ 150 } textAlign="right">
                         Quantity
                       </Cell>
                       <Cell width={ 150 } textAlign="right">
                         Cost
                       </Cell>
                     </RowHeader>
                     <div key="r-2">
                       <Row>
                         <Cell>
                           <T.Text>Some simple description here</T.Text>
                         </Cell>
                         {/* for perfect alignment is needed to provide the width since we're
                           wrapping this row in a div, the Table won't be able to automatically
                           apply the width to this element */}
                         <Cell width={ 150 } textAlign="right">
                           <T.Text>1</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <Money amount={ 230.00 } currency="USD" />
                         </Cell>
                       </Row>
                       <Row indentLevel={ 1 }>
                         <Cell>
                           <T.Text>Sub item 1</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <T.Text>.5</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <Money amount={ 100.00 } currency="USD" />
                         </Cell>
                       </Row>
                       <Row indentLevel={ 1 }>
                         <Cell>
                           <T.Text>Sub item 2</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <T.Text>.5</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <Money amount={ 130.00 } currency="USD" />
                         </Cell>
                       </Row>
                     </div>
                     <Row key="r-3">
                       <Cell>
                         <T.Text>Normal Item 2</T.Text>
                       </Cell>
                       <Cell width={ 150 } textAlign="right">
                         <T.Text>1</T.Text>
                       </Cell>
                       <Cell width={ 150 } textAlign="right">
                         <Money amount={ 130.00 } currency="USD" />
                       </Cell>
                     </Row>
                     <Row key="r-4">
                       <Cell>
                         <T.Text>Normal Item 3</T.Text>
                       </Cell>
                       <Cell width={ 150 } textAlign="right">
                         <T.Text>1</T.Text>
                       </Cell>
                       <Cell width={ 150 } textAlign="right">
                         <Money amount={ 130.00 } currency="USD" />
                       </Cell>
                     </Row>
                     <div key="r-5">
                       <Row>
                         <Cell>
                           <T.Text>Another Item here</T.Text>
                         </Cell>
                         {/* for perfect alignment is needed to provide the width since we're
                           wrapping this row in a div, the Table won't be able to automatically
                           apply the width to this element */}
                         <Cell width={ 150 } textAlign="right">
                           <T.Text>1</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <Money amount={ 230.00 } currency="USD" />
                         </Cell>
                       </Row>
                       <Row indentLevel={ 1 }>
                         <Cell>
                           <T.Text>Sub item 1</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <T.Text>.5</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <Money amount={ 100.00 } currency="USD" />
                         </Cell>
                       </Row>
                       <Row indentLevel={ 1 }>
                         <Cell>
                           <T.Text>Sub item 2</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <T.Text>.5</T.Text>
                         </Cell>
                         <Cell width={ 150 } textAlign="right">
                           <Money amount={ 130.00 } currency="USD" />
                         </Cell>
                       </Row>
                     </div>
                   </Table>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Table>
            <Header>
              <Title>Nested table</Title>
              <SubTitle>A very simple example of how to make a table with nested rows</SubTitle>
            </Header>
            <RowHeader key="r-1">
              <Cell width={40} type="ctrlCell" />
              <Cell>Description</Cell>
              <Cell width={150} textAlign="right">
                Quantity
              </Cell>
              <Cell width={150} textAlign="right">
                Cost
              </Cell>
            </RowHeader>
            <div key="r-2">
              <Row noDivider>
                <Cell type="ctrlCell" width={40}>
                  <CheckBox checked={false} />
                </Cell>
                <Cell>
                  <T.Text>Some simple description here</T.Text>
                </Cell>
                {/* for perfect alignment is needed to provide the width since we're
                       wrapping this row in a div, the Table won't be able to automatically
                       apply the width to this element */}
                <Cell width={150} textAlign="right">
                  <T.Text>1</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <Money amount={230.0} currency="USD" />
                </Cell>
              </Row>
              <Row indentLevel={1}>
                <Cell width={50} type="ctrlCell">
                  <IconButton iconName="check" />
                </Cell>
                <Cell>
                  <T.Text>Sub item 1</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <T.Text>.5</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <Money amount={100.0} currency="USD" />
                </Cell>
              </Row>
              <Row indentLevel={1}>
                <Cell width={50} type="ctrlCell">
                  <IconButton iconName="check" />
                </Cell>
                <Cell>
                  <T.Text>Sub item 2</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <T.Text>.5</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <Money amount={130.0} currency="USD" />
                </Cell>
              </Row>
            </div>
            <Row key="r-3">
              <Cell type="ctrlCell" width={40}>
                <CheckBox checked={false} />
              </Cell>
              <Cell>
                <T.Text>Normal Item 2</T.Text>
              </Cell>
              <Cell width={150} textAlign="right">
                <T.Text>1</T.Text>
              </Cell>
              <Cell width={150} textAlign="right">
                <Money amount={130.0} currency="USD" />
              </Cell>
            </Row>
            <Row key="r-4">
              <Cell type="ctrlCell" width={40}>
                <CheckBox checked={false} />
              </Cell>
              <Cell>
                <T.Text>Normal Item 3</T.Text>
              </Cell>
              <Cell width={150} textAlign="right">
                <T.Text>1</T.Text>
              </Cell>
              <Cell width={150} textAlign="right">
                <Money amount={130.0} currency="USD" />
              </Cell>
            </Row>
            <div key="r-5">
              <Row noDivider>
                <Cell type="ctrlCell" width={40}>
                  <CheckBox checked={false} />
                </Cell>
                <Cell>
                  <T.Text>Another Item here</T.Text>
                </Cell>
                {/* for perfect alignment is needed to provide the width since we're
                       wrapping this row in a div, the Table won't be able to automatically
                       apply the width to this element */}
                <Cell width={150} textAlign="right">
                  <T.Text>1</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <Money amount={230.0} currency="USD" />
                </Cell>
              </Row>
              <Row indentLevel={1}>
                <Cell type="ctrlCell" width={40}>
                  <CheckBox checked={false} />
                </Cell>
                <Cell>
                  <T.Text>Sub item 1</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <T.Text>.5</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <Money amount={100.0} currency="USD" />
                </Cell>
              </Row>
              <Row indentLevel={1}>
                <Cell type="ctrlCell" width={40}>
                  <CheckBox checked={false} />
                </Cell>
                <Cell>
                  <T.Text>Sub item 2</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <T.Text>.5</T.Text>
                </Cell>
                <Cell width={150} textAlign="right">
                  <Money amount={130.0} currency="USD" />
                </Cell>
              </Row>
            </div>
          </Table>
        </DemoSection>

        <DemoSection title="Simple MultiSelect Table">
          <p className="p">A demo of how to use the raw components to create a multi select table</p>
          <PrettyPrint className="javascript">
            {` // Check the source of the GroupTable demo component
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <GroupTable
            data={this.multiselectModel}
            lblDescriptionTitle="Amenities description"
            headerActions={
              <HeaderActions>
                <Button label="Show All" type="flat" />
              </HeaderActions>
            }
            lblTitle="Title goes here"
            lblTotalCharges="TOTAL CHARGES"
          />
        </DemoSection>
        <DemoSection title="AditionalMonthlyCharges Table">
          <p className="p">A demo of how to use the table components to create the aditionalMonthlyCharges</p>
          <PrettyPrint className="javascript">
            {` // Check the source of the GroupTable demo component
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <GroupTable
            data={this.aditionalDataModel}
            lblDescriptionTitle="Description (charges are per month)"
            headerActions={
              <HeaderActions>
                <Button label="Show All" type="flat" />
              </HeaderActions>
            }
            lblTitle="Aditional monthly charges"
            lblTotalCharges="TOTAL CHARGES"
          />
        </DemoSection>
        <DemoSection title="Other charges">
          <p className="p">A demo of how to use the table components to create the aditionalMonthlyCharges</p>
          <PrettyPrint className="javascript">{'/* Check the source of the GroupTable demo component */'}</PrettyPrint>
          <SubHeader>Result</SubHeader>
          <GroupTable
            data={this.otherChargesModel}
            lblDescriptionTitle="Description (charges are per month)"
            headerActions={
              <HeaderActions>
                <Button label="Show All" type="flat" />
              </HeaderActions>
            }
            lblTitle="Other Charges"
            lblTotalCharges="TOTAL CHARGES"
          />
        </DemoSection>
      </DemoPage>
    );
  }
}
