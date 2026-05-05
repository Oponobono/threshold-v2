import React from 'react';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

interface Props {
  value: Date;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  mode?: 'date' | 'time';
}

/**
 * ThresholdDatePicker.tsx
 *
 * Envoltorio (Wrapper) multiplataforma sobre '@react-native-community/datetimepicker'.
 * Provee un selector de fechas u horas nativo. En dispositivos iOS fuerza el uso
 * de la vista tipo 'spinner' clásica para mantener consistencia con el diseño
 * original de la aplicación, mientras que en Android utiliza el calendario nativo por defecto.
 *
 * @param value - La fecha/hora actualmente seleccionada.
 * @param onChange - Callback que se ejecuta cuando el usuario selecciona una fecha.
 * @param mode - Determina si se muestra un selector de fechas ('date') o de reloj ('time').
 */
export const ThresholdDatePicker = ({ value, onChange, mode = 'date' }: Props) => {
  return (
    <DateTimePicker
      value={value}
      mode={mode}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={onChange}
    />
  );
};
