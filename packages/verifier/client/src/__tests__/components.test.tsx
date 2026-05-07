// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerificationForm } from '../components/VerificationForm';
import { VerifyStatusTracker, type VerifyStatus } from '../components/VerifyStatusTracker';
import { ResultPage } from '../pages/ResultPage';

/**
 * VerificationForm unit tests
 * Validates: Requirements 16.1
 */
describe('VerificationForm', () => {
  it('renders the form with credential type input', () => {
    render(<VerificationForm onSubmit={() => {}} />);
    expect(screen.getByLabelText('Credential Type')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create Verification Request' })).toBeDefined();
  });

  it('renders the form with correct aria-label', () => {
    render(<VerificationForm onSubmit={() => {}} />);
    expect(screen.getByRole('form', { name: 'Verification request form' })).toBeDefined();
  });

  it('calls onSubmit with the credential type when form is submitted', () => {
    const onSubmit = vi.fn();
    render(<VerificationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: 'UniversityDegree' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Verification Request' }));

    expect(onSubmit).toHaveBeenCalledWith('UniversityDegree');
  });

  it('trims whitespace from credential type before submitting', () => {
    const onSubmit = vi.fn();
    render(<VerificationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: '  UniversityDegree  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Verification Request' }));

    expect(onSubmit).toHaveBeenCalledWith('UniversityDegree');
  });

  it('does not submit when credential type is empty', () => {
    const onSubmit = vi.fn();
    render(<VerificationForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Verification Request' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when credential type is only whitespace', () => {
    const onSubmit = vi.fn();
    render(<VerificationForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Verification Request' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<VerificationForm onSubmit={() => {}} disabled={true} />);

    const input = screen.getByLabelText('Credential Type') as HTMLInputElement;
    const button = screen.getByRole('button', { name: 'Create Verification Request' }) as HTMLButtonElement;

    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
  });

  it('disables submit button when input is empty', () => {
    render(<VerificationForm onSubmit={() => {}} />);

    const button = screen.getByRole('button', { name: 'Create Verification Request' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables submit button when input has value', () => {
    render(<VerificationForm onSubmit={() => {}} />);

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: 'DriverLicense' },
    });

    const button = screen.getByRole('button', { name: 'Create Verification Request' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});

/**
 * VerifyStatusTracker unit tests
 * Validates: Requirements 16.3
 */
describe('VerifyStatusTracker', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<VerifyStatusTracker status="idle" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders request_created step as current when status is request_created', () => {
    render(<VerifyStatusTracker status="request_created" />);
    expect(screen.getByText(/Request Created/)).toBeDefined();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0].getAttribute('aria-current')).toBe('step');
  });

  it('renders presentation_received step as current when status is presentation_received', () => {
    render(<VerifyStatusTracker status="presentation_received" />);
    const listItems = screen.getAllByRole('listitem');
    // First step should be completed (not current)
    expect(listItems[0].getAttribute('aria-current')).toBeNull();
    // Second step should be current
    expect(listItems[1].getAttribute('aria-current')).toBe('step');
  });

  it('renders all steps as completed when status is verification_completed', () => {
    render(<VerifyStatusTracker status="verification_completed" />);
    const listItems = screen.getAllByRole('listitem');
    // Last step should be current
    expect(listItems[2].getAttribute('aria-current')).toBe('step');
    // All steps should show checkmarks
    listItems.forEach((item) => {
      expect(item.textContent).toContain('✓');
    });
  });

  it('shows progress heading', () => {
    render(<VerifyStatusTracker status="request_created" />);
    expect(screen.getByText('Verification Progress')).toBeDefined();
  });

  it('transitions correctly through all states', () => {
    const states: VerifyStatus[] = ['idle', 'request_created', 'presentation_received', 'verification_completed'];

    for (const status of states) {
      const { container, unmount } = render(<VerifyStatusTracker status={status} />);
      if (status === 'idle') {
        expect(container.innerHTML).toBe('');
      } else {
        expect(screen.getByRole('status')).toBeDefined();
      }
      unmount();
    }
  });

  it('marks previous steps as completed', () => {
    render(<VerifyStatusTracker status="presentation_received" />);
    const listItems = screen.getAllByRole('listitem');
    // First step should show checkmark (completed)
    expect(listItems[0].textContent).toContain('✓');
    // Second step should show checkmark (current, also completed)
    expect(listItems[1].textContent).toContain('✓');
    // Third step should show circle (not yet reached)
    expect(listItems[2].textContent).toContain('○');
  });
});

/**
 * ResultPage unit tests
 * Validates: Requirements 16.4
 */
describe('ResultPage', () => {
  function renderWithRouter(state: unknown) {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/result', state }]}>
        <ResultPage />
      </MemoryRouter>
    );
  }

  it('shows message when no result is available', () => {
    renderWithRouter(null);
    expect(screen.getByText('No verification result available.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start New Verification' })).toBeDefined();
  });

  it('displays successful verification result', () => {
    const result = {
      verified: true,
      credentials: [
        {
          type: ['VerifiableCredential', 'UniversityDegree'],
          issuer: 'did:key:z6Mktest123',
          credentialSubject: { degree: 'Computer Science', gpa: 3.8 },
          issuanceDate: '2024-01-15T00:00:00Z',
        },
      ],
    };

    renderWithRouter({ result });

    expect(screen.getByText('✓ Verification Successful')).toBeDefined();
    expect(screen.getByText(/VerifiableCredential, UniversityDegree/)).toBeDefined();
    expect(screen.getByText(/did:key:z6Mktest123/)).toBeDefined();
  });

  it('displays failed verification result with errors', () => {
    const result = {
      verified: false,
      credentials: [],
      errors: ['Invalid signature', 'Credential expired'],
    };

    renderWithRouter({ result });

    expect(screen.getByText('✗ Verification Failed')).toBeDefined();
    expect(screen.getByText('Invalid signature')).toBeDefined();
    expect(screen.getByText('Credential expired')).toBeDefined();
  });

  it('displays credential subject details', () => {
    const result = {
      verified: true,
      credentials: [
        {
          type: ['VerifiableCredential', 'DriverLicense'],
          issuer: 'did:key:z6Mkissuer',
          credentialSubject: { licenseNumber: 'DL-12345', isCommercial: false },
          issuanceDate: '2024-03-01T00:00:00Z',
        },
      ],
    };

    renderWithRouter({ result });

    expect(screen.getByText('Credential Subject')).toBeDefined();
  });

  it('renders verification result with role status', () => {
    const result = {
      verified: true,
      credentials: [],
    };

    renderWithRouter({ result });

    expect(screen.getByRole('status', { name: 'Verification result' })).toBeDefined();
  });

  it('shows Start New Verification button', () => {
    const result = {
      verified: true,
      credentials: [],
    };

    renderWithRouter({ result });

    expect(screen.getByRole('button', { name: 'Start New Verification' })).toBeDefined();
  });
});
