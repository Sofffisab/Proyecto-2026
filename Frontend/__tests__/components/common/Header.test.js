import React from 'react';
import { render } from '@testing-library/react-native';
import Header from '../../../src/components/common/Header';

describe('Header Component', () => {
  it('renderiza título y subtítulo', () => {
    const { getByText } = render(<Header pageTitle="Inicio" subtitle="Bienvenido" />);
    expect(getByText('Inicio')).toBeTruthy();
    expect(getByText('Bienvenido')).toBeTruthy();
  });
});