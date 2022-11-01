/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

module.exports = {
  parser: 'babel-eslint',
  settings: {
    'import/ignore': [/node_modules/, /cucumber\/config/, /\.(scss|less|css)$/],
  },
  plugins: ['react', 'import', 'jsx-a11y', 'mocha', 'red', 'prettier'],
  extends: ['eslint:recommended', 'airbnb', 'prettier', 'prettier/react'],
  rules: {
    'prettier/prettier': [
      2,
      {
        printWidth: 160,
        singleQuote: true,
        trailingComma: 'all',
        bracketSpacing: true,
        useTabs: false,
        semi: true,
        jsxBracketSameLine: true,
        arrowParens: 'avoid',
      },
    ],
    'arrow-parens': [2, 'as-needed'],
    'red/no-just-wait': 2,
    'red/no-driver': 2,
    'red/no-click': 2,
    'red/no-tc-click': 2,
    'red/no-find-element': 2,
    'red/no-lodash': 2,
    'red/dal-async': 2,
    'red/no-moment': 2,
    'mocha/no-exclusive-tests': 2,
    eqeqeq: [2, 'smart'],
    curly: 2,
    quotes: [2, 'single', 'avoid-escape'],
    strict: 0,
    'no-unused-expressions': 0,
    'no-underscore-dangle': 0,
    'no-spaced-func': 0,
    'func-names': 2,
    'no-shadow': 2,
    camelcase: [
      2,
      {
        // using an object to prevent having duplicates
        allow: Object.keys({
          updated_at: true,
          created_at: true,
          '^__reva_': true,
          __places_init: true,
          modified_by: true,
          load_testing: true,
          access_token: true,
          last_modified: true,
          from_email: true,
          from_name: true,
          first_name: true,
          last_name: true,
          newDecision_name: true,
          newAuth_token: true,
          decision_name: true,
          auth_token: true,
          symbol_native: true,
          decimal_digits: true,
          name_plural: true,
          street_number: true,
          postal_code: true,
          formatted_address: true,
          address_components: true,
          access_type: true,
          smart_invite: true,
          smart_invite_id: true,
          calendar_ids: true,
          entity_id: true,
          entity_type: true,
          visited_at: true,
          expiry_date: true,
          migrations_path: true,
          cdn_prefix: true,
          application_name: true,
          mri_s: true,
          mrs_api: true,
          socket_keepalive: true,
          enable_offline_queue: true,
          appt_category: true,
          team_ids: true,
          user_id: true,
          other_users: true,
          comm_id: true,
          calls_to_agents: true,
          person_ids: true,
          tenant_id: true,
          new_status: true,
          party_ids: true,
          event_names: true,
          authorization_token: true,
          is_locked: true,
          channel_id: true,
          redirect_uri: true,
          delegated_scope: true,
          client_id: true,
          client_secret: true,
          grant_type: true,
          callback_url: true,
          only_managed: true,
          permission_level: true,
          include_managed: true,
          next_page: true,
          include_deleted: true,
          include_free: true,
          sent_date: true,
          event_uid: true,
          event_id: true,
          include_ids: true,
          expires_in: true,
          response_type: true,
          free_busy_status: true,
          changes_since: true,
          refresh_token: true,
          refreshed_at: true,
          calendar_id: true,
          decoded_token: true,
          url_long: true,
          parsed_response: true,
          decode_row: true,
          decode_col: true,
          decode_range: true,
          encode_col: true,
          decode_cell: true,
          Security_Deposit_0: true,
          Due_Day: true,
          Phone_Number_4: true,
          Lease_Sign_Date: true,
          Lease_To_Date: true,
          Lease_From_Date: true,
          Move_In_Date: true,
          Last_Name: true,
          First_Name: true,
          Unit_Code: true,
          Ref_Prospect_Id: true,
          Prospect_Code: true,
          Ext_Ref_Tenant_Id: true,
          Tenant_Code: true,
          Property_Code: true,
          Roommate_Relationship: true,
          Roommate_Occupant: true,
          Roommate_Email: true,
          Roommate_FirstName: true,
          Roommate_LastName: true,
          Ext_Ref_Roommate_Id: true,
          Roommate_PhoneNumber1: true,
          Roommate_Code: true,
          Date_Denied: true,
          Date_Canceled: true,
          Date_Approved: true,
          Date_Applied: true,
          Date_Show: true,
          First_Contacted_On: true,
          UnitType_Code: true,
          Preferred_MoveIn: true,
          Preferred_Bath: true,
          Preferred_Bedrooms: true,
          Preferred_Rent: true,
          Canceled_Guest: true,
          To_Date: true,
          From_Date: true,
          Charge_Code: true,
          Table_Name: true,
          Entity_Record_Code: true,
          Field_Name1: true,
          Field_Value1: true,
          Field_Name2: true,
          Field_Value2: true,
          Field_Name3: true,
          Field_Value3: true,
          Field_Name4: true,
          Field_Value4: true,
          Field_Name5: true,
          Field_Value5: true,
          Field_Name6: true,
          Field_Value6: true,
          Field_Name7: true,
          Field_Value7: true,
          Field_Name8: true,
          Field_Value8: true,
          Field_Name9: true,
          Field_Value9: true,
          Field_Name10: true,
          Field_Value10: true,
          migration_time: true,
          token_id: true,
          party_id: true,
          team_id: true,
          profile_id: true,
          linking_profile: true,
          provider_name: true,
          profile_name: true,
          calendar_name: true,
          calendar_readonly: false,
          calendar_deleted: false,
          calendar_primary: true,
          RequestID_Returned: true,
          AS_Information: true,
          administrative_area_level_1: true,
          retry_strategy: true,
          credit_and_criminal: true,
          Close_Reason: true,
        }),
      },
    ],
    'new-cap': [
      2,
      {
        capIsNewExceptions: [
          'Then',
          'When',
          'Given',
          'AfterFeatures',
          'After',
          'BeforeFeatures',
          'Before',
          'BeforeFeature',
          'ClientFunction',
          'Selector',
          'RequestLogger',
        ],
      },
    ],
    'dot-notation': 2,
    'no-native-reassign': 1,
    'react/require-extension': 0,
    'no-new': 1,
    'no-confusing-arrow': [0, { allowParens: true }],
    'no-console': 0,
    'no-constant-condition': 1,
    'object-curly-spacing': 2,
    'consistent-return': 2,
    'jsx-quotes': 1,
    'newline-per-chained-call': 0,
    'no-extra-strict': 0,
    'no-alert': 2,
    'no-array-constructor': 2,
    'no-caller': 2,
    'no-catch-shadow': 2,
    'no-eval': 2,
    'no-extend-native': 2,
    'no-extra-bind': 2,
    'no-implied-eval': 2,
    'no-iterator': 2,
    'no-label-var': 2,
    'no-labels': 2,
    'no-lone-blocks': 2,
    'no-loop-func': 2,
    'no-multi-spaces': 0,
    'no-multi-str': 2,
    'no-new-func': 2,
    'no-new-object': 2,
    'no-new-wrappers': 2,
    'no-octal-escape': 2,
    'no-process-exit': 2,
    'no-proto': 2,
    'no-return-assign': ['error', 'except-parens'],
    'no-script-url': 2,
    'no-sequences': 2,
    'no-undef': 2,
    'no-shadow-restricted-names': 2,
    'no-trailing-spaces': 2,
    'quote-props': 2,
    'object-shorthand': 2,
    'prefer-arrow-callback': 2,
    'template-curly-spacing': 0,
    'no-undef-init': 2,
    'id-length': 0,
    'no-use-before-define': 2,
    'no-with': 2,
    'comma-spacing': 2,
    'eol-last': 2,
    'padded-blocks': 0,
    'no-extra-parens': [2, 'functions'],
    'key-spacing': [2, { beforeColon: false, afterColon: true }],
    'new-parens': 2,
    semi: 2,
    'semi-spacing': [2, { before: false, after: true }],
    'space-infix-ops': 2,
    'keyword-spacing': 2,
    'space-unary-ops': [2, { words: true, nonwords: false }],
    yoda: [2, 'never'],
    indent: 0,
    'vars-on-top': 0,
    'max-len': 0,
    'no-param-reassign': 0,
    'arrow-body-style': 2,
    'brace-style': 2,
    'prefer-template': 2,
    'computed-property-spacing': 1,
    'space-in-parens': 1,
    'no-useless-constructor': 2,
    'prefer-rest-params': 2,
    'array-bracket-spacing': 1,
    'no-case-declarations': 2,
    'array-callback-return': 2,
    'global-require': 0,
    'no-useless-escape': 2,
    'no-duplicate-imports': [2, { includeExports: true }],
    'import/no-duplicates': [0, { commonjs: true }],
    'import/no-unresolved': [0, { commonjs: true }],
    'import/export': 1,
    'jsx-a11y/img-has-alt': 0,
    'react/jsx-equals-spacing': [1, 'never'],
    'react/display-name': 0,
    'react/jsx-no-undef': 1,
    'react/jsx-no-bind': 2,
    'react/jsx-curly-spacing': [0, 'always'],
    'react/jsx-first-prop-new-line': [0, 'never'],
    'react/jsx-indent': [0, 2],
    'react/jsx-boolean-value': 0,
    'react/jsx-sort-prop-types': 0,
    'react/jsx-sort-props': 0,
    'react/jsx-uses-react': 1,
    'react/jsx-uses-vars': 1,
    'react/no-did-mount-set-state': 1,
    'react/no-did-update-set-state': 1,
    'react/jsx-closing-bracket-location': 0,
    'react/jsx-tag-spacing': [2, { beforeSelfClosing: 'always' }],
    'react/no-multi-comp': 0,
    'react/no-unknown-property': 1,
    'react/prop-types': 0,
    'react/react-in-jsx-scope': 1,
    'react/self-closing-comp': 2,
    'react/sort-comp': 0,
    'react/wrap-multilines': 0,
    'react/jsx-indent-props': 0,
    'react/prefer-stateless-function': 0,
    'generator-star-spacing': 0,

    // see CPM-2410
    'import/no-extraneous-dependencies': 0,
    'linebreak-style': 2,
    'import/imports-first': 0,
    'react/no-string-refs': 0,
    'react/jsx-filename-extension': 0,
    'react/jsx-wrap-multilines': 0,
    'no-mixed-operators': 0,
    'import/prefer-default-export': 0,
    'import/newline-after-import': 0,
    'require-yield': 1,
    'no-extra-boolean-cast': 2,
    'no-continue': 2,
    'object-property-newline': 1,
    'no-prototype-builtins': 2,
    'react/no-find-dom-node': 1,
    'no-lonely-if': 2,
    'dot-location': 2,
    'import/no-named-as-default': 1,
    'prefer-spread': 1,
    'react/no-array-index-key': 2,
    'react/jsx-no-duplicate-props': 2,
    'react/no-children-prop': 2,
    'react/style-prop-object': 2,
    'no-restricted-syntax': [2, 'WithStatement'],
    'no-unused-vars': [2, { vars: 'all', args: 'after-used', varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'no-template-curly-in-string': 2,
    'no-bitwise': 2,
    'valid-typeof': 2,
    'jsx-a11y/anchor-has-content': 2,
    'comma-dangle': [2, 'always-multiline'],

    // consider enabling there rules
    'import/first': 0,
    'import/extensions': 0,
    'react/require-default-props': 0,
    'react/forbid-prop-types': 0,
    'react/no-unused-prop-types': 0,
    'no-return-await': 0,
    'no-plusplus': 0,
    'no-tabs': 0,
    'class-methods-use-this': 0,
    'no-await-in-loop': 0,
    'react/no-unescaped-entities': 0,
    'jsx-a11y/no-static-element-interactions': 0,
    'import/no-dynamic-require': 0,
    'space-before-function-paren': 0,
    'func-call-spacing': 0,
    'lines-around-directive': 0,
    'no-multi-assign': 0,
    'no-useless-return': 0,
    'react/no-danger': 0,
    // we should consider to enable this one to avoid cases
    // where async keyword is used but no await is present
    // in the body of the function
    'require-await': 0,
    'react/jsx-one-expression-per-line': 0,
    'react/destructuring-assignment': 0,
    'import/order': 1,
    'import/named': 2,
    'import/no-cycle': 1,
    'react/jsx-curly-brace-presence': 0,
    'react/jsx-no-comment-textnodes': 0,
    'import/no-useless-path-segments': 1,
    'jsx-a11y/click-events-have-key-events': 0,
    'react/no-access-state-in-setstate': 1,
    'react/no-unused-state': 1,
    'react/default-props-match-prop-types': 1,
    'jsx-a11y/alt-text': 1,
    'react/no-this-in-sfc': 1,
    'jsx-a11y/label-has-for': 0, // this rule is deprecated https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/label-has-for.md
    'jsx-a11y/anchor-is-valid': 1,
    'react/no-typos': 2,
    'react/no-deprecated': 1,
    'react/button-has-type': 2,
    'jsx-a11y/no-noninteractive-element-interactions': 1,
    'jsx-a11y/iframe-has-title': 1,
    'jsx-a11y/no-noninteractive-tabindex': 0,
    'jsx-a11y/media-has-caption': 1,
    'jsx-a11y/no-redundant-roles': 1,
    'prefer-destructuring': 0,
    'lines-between-class-members': 1,
    'spaced-comment': 1,
    'no-restricted-globals': 1,
    'no-else-return': 1,
    'prefer-promise-reject-errors': 1,
    'no-buffer-constructor': 1,
    'prefer-const': [
      'error',
      {
        destructuring: 'all',
        ignoreReadBeforeAssign: true,
      },
    ],
    'no-self-compare': 2,
    'no-control-regex': 1,
    'no-dupe-keys': 2,
    'guard-for-in': 2,
    'react/static-property-placement': 0,

    // these rules should be enabled progressively
    'react/jsx-props-no-spreading': 0,
    'no-misleading-character-class': 1,
    'operator-assignment': 1,
    'jsx-a11y/control-has-associated-label': 0,
    'max-classes-per-file': [1, 3],
    'no-useless-catch': 1,
    'react/state-in-constructor': 0,
    'prefer-object-spread': 1,
    'no-async-promise-executor': 1,
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    jest: true,
    node: true,
    mocha: true,
  },
  parserOptions: {
    ecmaVersion: 7,
    sourceType: 'module',
    impliedStrict: true,
    typescript: true,
    ecmaFeatures: {
      jsx: true,
      legacyDecorators: true,
    },
  },
  globals: {
    __MOBX_DEVTOOLS__: true,
    __DEVTOOLS__: true,
    socket: true,
    jest: true,
    expect: true,
    fixture: true,
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        warnOnUnsupportedTypeScriptVersion: true,
      },
      plugins: ['@typescript-eslint'],
      rules: {
        'default-case': 'off',
        // 'tsc' already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/291)
        'no-dupe-class-members': 'off',

        // Add TypeScript specific rules (and turn off ESLint equivalents)
        '@typescript-eslint/consistent-type-assertions': 'error',
        'no-array-constructor': 'off',
        '@typescript-eslint/no-array-constructor': 'error',
        '@typescript-eslint/no-namespace': 'error',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': [
          'error',
          {
            functions: false,
            classes: false,
            variables: false,
            typedefs: false,
          },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            args: 'none',
            ignoreRestSiblings: true,
          },
        ],
        'no-useless-constructor': 'off',
        '@typescript-eslint/no-useless-constructor': 'error',
      },
    },
  ],
};