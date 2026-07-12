import React from 'react';
import { View, Text } from 'react-native';
import Markdown, { ASTNode } from 'react-native-markdown-display';
import { CodeHighlighter } from './CodeHighlighter';
import { s, markdownStyles } from '../../styles/MarkdownWithCode.styles';

interface Props {
  children: string;
  style?: any;
  rules?: any;
}

export const MarkdownWithCode: React.FC<Props> = ({ children, style, rules: customRules }) => {
  const baseRules = {
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

  const rules = { ...baseRules, ...customRules };

  return (
    <View style={s.markdownContainer}>
      <Markdown rules={rules} style={{ ...markdownStyles, ...style }}>
        {children}
      </Markdown>
    </View>
  );
};
