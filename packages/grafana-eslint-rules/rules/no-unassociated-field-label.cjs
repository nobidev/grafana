// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * @typedef {import('@typescript-eslint/utils').TSESTree.JSXElement} JSXElement
 * @typedef {import('@typescript-eslint/utils').TSESTree.JSXAttribute} JSXAttribute
 * @typedef {import('@typescript-eslint/utils').TSESTree.JSXOpeningElement} JSXOpeningElement
 */

const TARGET_COMPONENTS = new Set(['Field', 'InlineField']);
const EXEMPT_CHILDREN = new Set(['RadioButtonGroup']);
const ID_ATTRIBUTES = new Set(['id', 'inputId']);

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

const rule = createRule({
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (opening.name.type !== 'JSXIdentifier' || !TARGET_COMPONENTS.has(opening.name.name)) {
          return;
        }

        if (!hasStringLabel(opening)) {
          return;
        }

        if (findAttribute(opening, 'htmlFor')) {
          return;
        }

        const child = getSingleJSXChild(node);
        if (!child) {
          return;
        }

        if (child.type === 'ConditionalExpression') {
          if (child.consequent.type === 'JSXElement') {
            checkChildJSX(context, child.consequent);
          }
          if (child.alternate.type === 'JSXElement') {
            checkChildJSX(context, child.alternate);
          }
          return;
        }

        checkChildJSX(context, child);
      },
    };
  },

  name: 'no-unassociated-field-label',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require <Field>/<InlineField> with a string label to be associated with an input via htmlFor, or id/inputId on the direct child',
    },
    messages: {
      missingAssociation:
        'The child of <{{parent}} label="..."> must have an `id` or `inputId` prop, or <{{parent}}> must have an `htmlFor` prop.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = rule;

/**
 * @param {JSXOpeningElement} opening
 * @param {string} name
 * @returns {JSXAttribute | undefined}
 */
function findAttribute(opening, name) {
  return /** @type {JSXAttribute | undefined} */ (
    opening.attributes.find(
      (attr) => attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier' && attr.name.name === name
    )
  );
}

/**
 * Recognises a runtime string label via a syntactic allow-list: string literals, template
 * literals, and `t(...)` i18n calls. The repo deliberately avoids typed linting, so a general
 * "any string-returning expression" check isn't feasible; bare identifiers / non-t calls are
 * skipped rather than guessed at.
 * @param {JSXOpeningElement} opening
 */
function hasStringLabel(opening) {
  const labelAttr = findAttribute(opening, 'label');
  if (!labelAttr) {
    return false;
  }

  const value = labelAttr.value;
  if (!value) {
    return false;
  }

  if (value.type === 'Literal') {
    return typeof value.value === 'string';
  }

  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;
    if (expr.type === 'Literal') {
      return typeof expr.value === 'string';
    }
    if (expr.type === 'TemplateLiteral') {
      return true;
    }
    // Match `t()` by callee name so any local binding/alias is covered without resolving imports.
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier' && expr.callee.name === 't') {
      return true;
    }
  }

  return false;
}

/**
 * Returns the child to inspect, or undefined if the child shape isn't one the rule handles.
 * Whitespace-only JSXText nodes are ignored.
 * @param {JSXElement} node
 */
function getSingleJSXChild(node) {
  const meaningful = node.children.filter((c) => !(c.type === 'JSXText' && /^\s*$/.test(c.value)));

  if (meaningful.length !== 1) {
    return undefined;
  }

  const only = meaningful[0];

  if (only.type === 'JSXElement') {
    return only;
  }

  if (only.type === 'JSXExpressionContainer') {
    const expr = only.expression;
    if (expr.type === 'JSXElement' || expr.type === 'ConditionalExpression') {
      return expr;
    }
  }

  return undefined;
}

/**
 * @param {import('@typescript-eslint/utils').TSESLint.RuleContext<'missingAssociation', []>} context
 * @param {JSXElement} child
 */
function checkChildJSX(context, child) {
  const opening = child.openingElement;
  if (opening.name.type !== 'JSXIdentifier') {
    return;
  }

  if (EXEMPT_CHILDREN.has(opening.name.name)) {
    return;
  }

  for (const attr of opening.attributes) {
    if (attr.type === 'JSXSpreadAttribute') {
      return;
    }
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      ID_ATTRIBUTES.has(attr.name.name) &&
      attr.value != null
    ) {
      return;
    }
  }

  // Walk up to the nearest Field / InlineField parent to report the component name.
  /** @type {string} */
  let parentName = 'Field';
  /** @type {import('@typescript-eslint/utils').TSESTree.Node | undefined} */
  let cursor = child.parent;
  while (cursor) {
    if (cursor.type === 'JSXElement') {
      const name = cursor.openingElement.name;
      if (name.type === 'JSXIdentifier' && TARGET_COMPONENTS.has(name.name)) {
        parentName = name.name;
        break;
      }
    }
    cursor = cursor.parent;
  }

  context.report({
    node: child,
    messageId: 'missingAssociation',
    data: { parent: parentName },
  });
}
