import React from 'react';
import { render } from '@testing-library/react-native';
import Card from '../../../src/components/common/Card';

describe('Card Component', () => {
  it('renderiza título y contenido', () => {
    const { getByText } = render(<Card title="Rutina" content="Pecho y Triceps" />);
    expect(getByText('Rutina')).toBeTruthy();
    expect(getByText('Pecho y Triceps')).toBeTruthy();
  });
});