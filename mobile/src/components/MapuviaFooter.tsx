import React from 'react';
import { View, Image } from 'react-native';
import { mapuviaFooterStyles as styles } from '../styles/MapuviaFooter.styles';

/**
 * MapuviaFooter.tsx
 *
 * Componente visual estático que muestra el logotipo corporativo de MAPUVIA Labs.
 * Generalmente se utiliza en la parte inferior de pantallas de configuración,
 * menús laterales o modales tipo "Acerca de" para reforzar el branding.
 */
export const MapuviaFooter = () => {
  return (
    <View style={styles.container}>
      <Image 
        source={require('../images/logos_mapuvia/logotipo_mapuvia_labs.png')} 
        style={styles.logotipo} 
        resizeMode="contain" 
      />
    </View>
  );
};
