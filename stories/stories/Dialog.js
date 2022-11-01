/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import { MsgBox, Button, Typography as T, FormattedMarkdown as TextBlock } from 'components';
import { observer, Observer } from 'mobx-react';
import Block from '../helpers/Block';

import DialogModel from '../../client/containers/PartyPageUnified/DialogModel';
import { now } from '../../common/helpers/moment-utils';

@observer
class Wrapper extends Component {
  constructor(props) {
    super(props);
    this.model = new DialogModel();
    this.model2 = new DialogModel();
    this.model3 = new DialogModel();
  }

  renderContent = () => (
    <div>
      {`Current time: ${now().format()}`}
      <div id="lipsum">
        <T.Text>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam non mollis enim. Vivamus nulla tellus, dictum eu mattis non, convallis id lacus.
          Nullam a interdum tellus. Vestibulum in risus quis nunc consectetur hendrerit in nec justo. Ut facilisis metus in lacus tempor imperdiet. Donec
          blandit est et dapibus consequat. Sed sed justo eget orci cursus tristique dictum at nisl. Vestibulum sagittis sit amet nulla non auctor. Sed
          malesuada nunc ut magna accumsan, ut sagittis dui porttitor. Aliquam erat volutpat. In auctor ipsum tristique pharetra molestie. Aliquam nec ante
          viverra, scelerisque turpis eu, vehicula ex. Donec sollicitudin auctor nibh, sit amet accumsan lectus.
        </T.Text>
        <T.Text>
          Ut erat lacus, bibendum vel ante eu, lobortis tristique sem. Phasellus pellentesque odio orci, non bibendum nisl vestibulum in. Nulla odio leo,
          scelerisque nec dui dapibus, rutrum pellentesque est. Morbi at risus sed nulla eleifend efficitur vel in nibh. Suspendisse potenti. In est est,
          pretium in vestibulum vitae, tempor id ligula. Praesent malesuada non turpis a mattis. Nunc a feugiat metus, eget tempus neque. Vivamus augue quam,
          mattis in sagittis cursus, venenatis a dolor. Etiam scelerisque sem sed tempus varius. Curabitur eleifend nec ligula id bibendum. Sed nulla ipsum,
          tincidunt non fermentum ac, facilisis eu nulla. Nunc hendrerit condimentum congue. Aenean et semper nisl, et facilisis orci. Maecenas quam urna,
          aliquet sit amet feugiat et, dapibus et nisl.
        </T.Text>
        <T.Text>
          Praesent erat arcu, luctus auctor leo vel, tempor cursus neque. Nulla scelerisque, nibh ut dapibus aliquet, libero lectus convallis augue, ac aliquet
          enim sem sed arcu. Cras elit tortor, viverra in diam a, pulvinar tincidunt nunc. Donec imperdiet mattis ligula, ultricies bibendum nunc faucibus eu.
          Aliquam erat urna, laoreet in ante nec, rutrum porttitor augue. Praesent suscipit, libero at pellentesque dapibus, nisi nisl tincidunt libero, nec
          pharetra libero risus at urna. Donec vel rutrum odio. Pellentesque ut erat ac neque dapibus porta eget et arcu. Nam vitae dui non dolor aliquam
          mollis. In suscipit quis est a condimentum. Etiam vulputate viverra lorem, aliquet tristique neque accumsan et. Cras pulvinar justo enim, fringilla
          tempus nisl efficitur ut.
        </T.Text>
        <T.Text>
          Maecenas iaculis vel eros et sodales. Aenean mattis mi et faucibus consectetur. Orci varius natoque penatibus et magnis dis parturient montes,
          nascetur ridiculus mus. Quisque ullamcorper imperdiet mi, nec porta risus. Maecenas facilisis dignissim vulputate. Vestibulum id fermentum sem, vel
          semper nibh. Quisque nibh purus, dapibus sit amet leo ut, malesuada gravida eros. Sed tellus tellus, sollicitudin et suscipit vel, euismod nec mi.
          Suspendisse commodo eros sit amet massa consequat vulputate. Fusce eu accumsan eros.
        </T.Text>
        <T.Text>
          Etiam id erat commodo, porttitor augue in, fringilla neque. Sed ultrices molestie ante, et tempus sapien. Duis sit amet odio diam. Donec vulputate
          accumsan sodales. Curabitur consectetur dolor ut nulla scelerisque malesuada. Aliquam molestie dolor et iaculis interdum. Duis congue, urna eu
          pulvinar pellentesque, mi justo consectetur odio, a hendrerit ipsum nulla nec nisi. Sed nec eros suscipit, consectetur nulla non, laoreet elit. Nulla
          pretium feugiat erat nec fringilla. Sed facilisis commodo urna, porta bibendum tellus cursus nec. Fusce vitae ultricies ante, euismod finibus turpis.
        </T.Text>
      </div>
    </div>
  );

  render() {
    const { model, model2, model3 } = this;

    return (
      <div style={{ padding: '25px 0 50px' }}>
        <T.SubHeader>
          {'Last time this was rendered: '}
          <T.SubHeader inline bold>
            {now().format()}
          </T.SubHeader>
        </T.SubHeader>
        <Button label="Open Dialog" onClick={model.open} />
        <Observer>{() => <MsgBox onCloseRequest={model.close} title="Some Message" content={this.renderContent()} open={model.isOpen} />}</Observer>

        <Button label="Open Dialog" onClick={model2.open} />
        <Observer>{() => <MsgBox onCloseRequest={model2.close} title="Some Message" content={'Smaller Dialog'} open={model2.isOpen} />}</Observer>

        <Button label="Open Dialog" onClick={model3.open} />
        <Observer>
          {() => <MsgBox onCloseRequest={model3.close} title="FullScreen" type="fullscreen" content={this.renderContent()} open={model3.isOpen} />}
        </Observer>
      </div>
    );
  }
}

storiesOf('Dialog', module).add('Dialog with max height', () => (
  <Block>
    <T.FormattedBlock>
      <T.Title>Dialog</T.Title>
      <div style={{ marginBottom: '30px' }}>
        <TextBlock>
          {`
            In order to render a Dialog we can use the MsgBox Component which makes it very simple to create Dialogs
          `}
        </TextBlock>
      </div>
      <Wrapper />
    </T.FormattedBlock>
  </Block>
));
