import { RuleTester } from 'eslint';

import noUnassociatedFieldLabel from '../rules/no-unassociated-field-label.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const ruleTester = new RuleTester();

const error = (parent = 'Field') => ({
  message: `The child of <${parent} label="..."> must have an \`id\` or \`inputId\` prop, or <${parent}> must have an \`htmlFor\` prop.`,
});

ruleTester.run('no-unassociated-field-label', noUnassociatedFieldLabel, {
  valid: [
    {
      name: 'Field with htmlFor',
      code: `<Field label="Name" htmlFor="name"><Input /></Field>`,
    },
    {
      name: 'Field with child id',
      code: `<Field label="Name"><Input id="name" /></Field>`,
    },
    {
      name: 'Field with child inputId',
      code: `<Field label="Timezone"><TimeZonePicker inputId="tz" /></Field>`,
    },
    {
      name: 'Field with RadioButtonGroup child is exempt',
      code: `<Field label="Mode"><RadioButtonGroup options={[]} /></Field>`,
    },
    {
      name: 'Field with non-string label is skipped',
      code: `<Field label={<Label>x</Label>}><Input /></Field>`,
    },
    {
      name: 'Field with no label is skipped',
      code: `<Field><Input /></Field>`,
    },
    {
      name: 'Field with identifier child is skipped',
      code: `<Field label="Name">{input}</Field>`,
    },
    {
      name: 'Field with spread props on child is skipped',
      code: `<Field label="Name"><Input {...rest} /></Field>`,
    },
    {
      name: 'Field with fragment child is skipped',
      code: `<Field label="Name"><><Input /><Extra /></></Field>`,
    },
    {
      name: 'Field with mapped array child is skipped',
      code: `<Field label="Name">{items.map(i => <Input key={i} />)}</Field>`,
    },
    {
      name: 'Conditional child, both branches have id',
      code: `<Field label="Name">{cond ? <Input id="a" /> : <Select inputId="b" />}</Field>`,
    },
    {
      name: 'InlineField with child id',
      code: `<InlineField label="Name"><Input id="name" /></InlineField>`,
    },
    {
      name: 'InlineField with htmlFor',
      code: `<InlineField label="Name" htmlFor="name"><Input /></InlineField>`,
    },
    {
      name: 'InlineField with RadioButtonGroup is exempt',
      code: `<InlineField label="Mode"><RadioButtonGroup options={[]} /></InlineField>`,
    },
    {
      name: 'Label in template literal with no interpolations is treated as string — still valid when id is present',
      code: '<Field label={`Name`}><Input id="name" /></Field>',
    },
    {
      name: 'Label as t() call with id on child',
      code: `<Field label={t('key', 'Default')}><Input id="name" /></Field>`,
    },
    {
      name: 'Label as t() call with RadioButtonGroup child is exempt',
      code: `<Field label={t('key', 'Default')}><RadioButtonGroup options={[]} /></Field>`,
    },
    {
      name: 'Label as template with interpolation and id on child',
      code: '<Field label={`x ${value} y`}><Input id="name" /></Field>',
    },
    {
      name: 'Label as bare identifier is not in the allow-list, rule skips',
      code: `<Field label={name}><Input /></Field>`,
    },
    {
      name: 'Label as member expression is not in the allow-list, rule skips',
      code: `<Field label={props.label}><Input /></Field>`,
    },
    {
      name: 'Label as non-t function call is not in the allow-list, rule skips',
      code: `<Field label={renderLabel()}><Input /></Field>`,
    },
    {
      name: 'Label as binary expression is not in the allow-list, rule skips',
      code: `<Field label={prefix + ' suffix'}><Input /></Field>`,
    },
    {
      name: 'Non-Field component is ignored',
      code: `<SomethingElse label="Name"><Input /></SomethingElse>`,
    },
  ],
  invalid: [
    {
      name: 'Field with string label, no htmlFor, child has no id',
      code: `<Field label="Name"><Input /></Field>`,
      errors: [error('Field')],
    },
    {
      name: 'Field with string label, Select child missing inputId',
      code: `<Field label="Name"><Select /></Field>`,
      errors: [error('Field')],
    },
    {
      name: 'Field with template-literal string label, no id',
      code: '<Field label={`Name`}><Input /></Field>',
      errors: [error('Field')],
    },
    {
      name: 'Field with string expression label, no id',
      code: `<Field label={"Name"}><Input /></Field>`,
      errors: [error('Field')],
    },
    {
      name: 'InlineField with string label, no id',
      code: `<InlineField label="Name"><Input /></InlineField>`,
      errors: [error('InlineField')],
    },
    {
      name: 'Conditional child, one branch missing id',
      code: `<Field label="Name">{cond ? <Input id="a" /> : <Select />}</Field>`,
      errors: [error('Field')],
    },
    {
      name: 'Conditional child, both branches missing id',
      code: `<Field label="Name">{cond ? <Input /> : <Select />}</Field>`,
      errors: [error('Field'), error('Field')],
    },
    {
      name: 'id attribute without a value is not enough',
      code: `<Field label="Name"><Input id /></Field>`,
      errors: [error('Field')],
    },
    {
      name: 'Field with t() label, child has no id',
      code: `<Field label={t('key', 'Default')}><Input /></Field>`,
      errors: [error('Field')],
    },
    {
      name: 'InlineField with t() label, child has no inputId',
      code: `<InlineField label={t('key', 'Default')}><Select /></InlineField>`,
      errors: [error('InlineField')],
    },
    {
      name: 'Template literal with interpolation label, no id',
      code: '<Field label={`x ${v}`}><Input /></Field>',
      errors: [error('Field')],
    },
  ],
});
