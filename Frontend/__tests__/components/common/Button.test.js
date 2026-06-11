import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Button from '../../../src/components/common/Button';

describe('Button Component', () => {
  it('renderiza el texto y responde al toque', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(<Button label="Test" onPress={mockOnPress} />);
    
    expect(getByText('Test')).toBeTruthy();
    fireEvent.press(getByText('Test'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});