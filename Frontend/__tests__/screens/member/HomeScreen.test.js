import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../../src/screens/member/HomeScreen';

jest.mock('../../../src/components/common/Header', () => 'Header');
jest.mock('../../../src/components/common/Footer', () => 'Footer');

describe('HomeScreen', () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  it('navega a profile al tocar el boton', async () => {
    const mockGoToProfile = jest.fn();
    const { getByText } = render(<HomeScreen onGoToProfile={mockGoToProfile} />);
    
    jest.advanceTimersByTime(1000); // Pasar el loading

    await waitFor(() => {
      fireEvent.press(getByText('Go to Profile Screen'));
      expect(mockGoToProfile).toHaveBeenCalled();
    });
  });
});