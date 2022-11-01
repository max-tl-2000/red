/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import {
  IconButton,
  Button,
  FlyOut,
  FlyOutOverlay,
  FlyOutActions,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogHeader,
  DialogOverlay,
  SelectionGroup,
  Markdown,
  RedList,
  PickBox,
  Switch,
  Typography,
} from 'components';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

const { ListItem, AvatarSection, MainSection } = RedList;

const { Text, Title } = Typography;

import Counter from './Counter';

import { cf } from './FlyOutDemo.scss';

export default class FlyOutDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this._data3 = [
      { id: 1, text: 'One', disabled: true },
      { id: 2, text: 'Two' },
      { id: 3, text: 'Three' },
      { id: 4, text: 'Four' },
      { id: 5, text: 'Five' },
      { id: 6, text: 'Six' },
      { id: 7, text: 'Seven' },
      { id: 8, text: 'Eight' },
      { id: 9, text: 'Nine' },
      { id: 10, text: 'Ten' },
    ];
    this._itemTemplate1 = ({ item: { text, disabled }, selected, multiple }) => (
      <ListItem disabled={disabled}>
        <AvatarSection>
          <PickBox type={multiple ? 'checkbox' : 'radio'} checked={selected} />
        </AvatarSection>
        <MainSection>
          <Text>{text}</Text>
          <Text secondary>{'Some random text here'}</Text>
        </MainSection>
      </ListItem>
    );

    this.state = {
      myFlyoutOpen: false,
      flyOutOpen: false,
      flyOutOpen1: false,
      selected: [],
    };
  }

  handleAnimation({ open, animProps }) {
    animProps.animation = {
      // eslint-disable-line no-param-reassign
      opacity: open ? 1 : 0,
      translateX: open ? 0 : '-100%',
      transformOriginX: ['0', '0'],
      transformOriginY: ['50%', '50%'],
    };
  }

  handleOpening() {
    console.log('opening');
  }

  handleOpen() {
    console.log('open');
  }

  handleClosing() {
    console.log('closing');
  }

  handleClose() {
    console.log('close');
  }

  render() {
    const { selected } = this.state;

    return (
      <DemoPage title="FlyOut" style={{ paddingBottom: 200 }}>
        <DemoSection title="Simple FlyOut">
          <p className="p">
            The following is a very dirty FlyOut component, it is more like a placeholder. There are more things that need to be added here like
          </p>
          <ul className="list">
            <li>
              Custom positioning the overlay at any place (can be done implementing an <code>onPosition</code> callback that can be used to set the position of
              the FlyOutOverlay)
            </li>
            <li>
              Provide different kind of alingments for this overlay basic ones <code>top/bottom</code> and <code>left/right/center</code>
            </li>
          </ul>
          <PrettyPrint>
            {`
               <div>
                 <Switch label="Show over the trigger" onChange={ (checked) => this.setState({ overTrigger: checked }) } />
                 <Text>When overTrigger property is especified, the FlyOut will cover the trigger</Text>
               </div>
               <div className={ cf('btn-holder') }>
                  <FlyOut ref="flyOut" overTrigger={ this.state.overTrigger } expandTo="bottom-right">
                    <Button label="To bottom right" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                      <FlyOutActions>
                        <Button
                          onClick={() => this.refs.flyOut.close() } // eslint-disable-line
                          type="flat" label="close"
                        />
                      </FlyOutActions>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut ref="flyOut2" expandTo="bottom" overTrigger={ this.state.overTrigger }>
                    <Button label="To Bottom" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut ref="flyOut3" expandTo="bottom-left" overTrigger={ this.state.overTrigger }>
                    <Button label="To Bottom Left" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
               </div>
               <div className={ cf('btn-holder') } >
                 <FlyOut expandTo="top-right" overTrigger={ this.state.overTrigger }>
                    <Button label="To Top Right" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut expandTo="top" overTrigger={ this.state.overTrigger }>
                    <Button label="To Top" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut expandTo="top-left" overTrigger={ this.state.overTrigger }>
                    <Button label="To Top Left" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
               </div>
               <div className={ cf('btn-holder-vertical') } >
                 <FlyOut expandTo="right-bottom" overTrigger={ this.state.overTrigger }>
                    <Button label="To Right Bottom" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut expandTo="right" overTrigger={ this.state.overTrigger }>
                    <Button label="To right" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut expandTo="right-top" overTrigger={ this.state.overTrigger }>
                    <Button label="to Right Top " className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
               </div>
               <div className={ cf('btn-holder-vertical') } >
                 <FlyOut expandTo="left-bottom" overTrigger={ this.state.overTrigger }>
                    <Button label="Left Bottom" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut expandTo="left" overTrigger={ this.state.overTrigger }>
                    <Button label="To Left" className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
                  <FlyOut expandTo="left-top" overTrigger={ this.state.overTrigger }>
                    <Button label="To Left Top " className={ cf('my-btn') } />
                    <FlyOutOverlay>
                      <div className={ cf('overlay-content') }>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>
               </div>
              `}
          </PrettyPrint>
          <div>
            <Switch label="Show over the trigger" onChange={checked => this.setState({ overTrigger: checked })} />
            <Text>When overTrigger property is especified, the FlyOut will cover the trigger</Text>
          </div>
          <div className={cf('btn-holder')}>
            <FlyOut ref="flyOut" overTrigger={this.state.overTrigger} expandTo="bottom-right">
              <Button label="To bottom right" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
                <FlyOutActions>
                  <Button
                          onClick={() => this.refs.flyOut.close() } // eslint-disable-line
                    type="flat"
                    label="close"
                  />
                </FlyOutActions>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut ref="flyOut2" expandTo="bottom" overTrigger={this.state.overTrigger}>
              <Button label="To Bottom" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut ref="flyOut3" expandTo="bottom-left" overTrigger={this.state.overTrigger}>
              <Button label="To Bottom Left" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
          </div>
          <div className={cf('btn-holder')}>
            <FlyOut expandTo="top-right" overTrigger={this.state.overTrigger}>
              <Button label="To Top Right" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut expandTo="top" overTrigger={this.state.overTrigger}>
              <Button label="To Top" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut expandTo="top-left" overTrigger={this.state.overTrigger}>
              <Button label="To Top Left" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
          </div>
          <div className={cf('btn-holder-vertical')}>
            <FlyOut expandTo="right-bottom" overTrigger={this.state.overTrigger}>
              <Button label="To Right Bottom" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut expandTo="right" overTrigger={this.state.overTrigger}>
              <Button label="To right" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut expandTo="right-top" overTrigger={this.state.overTrigger}>
              <Button label="to Right Top " className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
          </div>
          <div className={cf('btn-holder-vertical')}>
            <FlyOut expandTo="left-bottom" overTrigger={this.state.overTrigger}>
              <Button label="Left Bottom" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut expandTo="left" overTrigger={this.state.overTrigger}>
              <Button label="To Left" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
            <FlyOut expandTo="left-top" overTrigger={this.state.overTrigger}>
              <Button label="To Left Top " className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
              </FlyOutOverlay>
            </FlyOut>
          </div>
        </DemoSection>
        <DemoSection title="Custom location for a flyout">
          <p className="p">Also features an inner flyout</p>

          <PrettyPrint>
            {`
              <div className={cf('btn-holder')}>
                  <FlyOut ref="customFlyout" expandTo="bottom" onPosition={ // eslint-disable-line
                    (args) => {
                      args.autoPosition = false;
                      args.$overlay.css('position', 'fixed');
                      args.$overlay.position({
                        my: 'right-50 top+50',
                        at: 'right top',
                        of: window,
                      });
                    }
                  }>
                    <Button label="custom location" className={cf('my-btn')}/>
                    <FlyOutOverlay>
                      <div className={cf('overlay-content')}>
                        <p className="textTitle">FlyOut!</p>
                        <p className="p">I'm a flyout. You can add any content inside me</p>
                        <p className="p">I will do my best to properly render the content and align it</p>

                        <FlyOut expandTo="bottom-right" positionArgs={ { my: 'left top', at: 'left top'} }>
                          <Button type="flat" label="inner flyout" />
                          <FlyOutOverlay>
                            <div className={cf('overlay-content')}>
                              <p className="textTitle">Inner FlyOut!</p>
                              <p className="p">A flyout inside another flyout</p>
                              <p className="p">custom positioned to appear to overlap the trigger button</p>
                            </div>
                          </FlyOutOverlay>
                        </FlyOut>

                      </div>
                      <FlyOutActions>
                        <Button btnRole="secondary" type="flat" label="Cancel" onClick={() => { // eslint-disable-line
                          this.refs.customFlyout.close();
                        }}/>
                        <Button type="flat" label="Done" onClick={ () => { // eslint-disable-line
                          this.refs.customFlyout.close();
                        } } />
                      </FlyOutActions>
                    </FlyOutOverlay>
                  </FlyOut>
               </div>
              `}
          </PrettyPrint>
          <div className={cf('btn-holder')}>
                  <FlyOut ref="customFlyout" expandTo="bottom" onPosition={ // eslint-disable-line
                args => {
                  args.autoPosition = false;
                  args.$overlay.css('position', 'fixed');
                  args.$overlay.position({
                    my: 'right-50 top+50',
                    at: 'right top',
                    of: window,
                  });
                }
              }>
              <Button label="custom location" className={cf('my-btn')} />
              <FlyOutOverlay>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>

                  <FlyOut expandTo="bottom-right" positionArgs={{ my: 'left top', at: 'left top' }}>
                    <Button type="flat" label="inner flyout" />
                    <FlyOutOverlay>
                      <div className={cf('overlay-content')}>
                        <p className="textTitle">Inner FlyOut!</p>
                        <p className="p">A flyout inside another flyout</p>
                        <p className="p">custom positioned to appear to overlap the trigger button</p>
                      </div>
                    </FlyOutOverlay>
                  </FlyOut>

                  <Dialog ref="dlg" relativeToWindow type="modal">
                    <Button label="Open dialog" type="flat" /> {/* no need for an onClick handler */}
                    <DialogOverlay>
                      <DialogHeader>
                        <DialogTitle>This is a title demo</DialogTitle>
                      </DialogHeader>
                      <div style={{ padding: 20 }}>
                        <p className="p">Some random text here</p>
                      </div>

                      <DialogActions>
                        <Button
                               onClick={ () => this.refs.dlg.close() } // eslint-disable-line
                          label="Close"
                          type="flat"
                        />
                      </DialogActions>
                    </DialogOverlay>
                  </Dialog>
                </div>
                <FlyOutActions>
                        <Button btnRole="secondary" type="flat" label="Cancel" onClick={() => { // eslint-disable-line
                      this.refs.customFlyout.close();
                    }}
                  />
                  <Button
                    type="flat"
                    label="Done"
                    onClick={() => {
                      // eslint-disable-line
                      this.refs.customFlyout.close();
                    }}
                  />
                </FlyOutActions>
              </FlyOutOverlay>
            </FlyOut>
          </div>
        </DemoSection>

        <DemoSection title="FlyOut without default trigger">
          <p className="p">This example shows how to make the overlay not to close on tap away and look like a dialog</p>
          <PrettyPrint>
            {`
                  <FlyOut ref="myFlyout"
                    closeOnTapAway={false}
                    expandTo="bottom"
                    onPosition={ (args) => { // eslint-disable-line
                        args.autoPosition = false;
                        args.$overlay.css('position', 'fixed');
                        args.$overlay.position({
                          my: 'center center',
                          at: 'center center',
                          of: window,
                        });
                     } }>
                    <FlyOutOverlay>
                      <div className={cf('overlay-content')}>
                          <p className="textTitle">FlyOut!</p>
                          <p className="p">I'm a flyout. You can add any content inside me</p>
                          <p className="p">I will do my best to properly render the content and align it</p>
                        </div>
                        <FlyOutActions>
                          <Button
                            onClick={() => this.refs.myFlyout.close() } // eslint-disable-line
                            type="flat" label="close"
                          />
                        </FlyOutActions>
                    </FlyOutOverlay>
                  </FlyOut>
                  <IconButton iconName="alert" onClick= { () => { // eslint-disable-line
                    this.refs.myFlyout.open();
                  }} />
                `}
          </PrettyPrint>
          <FlyOut
            ref="myFlyout"
            closeOnTapAway={false}
            expandTo="bottom"
                  onPosition={ (args) => { // eslint-disable-line
              args.autoPosition = false;
              args.$overlay.css('position', 'fixed');
              args.$overlay.position({
                my: 'center center',
                at: 'center center',
                of: window,
              });
            }}>
            <FlyOutOverlay>
              <div className={cf('overlay-content')}>
                <p className="textTitle">FlyOut!</p>
                <p className="p">I'm a flyout. You can add any content inside me</p>
                <p className="p">I will do my best to properly render the content and align it</p>
              </div>
              <FlyOutActions>
                <Button
                          onClick={() => this.refs.myFlyout.close() } // eslint-disable-line
                  type="flat"
                  label="close"
                />
              </FlyOutActions>
            </FlyOutOverlay>
          </FlyOut>
                <IconButton iconName="alert" onClick= { () => { // eslint-disable-line
              this.refs.myFlyout.open();
            }}
          />
        </DemoSection>

        <DemoSection title="Lazy">
          <Markdown className="md-content">
            {`
                  The \`lazy\` mode allow a Flyout to only instantiate the content it holds when the flyout is displayed.

                  For this mode to work properly a \`fixed width\` is required on the \`FlyOutOverlay\` as in the following example.
                `}
          </Markdown>
          <PrettyPrint>
            {`
                 <FlyOut ref="flyOutLazy" expandTo="bottom-left" appendToBody>
                   <Button label="To bottom right" className={ cf('my-btn') } />
                   <FlyOutOverlay style={{ width: 350 }} lazy>
                     <div className={cf('overlay-content')}>
                       <p className="textTitle">FlyOut!</p>
                       <p className="p">I'm a flyout. You can add any content inside me</p>
                       <p className="p">I will do my best to properly render the content and align it</p>
                     </div>
                     <FlyOutActions>
                       <Button
                         data-action="close"
                         type="flat" label="close"
                       />
                     </FlyOutActions>
                   </FlyOutOverlay>
                 </FlyOut>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div className={cf('btn-holder')}>
            <FlyOut expandTo="bottom-left" appendToBody>
              <Button label="To bottom right" className={cf('my-btn')} />
              <FlyOutOverlay style={{ width: 350 }} lazy>
                <div className={cf('overlay-content')}>
                  <p className="textTitle">FlyOut!</p>
                  <p className="p">I'm a flyout. You can add any content inside me</p>
                  <p className="p">I will do my best to properly render the content and align it</p>
                </div>
                <FlyOutActions>
                  <Button data-action="close" type="flat" label="close" />
                </FlyOutActions>
              </FlyOutOverlay>
            </FlyOut>
          </div>
        </DemoSection>

        <DemoSection title="FlyOut with buttons and a Selection Group">
          <MDBlock>Simple example of a FlyOut with buttons and a Selection Group</MDBlock>
          <PrettyPrint>
            {`
                     <FlyOut expandTo="bottom-right">
                       <Button label="open flyout" />
                       <FlyOutOverlay container={ false } title="Some Title here" className={ cf('overlay') }>
                         <div className={ cf('overlay-wrapper') }>
                            <SelectionGroup itemTemplate={ this._itemTemplate1 }
                                            items={ this._data3 }
                                            selectedValue={ selected }
                                            multiple
                                            onChange={ ({ ids }) => this.setState({ selected: ids }) } />
                         </div>
                         <FlyOutActions>
                           <Button type="flat" label="Cancel" btnRole="secondary" data-action="close" />
                           <Button type="flat" label="Select" data-action="close" />
                         </FlyOutActions>
                       </FlyOutOverlay>
                     </FlyOut>
                   `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <FlyOut expandTo="bottom-right">
            <Button label="open flyout" />
            <FlyOutOverlay container={false} title="Some Title here" className={cf('overlay')}>
              <div className={cf('overlay-wrapper')}>
                <SelectionGroup
                  itemTemplate={this._itemTemplate1}
                  items={this._data3}
                  selectedValue={selected}
                  multiple
                  onChange={({ ids }) => this.setState({ selected: ids })}
                />
              </div>
              <FlyOutActions>
                <Button type="flat" label="Cancel" btnRole="secondary" data-action="close" />
                <Button type="flat" label="Select" data-action="close" />
              </FlyOutActions>
            </FlyOutOverlay>
          </FlyOut>
        </DemoSection>

        <DemoSection title="Using state and open prop">
          <MDBlock>{`
                  A \`FlyOut\` can also be opened using the \`open\` prop.

                  **IMPORTANT**: When using this mode is very important
                  to pass an \`onClose\` handler to make sure the state is keep in
                  sync, because by default \`FlyOuts\` are hidden on tap away.

                  The following example is just an example of this:

                `}</MDBlock>
          <PrettyPrint>
            {`
                    <FlyOut appendToBody
                            onClose={ () => this.setState({ flyOutOpen: false }) }
                            open={ this.state.flyOutOpen }
                            positionArgs={ { my: 'left top', at: 'left top', of: window } }>
                       <FlyOutOverlay animationFn={ this.handleAnimation }
                                      style={ { width: 350, height: '100vh', borderRadius: 0 } }
                                      container
                                      lazy>
                         <div>
                           <Title>This is a FlyOut that looks like a sidebar</Title>
                           <Counter />
                           <Text>The counter in this flyOut is just to show that
                            the content is rendered only when it is opened, becasue
                            this FlyOut was declared to be lazy</Text>
                         </div>
                         <FlyOutActions>
                           <Button data-action="close" type="flat" label="close" />
                        </FlyOutActions>
                      </FlyOutOverlay>
                    </FlyOut>
                    <Button label="Show FlyOut as SideNav"
                            className={ cf('my-btn') }
                            onClick={ () => this.setState({ flyOutOpen: true }) } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <FlyOut
            appendToBody
            onClose={() => this.setState({ flyOutOpen: false })}
            open={this.state.flyOutOpen}
            positionArgs={{ my: 'left top', at: 'left top', of: window }}>
            <FlyOutOverlay animationFn={this.handleAnimation} style={{ width: 350, height: '100vh', borderRadius: 0 }} container lazy>
              <div>
                <Title>This is a FlyOut that looks like a sidebar</Title>
                <Counter />
                <Text>
                  The counter in this flyOut is just to show that the content is rendered only when it is opened, becasue this FlyOut was declared to be lazy
                </Text>
              </div>
              <FlyOutActions>
                <Button data-action="close" type="flat" label="close" />
              </FlyOutActions>
            </FlyOutOverlay>
          </FlyOut>
          <Button label="Show FlyOut as SideNav" className={cf('my-btn')} onClick={() => this.setState({ flyOutOpen: true })} />
        </DemoSection>

        <DemoSection title="FlyOut Events">
          <MDBlock>{`
                  FlyOut emits the following events:
                  - onOpening: Fired at the beginning of the opening animation
                  - onOpen: Fired when the opening animation is complete
                  - onClosing: Fired as soon as the FlyOut is about to be closed
                  - onClose: Fired when the FlyOut close animation is complete
                 `}</MDBlock>
          <PrettyPrint>
            {`
                     <Button label="FlyOut that generate events" onClick={ () => this.setState({ testFlyOutOpen: true }) } />
                     <FlyOut onOpening={ this.handleOpening }
                             onOpen={ this.handleOpen }
                             open={ this.state.testFlyOutOpen }
                             onClosing={ this.handleClosing }
                             onCloseRequest={ () => this.setState({ testFlyOutOpen: false }) }
                             usePrevSiblingAsTrigger
                             overTrigger
                             onClose={ this.handleClose } >
                        <FlyOutOverlay container>
                          <Typography.Title>Lorem Ipsum</Typography.Title>
                          <Text>This is a demo overlay</Text>
                          <Text>This is a demo overlay</Text>
                          <Text>This is a demo overlay</Text>
                        </FlyOutOverlay>
                     </FlyOut>

                     <Button style={ { marginLeft: 10 } } label="Toggle bottom overlay" onClick={ () => this.setState({ myFlyoutOpen: true }) } />
                     <FlyOut onOpening={ this.handleOpening }
                             onOpen={ this.handleOpen }
                             open={ this.state.myFlyoutOpen }
                             usePrevSiblingAsTrigger
                             onClosing={ this.handleClosing }
                             onCloseRequest={ () => {
                                this.setState({ myFlyoutOpen: false });
                             } }
                             onClose={ this.handleClose } >
                        <FlyOutOverlay container>
                          <Typography.Title>Lorem Ipsum</Typography.Title>
                          <Text>This is a demo overlay</Text>
                          <Text>This is a demo overlay</Text>
                          <Text>This is a demo overlay</Text>
                        </FlyOutOverlay>
                     </FlyOut>
                   `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button label="FlyOut that generate events" onClick={() => this.setState({ testFlyOutOpen: true })} />
          <FlyOut
            onOpening={this.handleOpening}
            onOpen={this.handleOpen}
            open={this.state.testFlyOutOpen}
            onClosing={this.handleClosing}
            onCloseRequest={() => this.setState({ testFlyOutOpen: false })}
            usePrevSiblingAsTrigger
            overTrigger
            onClose={this.handleClose}>
            <FlyOutOverlay container>
              <Typography.Title>Lorem Ipsum</Typography.Title>
              <Text>This is a demo overlay</Text>
              <Text>This is a demo overlay</Text>
              <Text>This is a demo overlay</Text>
            </FlyOutOverlay>
          </FlyOut>

          <Button style={{ marginLeft: 10 }} label="Toggle bottom overlay" onClick={() => this.setState({ myFlyoutOpen: true })} />
          <FlyOut
            onOpening={this.handleOpening}
            onOpen={this.handleOpen}
            open={this.state.myFlyoutOpen}
            usePrevSiblingAsTrigger
            onClosing={this.handleClosing}
            overTrigger
            expandTo="top-right"
            onCloseRequest={() => {
              this.setState({ myFlyoutOpen: false });
            }}
            onClose={this.handleClose}>
            <FlyOutOverlay container>
              <Typography.Title>Lorem Ipsum</Typography.Title>
              <Text>This is a demo overlay</Text>
              <Text>This is a demo overlay</Text>
              <Text>This is a demo overlay</Text>
            </FlyOutOverlay>
          </FlyOut>
        </DemoSection>
      </DemoPage>
    );
  }
}
