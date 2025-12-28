import { render, screen } from '@testing-library/react';
import MediaCard from '@/components/MediaCard';

describe('MediaCard', () => {
  it('renders heading and text', () => {
    render(<MediaCard heading="RGB" text="Additive color space" />);
    expect(screen.getByText('RGB')).toBeInTheDocument();
    expect(screen.getByText('Additive color space')).toBeInTheDocument();
  });
});

