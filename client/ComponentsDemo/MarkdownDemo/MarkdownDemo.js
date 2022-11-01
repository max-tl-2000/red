/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Markdown, FormattedMarkdown } from 'components';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class MarkdownDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="Markdown">
        <DemoSection title="Simple markdown block">
          <Markdown className="md-content">
            {'This is used to render a simple markdown string. **Important**: use `backticks` to render multiline content (`)'}
          </Markdown>

          <PrettyPrint className="javascript">
            {`
                   <Markdown>
                   {
                    \`
                    Some **markdown** __content__ here <br />
                    over multiple lines as well\`
                   }
                  </Markdown>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Markdown>
            {`
                  Some **markdown** __content__ here <br />
                  over multiple lines as well`}
          </Markdown>
        </DemoSection>

        <DemoSection title="FormattedMarkdown">
          <MDBlock>{`\`FormattedMarkdown\` is a wrapper over the generic Markdown using styles that use the
                   typography mixins.
                  `}</MDBlock>
          <PrettyPrint>
            {`
                    <FormattedMarkdown>{ \`
                      # Title Level 1
                      ## Title level 2
                      ### Title Level 3
                      #### Title Level 4
                      ##### Title Level 5

                      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      Nam ornare urna eget sem consequat semper. Vestibulum
                      dignissim pharetra viverra. Curabitur vel imperdiet justo.
                      Pellentesque habitant morbi tristique senectus et netus et
                      malesuada fames ac turpis egestas. Fusce laoreet urna et
                      porta ultricies. Nulla mollis libero elit, quis blandit
                      risus luctus in. Nam nec enim sit amet felis ultrices
                      sollicitudin. Etiam sed laoreet justo.

                      Nam placerat **consectetur sagittis**. _Integer sodales leo nunc_,
                      in tristique est varius eu. Nulla pellentesque fringilla neque,
                      vitae sagittis mauris posuere vel. Donec semper, tortor vitae
                      feugiat egestas, arcu ex accumsan enim, vitae lacinia risus
                      libero vel lorem. Maecenas sed sem sem. Vivamus porta nunc
                      felis, in lobortis metus pulvinar dictum. Sed vestibulum
                      convallis massa, nec congue velit vestibulum eget.

                      - Vivamus nulla leo, pretium ut ex nec,
                      - consequat dapibus ipsum.
                      - Phasellus scelerisque vulputate nulla,
                      - sed mollis odio eleifend vel. Nullam efficitur imperdiet lobortis.

                      \` }</FormattedMarkdown>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <FormattedMarkdown>{`
                  # Title Level 1
                  ## Title level 2
                  ### Title Level 3
                  #### Title Level 4
                  ##### Title Level 5

                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Nam ornare urna eget sem consequat semper. Vestibulum
                  dignissim pharetra viverra. Curabitur vel imperdiet justo.
                  Pellentesque habitant morbi tristique senectus et netus et
                  malesuada fames ac turpis egestas. Fusce laoreet urna et
                  porta ultricies. Nulla mollis libero elit, quis blandit
                  risus luctus in. Nam nec enim sit amet felis ultrices
                  sollicitudin. Etiam sed laoreet justo.

                  Nam placerat **consectetur sagittis**. _Integer sodales leo nunc_,
                  in tristique est varius eu. Nulla pellentesque fringilla neque,
                  vitae sagittis mauris posuere vel. Donec semper, tortor vitae
                  feugiat egestas, arcu ex accumsan enim, vitae lacinia risus
                  libero vel lorem. Maecenas sed sem sem. Vivamus porta nunc
                  felis, in lobortis metus pulvinar dictum. Sed vestibulum
                  convallis massa, nec congue velit vestibulum eget.

                  - Vivamus nulla leo, pretium ut ex nec,
                  - consequat dapibus ipsum.
                  - Phasellus scelerisque vulputate nulla,
                  - sed mollis odio eleifend vel. Nullam efficitur imperdiet lobortis.

                  `}</FormattedMarkdown>
        </DemoSection>
      </DemoPage>
    );
  }
}
