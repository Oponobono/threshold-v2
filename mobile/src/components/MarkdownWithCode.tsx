import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Markdown, { ASTNode } from 'react-native-markdown-display';
import { CodeHighlighter } from './CodeHighlighter';

interface Props {
  children: string;
}

export const MarkdownWithCode: React.FC<Props> = ({ children }) => {
  const rules = {
    fence: (node: ASTNode) => {
      const sourceInfo = (node as any).sourceInfo?.trim();
      const language = sourceInfo || undefined;
      const code = (node as any).content ?? '';

      return (
        <View key={node.key}>
          <CodeHighlighter code={code} language={language} />
        </View>
      );
    },
    code_inline: (node: ASTNode) => {
      const content = (node as any).content ?? '';
      return (
        <Text key={node.key} style={s.codeInline}>
          {content}
        </Text>
      );
    },
  };

  return (
    <View style={s.markdownContainer}>
      <Markdown rules={rules} style={markdownStyles}>
        {children}
      </Markdown>
    </View>
  );
};

const s = StyleSheet.create({
  markdownContainer: {
    flex: 1,
    width: '100%',
  },
  codeInline: {
    backgroundColor: 'rgba(17, 30, 37, 0.10)',
    color: '#0E7490',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    fontFamily: 'monospace',
    fontSize: 14,
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    textAlign: 'left',
  },
  paragraph: {
    marginTop: 4,
    marginBottom: 4,
  },
});
