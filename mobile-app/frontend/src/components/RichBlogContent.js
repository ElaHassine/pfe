import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Type, Space, Radius } from '../theme';

export function RichBlogContent({ content = '', color = Colors.primary }) {
  if (!content) {
    return (
      <Text style={styles.bodyText}>No content available for this blog yet.</Text>
    );
  }

  let contentStr = String(content).trim();
  // Remove literal markdown bold markers (**) left in content so they don't render raw
  contentStr = contentStr.replace(/\*\*/g, '');
  if (!contentStr) {
    return (
      <Text style={styles.bodyText}>No content available for this blog yet.</Text>
    );
  }

  // Parse content into blocks (paragraphs, headings, lists, blockquotes, code blocks)
  const blocks = parseContentIntoBlocks(contentStr);

  return (
    <View>
      {blocks.map((block, idx) => (
        <ContentBlock
          key={idx}
          block={block}
          accentColor={color}
        />
      ))}
    </View>
  );
}

function parseContentIntoBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = null;
  let listItems = [];
  let codeLines = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        blocks.push({
          type: 'code',
          content: codeLines.join('\n'),
        });
        codeLines = [];
        inCodeBlock = false;
      } else {
        // Start code block
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        if (listItems.length > 0) {
          blocks.push({ type: 'list', items: listItems });
          listItems = [];
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Skip empty lines
    if (!trimmed) {
      if (currentBlock && currentBlock.type === 'paragraph') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems });
        listItems = [];
      }
      continue;
    }

    // Handle headings
    if (trimmed.startsWith('###')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({
        type: 'heading3',
        content: trimmed.replace(/^#+\s*/, '').trim(),
      });
      continue;
    }
    if (trimmed.startsWith('##')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({
        type: 'heading2',
        content: trimmed.replace(/^#+\s*/, '').trim(),
      });
      continue;
    }
    if (trimmed.startsWith('#')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({
        type: 'heading1',
        content: trimmed.replace(/^#+\s*/, '').trim(),
      });
      continue;
    }

    // Handle blockquotes
    if (trimmed.startsWith('>')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({
        type: 'blockquote',
        content: trimmed.replace(/^>\s*/, '').trim(),
      });
      continue;
    }

    // Handle list items
    if (trimmed.match(/^[\*\-\•]\s+/)) {
      const itemContent = trimmed.replace(/^[\*\-\•]\s+/, '').trim();
      listItems.push(itemContent);
      continue;
    }

    // Regular paragraph
    if (listItems.length > 0) {
      blocks.push({ type: 'list', items: listItems });
      listItems = [];
    }

    if (!currentBlock) {
      currentBlock = { type: 'paragraph', content: line };
    } else {
      currentBlock.content += ' ' + line;
    }
  }

  // Push remaining blocks
  if (currentBlock) blocks.push(currentBlock);
  if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });

  return blocks;
}

function ContentBlock({ block, accentColor }) {
  switch (block.type) {
    case 'heading1':
      return (
        <View style={styles.heading1Wrapper}>
          <Text style={styles.heading1}>{block.content}</Text>
          <View style={[styles.headingUnderline, { backgroundColor: accentColor }]} />
        </View>
      );
    case 'heading2':
      return (
        <View style={styles.heading2Wrapper}>
          <Text style={styles.heading2}>{block.content}</Text>
        </View>
      );
    case 'heading3':
      return (
        <Text style={[styles.heading3, { color: accentColor }]}>{block.content}</Text>
      );
    case 'blockquote':
      return (
        <View style={[styles.blockquoteWrapper, { borderLeftColor: accentColor }]}>
          <Text style={styles.blockquoteText}>{block.content}</Text>
        </View>
      );
    case 'code':
      return (
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>{block.content}</Text>
        </View>
      );
    case 'list':
      return (
        <View style={styles.listWrapper}>
          {block.items.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <View style={[styles.listBullet, { backgroundColor: accentColor }]} />
              <Text style={styles.listItemText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'paragraph':
    default:
      return (
        <Text style={styles.bodyText}>{block.content}</Text>
      );
  }
}

const styles = StyleSheet.create({
  bodyText: {
    ...Type.b2,
    color: Colors.grey700,
    lineHeight: 24,
    marginBottom: Space.s16,
  },
  heading1Wrapper: {
    marginBottom: Space.s20,
    marginTop: Space.s24,
  },
  heading1: {
    ...Type.d1,
    color: Colors.textOnLight,
    fontWeight: '700',
    marginBottom: Space.s8,
    lineHeight: 36,
  },
  headingUnderline: {
    height: 3,
    width: 60,
    borderRadius: 1.5,
    marginTop: Space.s8,
  },
  heading2Wrapper: {
    marginBottom: Space.s16,
    marginTop: Space.s20,
  },
  heading2: {
    ...Type.l1,
    color: Colors.textOnLight,
    fontWeight: '700',
    lineHeight: 28,
  },
  heading3: {
    ...Type.b1,
    fontWeight: '600',
    marginBottom: Space.s12,
    marginTop: Space.s12,
    lineHeight: 22,
  },
  blockquoteWrapper: {
    borderLeftWidth: 4,
    paddingLeft: Space.s12,
    marginVertical: Space.s12,
    paddingVertical: Space.s4,
    backgroundColor: Colors.grey50,
    paddingHorizontal: Space.s12,
    borderRadius: Radius.md,
  },
  blockquoteText: {
    ...Type.b2,
    color: Colors.grey700,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  codeBlock: {
    backgroundColor: Colors.grey900,
    padding: Space.s12,
    borderRadius: Radius.md,
    marginVertical: Space.s12,
    overflow: 'hidden',
  },
  codeText: {
    ...Type.mono,
    color: '#E0E0E0',
    lineHeight: 20,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  listWrapper: {
    marginVertical: Space.s12,
    paddingLeft: Space.s8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Space.s10,
  },
  listBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: Space.s8,
    marginRight: Space.s12,
    flexShrink: 0,
  },
  listItemText: {
    ...Type.b2,
    color: Colors.grey700,
    lineHeight: 22,
    flex: 1,
  },
});
