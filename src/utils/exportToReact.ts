import { DesignNode } from '../store/designStore';

export function exportToReact(nodes: Record<string, DesignNode>, rootId: string = 'root'): string {
  const node = nodes[rootId];
  if (!node) return '';

  const isRoot = rootId === 'root';
  const componentName = isRoot ? 'MyPluginUI' : '';

  const renderProps = (props: Record<string, any>) => {
    return Object.keys(props)
      .filter((k) => k !== 'name' && k !== 'text' && k !== 'value')
      .map((k) => `${k}="${props[k]}"`)
      .join(' ');
  };

  const renderStyle = (style: React.CSSProperties) => {
    const styleObj = Object.entries(style)
      .map(([k, v]) => `${k}: '${v}'`)
      .join(', ');
    return styleObj ? ` style={{ ${styleObj} }}` : '';
  };

  const renderChildren = (childrenIds: string[]) => {
    return childrenIds.map((id) => exportToReact(nodes, id)).join('\n');
  };

  let elementStr = '';

  if (node.type === 'Text') {
    elementStr = `<div${renderStyle(node.style)}>\n  ${node.props.text}\n</div>`;
  } else if (node.type === 'Button') {
    elementStr = `<button${renderStyle(node.style)}>\n  ${node.props.text}\n</button>`;
  } else if (node.type === 'Knob') {
    // simplified Knob component representation
    elementStr = `<div${renderStyle(node.style)}>\n  {/* Knob value: ${node.props.value} */}\n</div>`;
  } else if (node.type === 'Image') {
    elementStr = `<img src="${node.props.src || ''}"${renderStyle(node.style)} />`;
  } else {
    // Frame
    elementStr = `<div${renderStyle(node.style)}>\n${renderChildren(node.children)}\n</div>`;
  }

  if (isRoot) {
    return `import React from 'react';\n\nexport default function ${componentName}() {\n  return (\n${elementStr.split('\n').map(l => '    ' + l).join('\n')}\n  );\n}\n`;
  }

  return elementStr;
}
