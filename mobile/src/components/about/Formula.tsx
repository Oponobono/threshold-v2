import React from 'react';
import { Text } from 'react-native';
import { aboutFeaturesStyles } from '../../styles/AboutFeatures.styles';

export const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={aboutFeaturesStyles.sub}>{children}</Text>
);

export const Sup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={aboutFeaturesStyles.sup}>{children}</Text>
);

export const F: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={aboutFeaturesStyles.formulaText}>{children}</Text>
);
