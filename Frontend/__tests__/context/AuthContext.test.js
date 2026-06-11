import React from 'react';
import { render } from '@testing-library/react-native';
import { AuthProvider } from '../../../src/context/AuthContext';
import { Text } from 'react-native';

// Simulamos el almacenamiento del teléfono
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('AuthContext', () => {
  it('renderiza a los hijos correctamente sin romperse', () => {
    const { getByText } = render(
      <AuthProvider>
        <Text>Contenido Protegido</Text>
      </AuthProvider>
    );
    expect(getByText('Contenido Protegido')).toBeTruthy();
  });
});