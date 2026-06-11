import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Footer from '../../../src/components/common/Footer';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../src/context/AuthContext', () => ({ useAuth: jest.fn() }));

describe('Footer Component', () => {
  it('cierra sesión y navega a login', async () => {
    const mockPush = jest.fn();
    const mockLogout = jest.fn().mockResolvedValue();
    useRouter.mockReturnValue({ push: mockPush });
    useAuth.mockReturnValue({ logout: mockLogout });

    const { getByText } = render(<Footer />);
    fireEvent.press(getByText('Logout'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('login');
    });
  });
});