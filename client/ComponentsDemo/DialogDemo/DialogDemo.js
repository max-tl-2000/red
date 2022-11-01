/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Dialog, DialogOverlay, Button, DialogHeader, DialogTitle, DialogActions, DialogHeaderActions, IconButton, FullScreenDialog } from 'components';
import { setHashProp, parseHash } from 'helpers/hash';
import { sizes, screenIsAtLeast } from 'helpers/layout';
import { observer, inject } from 'mobx-react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import Content from './Elements/Content';

import Counter from '../FlyOutDemo/Counter';

const content = (
  <div>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam venenatis, massa eu rutrum imperdiet, risus nisi dictum odio, dapibus iaculis sem ante a
      velit. Nam pretium lorem non ex mattis pellentesque. Donec id molestie massa, tincidunt consequat nisl. Etiam sollicitudin sapien leo, id varius risus
      egestas vel. Pellentesque blandit nisi ac diam molestie dapibus. Cras tortor felis, laoreet in malesuada vel, cursus et eros. In vehicula volutpat lacus
      ut tincidunt. Phasellus in aliquam leo, in faucibus nulla. Nam vehicula turpis non quam euismod condimentum.
    </p>
    <p>
      Pellentesque quis luctus magna, sit amet vulputate odio. Nunc imperdiet erat id magna condimentum tincidunt. Phasellus justo ante, rutrum et mi nec,
      accumsan accumsan lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Vivamus interdum, justo vitae
      eleifend aliquam, nulla mauris lobortis tortor, ut tempor leo purus ut libero. Donec gravida massa in mi tempus, quis euismod odio pretium. Sed porta orci
      ullamcorper aliquam tempor. Nullam eu varius turpis. Pellentesque in convallis augue. Etiam suscipit massa eget risus interdum, vel vehicula tortor
      gravida. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque faucibus quis nisl et faucibus. Sed congue volutpat magna, consequat tempus
      est dictum eu. Ut non efficitur justo.
    </p>
    <p>
      In fringilla, ipsum nec viverra viverra, dolor libero euismod lectus, eu ornare mauris neque sed nunc. Nunc aliquam ante quis massa finibus eleifend.
      Proin elementum lorem at congue malesuada. Phasellus a nunc et erat euismod euismod et et augue. Phasellus nisl orci, fermentum eget tortor nec, blandit
      eleifend magna. Vestibulum laoreet maximus tortor, vitae fringilla est dictum ac. Mauris porttitor vel nibh sodales sagittis. Etiam vitae porta nunc.
      Donec ut erat odio. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Integer sagittis ante quis neque
      tristique, et porta purus efficitur. Nam in scelerisque velit, quis auctor purus.
    </p>
    <p>
      Ut non consectetur leo, quis accumsan ligula. Nullam rhoncus malesuada ante a consectetur. Pellentesque posuere, neque luctus efficitur venenatis, sem
      felis feugiat enim, id rutrum sem diam sed eros. Nunc eget ligula gravida, pellentesque lectus ut, aliquam dolor. Cras a magna vel est aliquet tincidunt.
      Nullam venenatis tortor eu risus placerat, non sollicitudin velit elementum. Nullam elementum volutpat lectus, vel sollicitudin nisl sollicitudin ut. Sed
      facilisis efficitur est, sed faucibus dui vulputate ut. Maecenas lectus ligula, fermentum quis felis at, facilisis egestas nibh.
    </p>
    <p>
      Nunc vitae nisl vel lorem mattis eleifend a nec massa. Ut fringilla vulputate urna. Fusce mattis tempor erat, vel vehicula ante dictum non. In rutrum leo
      ut porta suscipit. Ut pharetra accumsan sodales. Pellentesque sollicitudin finibus luctus. Integer vitae malesuada urna. Sed nec tincidunt dui, eu
      lobortis nibh. Proin in libero commodo, efficitur tellus suscipit, efficitur felis. Etiam et odio accumsan lacus ornare venenatis et quis nulla. Etiam
      euismod commodo elit, vitae finibus arcu fringilla sed.
    </p>
  </div>
);

@inject('screen')
@observer
export default class DialogDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.state = {
      dialogOpen: false,
      evtDialogOpen: false,
    };
  }

  componentDidMount() {
    const props = parseHash();
    if (props.dialogOpen) {
      setTimeout(() => {
        this.setState({
          dialogOpen: true,
        });
      }, 50);
    }
  }

  open = () => {
    setHashProp('dialogOpen', true);

    this.setState({
      dialogOpen: true,
    });
  };

  handleClose = () => {
    console.log('close');
    setHashProp('dialogOpen', false);

    this.setState({
      dialogOpen: false,
    });
  };

  render() {
    const dialogType = screenIsAtLeast(this.props.screen.size, sizes.small1) ? 'modal' : 'fullscreen';

    return (
      <DemoPage title="Dialog">
        <MDBlock>{`
              A \`dialog\` component can be used to show content in a nice overlay that will be centered in the screen.

              The approach we have taken requires to write some extra markup, but gives you the freedom to add any number of
              buttons as well as any other *React Components* inside the dialog, in the \`DialogHeader\` location and in
              the \`DialogActions\` location.

              There are two ways to render a dialog

              ## Option 1 - Nesting the trigger inside the dialog
             `}</MDBlock>
        <PrettyPrint>{`
              <Dialog>
                { /* Dialog will be opened when the button is clicked
                     no need to add an any handlers to open it */ }
                <Button label="This button will show a dialog" />
                <DialogOverlay>
                  <DialogHeader title="Dialog Title" />
                  <div> { /* Put here the dialog content */ } </div>
                  <DialogActions>
                    { /* adding [data-action="close"]  to any element will
                         make it to close the dialog when clicked */ }
                    <Button label="cancel" data-action="close" />
                  </DialogActions>
                </DialogOverlay>
              </Dialog>
             `}</PrettyPrint>

        <MDBlock>{`
              ## Option 2 - no trigger
              When using this option is important to use a \`ref\` to be able to call the open method in
              the \`dialog\` or use the \`open\` prop to set the state.

              ### Using a \`ref\` to call open in the \`Dialog\` instance
             `}</MDBlock>
        <PrettyPrint>{`
              <Dialog ref="myDialog">
                <DialogOverlay>
                  <DialogHeader title="Dialog Title" />
                  <div> { /* Put here the dialog content */ } </div>
                  <DialogActions>
                    { /* adding [data-action="close"]  to any element will
                         make it to close the dialog when clicked */ }
                    <Button label="cancel" data-action="close" />
                  </DialogActions>
                </DialogOverlay>
              </Dialog>
              <Button label="This button will show a dialog" onClick={ () => this.refs.myDialog.open() } />
             `}</PrettyPrint>
        <MDBlock>{`
             ### Using the \`open\` prop
             Using the open prop requires the parent component to keep the state of the dialog.DialogDemo.js

              **Important**. When using the \`open\` prop it is required to pass an \`onCloseRequest\` handler so the parent
              component is informed when the Dialog attempt to be closed because of a tapAway or a click on an element with
              \`[data-action="close"]\` property set.
             `}</MDBlock>
        <PrettyPrint>{`
              <Dialog open={ this.state.myDialogOpen }
                      onCloseRequest={ () => this.setState({ myDialogOpen: false }) }>
                <DialogOverlay>
                  <DialogHeader title="Dialog Title" />
                  <div> { /* Put here the dialog content */ } </div>
                  <DialogActions>
                    { /* adding [data-action="close"]  to any element will
                         make it to close the dialog when clicked */ }
                    <Button label="cancel" data-action="close" />
                  </DialogActions>
                </DialogOverlay>
              </Dialog>
              <Button label="This button will show a dialog"
                      onClick={ () => this.setState({ myDialogOpen: true }) } />
             `}</PrettyPrint>

        <DemoSection title="Simple Dialog">
          <MDBlock>{`
                This shows how to render a very simple \`dialog\`.
                `}</MDBlock>
          <PrettyPrint>
            {`
                <Dialog ref="dlg">
                 <Button label="Open dialog" /> {/* no need for an onClick handler to open the dialog*/}
                 <DialogOverlay>
                   <DialogHeader>
                     <DialogTitle>This is a title demo</DialogTitle>
                   </DialogHeader>
                   <div style={{padding: 20 }}>
                      <p className="p">Some random text here</p>
                   </div>

                   <DialogActions>
                     <Button
                      onClick={ () => this.refs.dlg.close() } // eslint-disable-line
                      label="Close"
                      type="flat" />
                   </DialogActions>
                 </DialogOverlay>
                </Dialog>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dialog>
            <Button label="Open dialog demo" />
            <DialogOverlay>
              <DialogHeader>
                <DialogTitle>This is a title demo</DialogTitle>
              </DialogHeader>
              <div style={{ padding: 20 }}>
                <div id="lipsum">
                  {content}
                  {content}
                  {content}
                </div>
              </div>
              <DialogActions>
                <Button data-action="close" btnRole="secondary" label="Do Something" type="flat" />
                <Button data-action="close" btnRole="secondary" label="Another button" type="flat" />
                <Button data-action="close" label="Close" type="flat" />
              </DialogActions>
            </DialogOverlay>
          </Dialog>
        </DemoSection>

        <DemoSection title="Modal Dialog">
          <p className="p">This renders a modal dialog</p>
          <PrettyPrint>
            {`
                <Dialog ref="dlg1" type="modal">
                 <Button label="Open Modal Dialog" /> {/* no need for an onClick handler to open the dialog*/}
                 <DialogOverlay>
                   <DialogHeader>
                     <DialogTitle>This is a title demo</DialogTitle>
                   </DialogHeader>
                   <div style={{padding: 20 }}>
                      <p className="p">Some random text here</p>
                   </div>

                   <DialogActions>
                     <Button
                      onClick={ () => this.refs.dlg1.close() } // eslint-disable-line
                      label="Close"
                      type="flat" />
                   </DialogActions>
                 </DialogOverlay>
                </Dialog>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dialog ref="dlg1" type="modal">
            <Button label="Open Modal Dialog" /> {/* no need for an onClick handler to open the dialog */}
            <DialogOverlay>
              <DialogHeader>
                <DialogTitle>This is a title demo</DialogTitle>
              </DialogHeader>
              <div style={{ padding: 20 }}>
                <p className="p">Some random text here</p>
              </div>

              <DialogActions>
                <Button
                      onClick={ () => this.refs.dlg1.close() } // eslint-disable-line
                  label="Close"
                  type="flat"
                />
              </DialogActions>
            </DialogOverlay>
          </Dialog>
        </DemoSection>

        <DemoSection title="Closing a dialog forces and unmount of the content elements">
          <MDBlock>{`
                Dialog should fire the componentWillUnmount of dialog content elements. This example
                Will show that the elements are properly removed from the DOM. Check the console to
                confirm that the elements were unmount.
                `}</MDBlock>
          <PrettyPrint>
            {`
                <Button label="open me" onClick={ () => this.setState({ fsdOpen: true }) } />
                { this.state.fsdOpen && <Dialog open={ this.state.fsdOpen } onCloseRequest={ () => this.setState({ fsdOpen: false }) }>
                  <DialogOverlay><Content /></DialogOverlay>
                </Dialog> }
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button label="open me" onClick={() => this.setState({ fsdOpen: true })} />
          {this.state.fsdOpen && (
            <Dialog open={this.state.fsdOpen} onCloseRequest={() => this.setState({ fsdOpen: false })}>
              <DialogOverlay title="A Demo Dialog">
                <Content />
              </DialogOverlay>
            </Dialog>
          )}
        </DemoSection>

        <DemoSection title="FullScreen Dialog">
          <p className="p">This renders a fullscreen dialog</p>
          <PrettyPrint>
            {`
                 <Button label="Open FullScreen Dialog"
                    onClick={() => this.refs.dlg2.toggle() } // eslint-disable-line
                 />
                 <FullScreenDialog ref="dlg2"
                   title={
                     <DialogTitle>
                       <span>Quote for Unit NT-1701</span>
                       <span style={ { fontSize: 12, marginLeft: 10 } }>(expires Oct 30, 2015)</span>
                     </DialogTitle>
                   }
                   actions={
                    <DialogHeaderActions>
                      <IconButton iconStyle="light" iconName="email" />
                      <IconButton iconStyle="light" iconName="message-text" />
                      <IconButton iconStyle="light" iconName="printer" />
                      <IconButton iconStyle="light" iconName="dots-vertical" />
                    </DialogHeaderActions>
                  }>
                   <p className="p">Some random text here</p>
                   <div style={ { width: '100%', height: 400, background: '#eee', marginBottom: 20 } } />
                   <Dialog>
                     <Button label="Open a dialog here" /> { /* no need for an onClick handler to open the dialog*/ }
                     <DialogOverlay>
                       <DialogHeader>
                         <DialogTitle>Dialog inside dialog</DialogTitle>
                       </DialogHeader>
                       <div style={ { padding: 20 } }>
                          <p className="p">Some random text here</p>
                       </div>
                       <DialogActions>
                         <Button data-action="close"
                          label="Close"
                          type="flat" />
                       </DialogActions>
                     </DialogOverlay>
                   </Dialog>
                   <p className="p">Some random text here</p>
                   <div style={ { width: '100%', height: 400, background: '#eee', marginBottom: 20 } } />
                   <div style={ { width: '100%', height: 400, background: '#eee', marginBottom: 20 } } />
                 </FullScreenDialog>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button
            label="Open FullScreen Dialog"
                  onClick={() => this.refs.dlg2.toggle() } // eslint-disable-line
          />
          <FullScreenDialog
            ref="dlg2"
            title={
              <DialogTitle>
                <span>Quote for Unit NT-1701</span>
                <span style={{ fontSize: 12, marginLeft: 10 }}>(expires Oct 30, 2015)</span>
              </DialogTitle>
            }
            actions={
              <DialogHeaderActions>
                <IconButton iconStyle="light" iconName="email" />
                <IconButton iconStyle="light" iconName="message-text" />
                <IconButton iconStyle="light" iconName="printer" />
                <IconButton iconStyle="light" iconName="dots-vertical" />
              </DialogHeaderActions>
            }>
            <p className="p">Some random text here</p>
            <div
              style={{
                width: '100%',
                height: 400,
                background: '#eee',
                marginBottom: 20,
              }}
            />
            <Dialog>
              <Button label="Open a dialog here" /> {/* no need for an onClick handler to open the dialog */}
              <DialogOverlay>
                <DialogHeader>
                  <DialogTitle>Dialog inside dialog</DialogTitle>
                </DialogHeader>
                <div style={{ padding: 20 }}>
                  <p className="p">Some random text here</p>
                </div>
                <DialogActions>
                  <Button data-action="close" label="Close" type="flat" />
                </DialogActions>
              </DialogOverlay>
            </Dialog>
            <p className="p">Some random text here</p>
            <div
              style={{
                width: '100%',
                height: 400,
                background: '#eee',
                marginBottom: 20,
              }}
            />
            <div
              style={{
                width: '100%',
                height: 400,
                background: '#eee',
                marginBottom: 20,
              }}
            />
          </FullScreenDialog>
        </DemoSection>

        <DemoSection title="Dialogs and z Indexes">
          <p className="p">This renders a modal dialog</p>
          <PrettyPrint>
            {`
                 <div style={{ position: 'relative', height: 500 }}>
                   <div style={{ position: 'absolute', zIndex: 5, width: 200, height: 200, background: 'red' }} />
                 </div>

                 <Dialog type="modal" absoluteZIndex={1}>
                   <Button label="Open Dialog that fails" /> {/* no need for an onClick handler to open the dialog*/}
                   <DialogOverlay>
                     <DialogHeader>
                       <DialogTitle>This dialog will have content on top of it. Bad zIndex</DialogTitle>
                     </DialogHeader>
                     <div style={{ padding: 20 }}>
                        <p className="p">Some random text here</p>
                     </div>
                     <DialogActions>
                       <Button data-action="close" label="Close"
                        type="flat" />
                     </DialogActions>
                   </DialogOverlay>
                 </Dialog>

                 <Dialog type="modal" absoluteZIndex={10}>
                   <Button label="Open Dialog that works" /> {/* no need for an onClick handler to open the dialog*/}
                   <DialogOverlay>
                     <DialogHeader>
                       <DialogTitle>A Dialog with a custom zIndex</DialogTitle>
                     </DialogHeader>
                     <div style={{ padding: 20 }}>
                        <p className="p">Some random text here</p>
                     </div>
                     <DialogActions>
                       <Button data-action="close" label="Close" type="flat" /> { /* notice data-close */ }
                     </DialogActions>
                   </DialogOverlay>
                 </Dialog>

                 <Dialog type="modal" appendToBody={true}>
                   <Button label="Open Dialog that works" /> {/* no need for an onClick handler to open the dialog*/}
                   <DialogOverlay>
                     <DialogHeader>
                       <DialogTitle>A dialog appended to Body</DialogTitle>
                     </DialogHeader>
                     <div style={{ padding: 20 }}>
                        <p className="p">There might be some instances where adding the dialog to the body directly might be needed. Usually this is not a problem, but this is an option as well <code>appendToBody</code></p>
                     </div>
                     <DialogActions>
                       <Button data-action="close" label="Close"
                        type="flat" />
                     </DialogActions>
                   </DialogOverlay>
                 </Dialog>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>

          <div style={{ position: 'relative', height: 500 }}>
            <div
              style={{
                position: 'absolute',
                zIndex: 5,
                width: 200,
                height: 200,
                background: 'red',
              }}
            />
          </div>

          <Dialog type="modal" absoluteZIndex={1}>
            <Button label="Open Dialog that fails" style={{ marginRight: 10 }} /> {/* no need for an onClick handler to open the dialog */}
            <DialogOverlay>
              <DialogHeader>
                <DialogTitle>This dialog will have content on top of it. Bad zIndex</DialogTitle>
              </DialogHeader>
              <div style={{ padding: 20 }}>
                <p className="p">Some random text here</p>
              </div>
              <DialogActions>
                <Button data-action="close" label="Close" type="flat" />
              </DialogActions>
            </DialogOverlay>
          </Dialog>

          <Dialog type="modal" absoluteZIndex={10}>
            <Button label="Open Dialog that works" style={{ marginRight: 10 }} /> {/* no need for an onClick handler to open the dialog */}
            <DialogOverlay>
              <DialogHeader>
                <DialogTitle>A Dialog with a custom zIndex</DialogTitle>
              </DialogHeader>
              <div style={{ padding: 20 }}>
                <p className="p">Some random text here</p>
              </div>
              <DialogActions>
                <Button data-action="close" label="Close" type="flat" /> {/* notice data-close */}
              </DialogActions>
            </DialogOverlay>
          </Dialog>

          <Dialog type="modal" appendToBody={true}>
            <Button label="Open Dialog that works" /> {/* no need for an onClick handler to open the dialog */}
            <DialogOverlay>
              <DialogHeader title="A dialog appened to Body" />
              <div style={{ padding: 20 }}>
                <p className="p">There might be some instances where adding the dialog to the body directly might be needed.</p>
                <p className="p">
                  Usually this is not a problem, but this is an option as well <code>appendToBody</code>
                </p>
              </div>
              <DialogActions>
                <Button data-action="close" label="Close" type="flat" />
              </DialogActions>
            </DialogOverlay>
          </Dialog>
        </DemoSection>

        <DemoSection title="Dialog using props and state">
          <MDBlock>{`
                   \`Dialogs\` can also be opened/closed using the open prop.

                   **Please note**: when opening/closing the dialog using the \`open\` prop is required to add an \`onCloseRequest\` handler
                   to make sure the state is in sync. Dialogs can be closed from inside when pressing a button with \`[data-action="close"]\`
                   or when tapping away and the prop \`closeOnTapAway\` is set to true, which is the default.

                   This example also shows how to use the hash part of the url to create a url that can be used to store
                   the open state of a given dialog.

                   Other thing showcased in this demo is the ability of dialogs to be transformed to fullscreen dialogs
                   based on the size of the screen.
                `}</MDBlock>
          <PrettyPrint>
            {`
                    <Dialog type={ dialogType }
                          open={ this.state.dialogOpen }
                          // sync the state with the state of the dialog
                          onCloseRequest={ this.handleClose }>
                    <DialogOverlay>
                      <DialogHeader title="Open a dialog using props" />
                      <div style={ { width: 400 } }>
                        <MDBlock>{ \`
                          This is an example of a Dialog that can be opened
                          using the \\\`open\\\` prop. Note when doing this the
                          dialog might be closed from inside the dialog. So
                          it is important to add an \\\`onCloseRequest\\\` handler
                          to sync the state of the parent component.
                          \` }</MDBlock>
                      </div>
                      <DialogActions>
                        <Button data-action="close" label="Close" type="flat" />
                      </DialogActions>
                    </DialogOverlay>
                  </Dialog>
                  <Button label="Show/Hide dialog!" onClick={ this.open } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Dialog
              type={dialogType}
              open={this.state.dialogOpen}
              // sync the state with the state of the dialog
              onCloseRequest={this.handleClose}>
              <DialogOverlay>
                <DialogHeader title="Open a dialog using props" />
                <div style={{ width: 400 }}>
                  <Counter />
                  <MDBlock>{`
                          This is an example of a Dialog that can be opened
                          using the \`open\` prop. Note when doing this the
                          dialog might be closed from inside the dialog. So
                          it is important to add an \`onCloseRequest\` handler
                          to sync the state of the parent component.
                          `}</MDBlock>
                </div>
                <DialogActions>
                  <Button data-action="close" label="Close" type="flat" />
                </DialogActions>
              </DialogOverlay>
            </Dialog>
            <Button label="Show/Hide dialog!" onClick={this.open} />
          </div>
        </DemoSection>

        <DemoSection title="Dialog events">
          <MDBlock>{`
                  Dialog emits the following events:
                  - onOpening: Fired at the beginning of the opening animation
                  - onOpen: Fired when the opening animation is complete
                  - onClosing: Fired as soon as the Dialog is about to be closed
                  - onClose: Fired when the Dialog close animation is complete
                 `}</MDBlock>
          <PrettyPrint>
            {`
                     <Dialog onOpening={ () => console.log('opening') }
                             onClosing={ () => console.log('closing') }
                             onOpen={ () => console.log('open') }
                             onClose={ () => console.log('close') }>
                       <Button label="Open Dialog that generate events" />
                       <DialogOverlay compact>
                         <div>This is just a demo of a dialog</div>
                         <DialogActions>
                           <Button data-action="close" label="Close" />
                         </DialogActions>
                       </DialogOverlay>
                     </Dialog>

                     <Button style={ { marginLeft: 10 } } label="Open Dialog that generate events" onClick={ () => this.setState({ evtDialogOpen: true }) } />
                     <Dialog open={ this.state.evtDialogOpen }
                             onOpening={ () => console.log('opening') }
                             onClosing={ () => console.log('closing') }
                             onOpen={ () => console.log('open') }
                             onClose={ () => console.log('close') }
                             onCloseRequest={ () => this.setState({ evtDialogOpen: false }) }>
                       <DialogOverlay compact>
                         <div>This is just a demo of a dialog</div>
                         <DialogActions>
                           <Button data-action="close" label="Close" />
                         </DialogActions>
                       </DialogOverlay>
                     </Dialog>
                   `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Dialog
            onOpening={() => console.log('opening')}
            onClosing={() => console.log('closing')}
            onOpen={() => console.log('open')}
            onClose={() => console.log('close')}>
            <Button label="Open Dialog that generate events" />
            <DialogOverlay compact>
              <div>This is just a demo of a dialog</div>
              <DialogActions>
                <Button type="flat" data-action="close" label="Close" />
              </DialogActions>
            </DialogOverlay>
          </Dialog>

          <Button style={{ marginLeft: 10 }} label="Open Dialog that generate events" onClick={() => this.setState({ evtDialogOpen: true })} />
          <Dialog
            open={this.state.evtDialogOpen}
            onOpening={() => console.log('opening')}
            onClosing={() => console.log('closing')}
            onOpen={() => console.log('open')}
            onClose={() => console.log('close')}
            onCloseRequest={() => this.setState({ evtDialogOpen: false })}>
            <DialogOverlay compact>
              <div>This is just a demo of a dialog</div>
              <DialogActions>
                <Button type="flat" data-action="close" label="Close" />
              </DialogActions>
            </DialogOverlay>
          </Dialog>
        </DemoSection>
      </DemoPage>
    );
  }
}
