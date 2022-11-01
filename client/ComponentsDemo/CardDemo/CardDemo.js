/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Card, CardTitle, CardSubTitle, CardActions, Button, CardHeader, CardMenu, CardMenuItem, CardHActions } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class CardDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="Card">
        <DemoSection title="Simple Card">
          <p className="p">Simplest card possible</p>
          <PrettyPrint className="javascript">
            {`
                  <Card>
                    <p className="p">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi. Donec vulputate interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque. Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.</p>
                  </Card>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Card>
            <p className="p">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi. Donec vulputate
              interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque. Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.
            </p>
          </Card>
        </DemoSection>

        <DemoSection title="Card with title">
          <p className="p">A card with a title</p>
          <PrettyPrint className="javascript">
            {`
                   <Card>
                     <CardTitle>A nice title here</CardTitle>
                     <CardSubTitle>consectetur adipiscing elit. Donec mattis pretium massa.</CardSubTitle>
                     <p className="p">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi. Donec vulputate interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque. Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.</p>
                   </Card>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Card>
            <CardTitle>A nice title here</CardTitle>
            <CardSubTitle>consectetur adipiscing elit. Donec mattis pretium massa.</CardSubTitle>
            <p className="p">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi. Donec vulputate
              interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque. Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.
            </p>
          </Card>
        </DemoSection>

        <DemoSection title="Card with actions">
          <p className="p">
            A card with actions. <code>CardHeader</code> can be used to set the <code>title</code> and <code>subTitle</code> as shown in the example
          </p>
          <PrettyPrint className="javascript">
            {`
                   <Card>
                     <CardHeader title="A Card with actions">
                       <CardHActions>
                         <CardMenu iconName="dots-vertical">
                           <CardMenuItem text="Lorem" />
                           <CardMenuItem text="Ipsum" disabled={ true } />
                         </CardMenu>
                       </CardHActions>
                     </CardHeader>
                     <p className="p">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi. Donec vulputate interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque. Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.</p>
                     <CardActions textAlign="right">
                       <Button label="Some action" type="flat" btnRole="secondary" /><Button label="Action Done" btnRole="primary" type="flat" />
                     </CardActions>
                   </Card>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Card>
            <CardHeader title="A Card with actions">
              <CardHActions>
                <CardMenu iconName="dots-vertical">
                  <CardMenuItem text="Lorem" />
                  <CardMenuItem text="Ipsum" disabled={true} />
                </CardMenu>
              </CardHActions>
            </CardHeader>
            <p className="p">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi. Donec vulputate
              interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque. Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.
            </p>
            <CardActions textAlign="right">
              <Button label="Some action" type="flat" btnRole="secondary" />
              <Button label="Action Done" btnRole="primary" type="flat" />
            </CardActions>
          </Card>
        </DemoSection>
      </DemoPage>
    );
  }
}
