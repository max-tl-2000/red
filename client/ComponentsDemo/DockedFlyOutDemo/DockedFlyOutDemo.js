/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Button } from 'components';
import DockedFlyOutCore from 'components/DockedFlyOut/DockedFlyOutCore';
import newUUID from 'uuid/v4';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import MDBlock from '../DemoElements/MDBlock';

export default class DockedFlyOutDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      window1Width: 300,
      window2Width: 400,
      flyoutId1: newUUID(),
      flyoutId2: newUUID(),
    };
  }

  render() {
    return (
      <DemoPage title="DockedFlyOut">
        <DemoSection title="Controlled mode using parent state">
          <MDBlock>{`
                A docked flyout is basically a container pretty much like the **gmail popups** that open when you compose an email
                or when a chat is opened. The following is an example of using this component with the state of the parent component
               `}</MDBlock>
          <PrettyPrint>
            {`
                   <Button label="Open DockedFlyOut 1" onClick={ () => this.setState({ flyoutOpen1: true }) } />
                   <Button label="Open DockedFlyOut 2" style={ { marginLeft: 10 } } onClick={ () => this.setState({ flyoutOpen2: true }) } />
                   <DockedFlyOutCore windowIconName="phone"
                                 onCloseRequest={ () => this.setState({ flyoutOpen1: false }) }
                                 open={ this.state.flyoutOpen1 }
                                 title="DockedFlyOut 1">
                    <div style={ { height: 300, width: 500, overflow: 'auto' } }>
                      <div style={ { height: 400, background: 'rgb(247, 247, 225)', width: '100%' } }>
                        DockedFlyOut 1 using parent state to open close
                      </div>
                      <div style={ { height: 400, background: '#f3e5f5', width: '100%' } }>
                        DockedFlyOut 1 using parent state to open close
                      </div>
                      <div style={ { height: 400, background: 'rgb(247, 247, 225)', width: '100%' } }>
                        DockedFlyOut 1 using parent state to open close
                      </div>
                      <div style={ { height: 400, background: '#f3e5f5', width: '100%' } }>
                        DockedFlyOut 1 using parent state to open close
                      </div>
                    </div>
                   </DockedFlyOutCore>

                   <DockedFlyOutCore windowIconName="phone"
                                 onCloseRequest={ () => this.setState({ flyoutOpen2: false }) }
                                 open={ this.state.flyoutOpen2 }
                                 title="DockedFlyOut 2">
                    <div style={ { height: 300, width: 500, overflow: 'auto' } }>
                      <div style={ { height: 400, background: '#e3f2fd', width: '100%' } }>
                        DockedFlyOut 2 using parent state to open close
                      </div>
                      <div style={ { height: 400, background: 'rgb(247, 247, 225)', width: '100%' } }>
                        DockedFlyOut 2 using parent state to open close
                      </div>
                      <div style={ { height: 400, background: '#e3f2fd', width: '100%' } }>
                        DockedFlyOut 2 using parent state to open close
                      </div>
                      <div style={ { height: 400, background: 'rgb(247, 247, 225)', width: '100%' } }>
                        DockedFlyOut 2 using parent state to open close
                      </div>
                    </div>
                   </DockedFlyOutCore>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button label="Open DockedFlyOut 1" onClick={() => this.setState({ flyoutOpen1: true })} />
          <Button label="Open DockedFlyOut 2" style={{ marginLeft: 10 }} onClick={() => this.setState({ flyoutOpen2: true })} />
          <DockedFlyOutCore
            windowIconName="phone"
            onCloseRequest={() => this.setState({ flyoutOpen1: false })}
            open={this.state.flyoutOpen1}
            title="DockedFlyOut 1">
            <div style={{ height: 300, width: 500, overflow: 'auto' }}>
              <div
                style={{
                  height: 400,
                  background: 'rgb(247, 247, 225)',
                  width: '100%',
                }}>
                DockedFlyOut 1 using parent state to open close
              </div>
              <div style={{ height: 400, background: '#f3e5f5', width: '100%' }}>DockedFlyOut 1 using parent state to open close</div>
              <div
                style={{
                  height: 400,
                  background: 'rgb(247, 247, 225)',
                  width: '100%',
                }}>
                DockedFlyOut 1 using parent state to open close
              </div>
              <div style={{ height: 400, background: '#f3e5f5', width: '100%' }}>DockedFlyOut 1 using parent state to open close</div>
            </div>
          </DockedFlyOutCore>

          <DockedFlyOutCore
            windowIconName="phone"
            onCloseRequest={() => this.setState({ flyoutOpen2: false })}
            open={this.state.flyoutOpen2}
            title="DockedFlyOut 2">
            <div style={{ height: 300, width: 500, overflow: 'auto' }}>
              <div style={{ height: 400, background: '#e3f2fd', width: '100%' }}>DockedFlyOut 2 using parent state to open close</div>
              <div
                style={{
                  height: 400,
                  background: 'rgb(247, 247, 225)',
                  width: '100%',
                }}>
                DockedFlyOut 2 using parent state to open close
              </div>
              <div style={{ height: 400, background: '#e3f2fd', width: '100%' }}>DockedFlyOut 2 using parent state to open close</div>
              <div
                style={{
                  height: 400,
                  background: 'rgb(247, 247, 225)',
                  width: '100%',
                }}>
                DockedFlyOut 2 using parent state to open close
              </div>
            </div>
          </DockedFlyOutCore>
        </DemoSection>
      </DemoPage>
    );
  }
}
