import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function RichBlogContentPreview({ content = '', maxLines = 3, color = '#00C2B2' }) {
  if (!content) {
    return (
      <Text numberOfLines={maxLines} style={styles.bodyText}>
        No content available.
      </Text>
    );
  }

  const contentStr = String(content).trim();
  if (!contentStr) {
    return (
      <Text numberOfLines={maxLines} style={styles.bodyText}>
        No content available.
      </Text>
    );
  }

  const firstParagraph = contentStr.split('\n')[0] || contentStr;

  return (
    <Text numberOfLines={maxLines} style={styles.bodyText}>
      {firstParagraph}
    </Text>
  );
}

export function RichBlogContentFull({ content = '', color = '#00C2B2' }) {
  if (!content) {
    return <Text style={styles.bodyText}>No content available for this blog yet.</Text>;
  }

  const contentStr = String(content).trim();
  if (!contentStr) {
    return <Text style={styles.bodyText}>No content available for this blog yet.</Text>;
  }

  const blocks = parseContentIntoBlocks(contentStr);

  return (
    <View>
      {blocks.map((block, idx) => (
        <ContentBlock key={idx} block={block} accentColor={color} />
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

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', content: codeLines.join('\n') });
        codeLines = [];
        inCodeBlock = false;
      } else {
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

    if (trimmed.startsWith('###')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({ type: 'heading3', content: trimmed.replace(/^#+\s*/, '').trim() });
      continue;
    }
    if (trimmed.startsWith('##')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({ type: 'heading2', content: trimmed.replace(/^#+\s*/, '').trim() });
      continue;
    }
    if (trimmed.startsWith('#')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({ type: 'heading1', content: trimmed.replace(/^#+\s*/, '').trim() });
      continue;
    }

    if (trimmed.startsWith('>')) {
      if (currentBlock) blocks.push(currentBlock);
      if (listItems.length > 0) blocks.push({ type: 'list', items: listItems });
      currentBlock = null;
      listItems = [];
      blocks.push({ type: 'blockquote', content: trimmed.replace(/^>\s*/, '').trim() });
      continue;
    }

    if (trimmed.match(/^[\*\-\•]\s+/)) {
      const itemContent = trimmed.replace(/^[\*\-\•]\s+/, '').trim();
      listItems.push(itemContent);
      continue;
    }

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
      return <Text style={[styles.heading3, { color: accentColor }]}>{block.content}</Text>;
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
      return <Text style={styles.bodyText}>{block.content}</Text>;
  }
}

const styles = StyleSheet.create({
  bodyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#6B7A99',
    lineHeight: 20,
    marginBottom: 12,
  },
  heading1Wrapper: {
    marginBottom: 16,
    marginTop: 18,
  },
  heading1: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    color: '#1A2235',
    lineHeight: 28,
    marginBottom: 8,
  },
  headingUnderline: {
    height: 3,
    width: 60,
    borderRadius: 1.5,
    marginTop: 8,
  },
  heading2Wrapper: {
    marginBottom: 12,
    marginTop: 16,
  },
  heading2: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    color: '#2A3A5A',
    lineHeight: 24,
  },
  heading3: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
    lineHeight: 20,
  },
  blockquoteWrapper: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: '#F6F8FB',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  blockquoteText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#6B7A99',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  codeBlock: {
    backgroundColor: '#1A2235',
    padding: 12,
    borderRadius: 6,
    marginVertical: 12,
    overflow: 'hidden',
  },
  codeText: {
    fontFamily: 'monospace',
    color: '#E0E0E0',
    lineHeight: 18,
    fontSize: 11,
  },
  listWrapper: {
    marginVertical: 12,
    paddingLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  listBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 12,
    flexShrink: 0,
  },
  listItemText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#6B7A99',
    lineHeight: 20,
    flex: 1,
  },
});
