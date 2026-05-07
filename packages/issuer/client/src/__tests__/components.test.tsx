// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CredentialForm } from '../components/CredentialForm';
import { IssueStatusTracker, type IssueStatus } from '../components/IssueStatusTracker';

/**
 * CredentialForm unit tests
 * Validates: Requirements 15.1
 */
describe('CredentialForm', () => {
  const mockSchemas = [
    {
      id: '1',
      name: 'UniversityDegree',
      version: '1.0',
      attributes: [
        { name: 'degree', type: 'string' as const, required: true, description: 'Degree name' },
        { name: 'gpa', type: 'number' as const, required: false, description: 'GPA score' },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'DriverLicense',
      version: '1.0',
      attributes: [
        { name: 'licenseNumber', type: 'string' as const, required: true },
        { name: 'expiryDate', type: 'date' as const, required: true },
        { name: 'isCommercial', type: 'boolean' as const, required: true },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSchemas),
    }) as unknown as typeof fetch;
  });

  it('renders loading state initially', () => {
    const { container } = render(<CredentialForm onSubmit={() => {}} />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders schema selection dropdown after loading', async () => {
    render(<CredentialForm onSubmit={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Credential Type')).toBeDefined();
    });
    expect(screen.getByText('UniversityDegree (v1.0)')).toBeDefined();
    expect(screen.getByText('DriverLicense (v1.0)')).toBeDefined();
  });

  it('renders dynamic form fields when a schema is selected', async () => {
    render(<CredentialForm onSubmit={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Credential Type')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: 'UniversityDegree' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/degree/)).toBeDefined();
      expect(screen.getByLabelText(/gpa/)).toBeDefined();
    });
  });

  it('renders boolean attributes as select dropdowns', async () => {
    render(<CredentialForm onSubmit={() => {}} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Credential Type')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: 'DriverLicense' },
    });

    await waitFor(() => {
      const boolSelect = screen.getByLabelText(/isCommercial/);
      expect(boolSelect.tagName).toBe('SELECT');
    });
  });

  it('calls onSubmit with correct data when form is submitted', async () => {
    const onSubmit = vi.fn();
    render(<CredentialForm onSubmit={onSubmit} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Credential Type')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: 'UniversityDegree' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/degree/)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/degree/), {
      target: { value: 'Computer Science' },
    });
    fireEvent.change(screen.getByLabelText(/gpa/), {
      target: { value: '3.8' },
    });

    fireEvent.click(screen.getByText('Generate Offer'));

    expect(onSubmit).toHaveBeenCalledWith({
      credentialType: 'UniversityDegree',
      claims: { degree: 'Computer Science', gpa: 3.8 },
    });
  });

  it('does not submit when required fields are empty', async () => {
    const onSubmit = vi.fn();
    render(<CredentialForm onSubmit={onSubmit} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Credential Type')).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText('Credential Type'), {
      target: { value: 'UniversityDegree' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/degree/)).toBeDefined();
    });

    // Leave required 'degree' field empty
    fireEvent.click(screen.getByText('Generate Offer'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows error message when schema fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch;

    render(<CredentialForm onSubmit={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('disables form controls when disabled prop is true', async () => {
    render(<CredentialForm onSubmit={() => {}} disabled={true} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Credential Type')).toBeDefined();
    });

    const select = screen.getByLabelText('Credential Type') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});

/**
 * IssueStatusTracker unit tests
 * Validates: Requirements 15.4
 */
describe('IssueStatusTracker', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<IssueStatusTracker status="idle" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders offer_created step as current when status is offer_created', () => {
    render(<IssueStatusTracker status="offer_created" />);
    expect(screen.getByText(/Offer Created/)).toBeDefined();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0].getAttribute('aria-current')).toBe('step');
  });

  it('renders token_issued step as current when status is token_issued', () => {
    render(<IssueStatusTracker status="token_issued" />);
    const listItems = screen.getAllByRole('listitem');
    // First step should be completed (not current)
    expect(listItems[0].getAttribute('aria-current')).toBeNull();
    // Second step should be current
    expect(listItems[1].getAttribute('aria-current')).toBe('step');
  });

  it('renders all steps as completed when status is credential_issued', () => {
    render(<IssueStatusTracker status="credential_issued" />);
    const listItems = screen.getAllByRole('listitem');
    // Last step should be current
    expect(listItems[2].getAttribute('aria-current')).toBe('step');
    // All steps should show checkmarks
    listItems.forEach((item) => {
      expect(item.textContent).toContain('✓');
    });
  });

  it('shows progress heading', () => {
    render(<IssueStatusTracker status="offer_created" />);
    expect(screen.getByText('Issuance Progress')).toBeDefined();
  });

  it('transitions correctly through all states', () => {
    const states: IssueStatus[] = ['idle', 'offer_created', 'token_issued', 'credential_issued'];

    for (const status of states) {
      const { container, unmount } = render(<IssueStatusTracker status={status} />);
      if (status === 'idle') {
        expect(container.innerHTML).toBe('');
      } else {
        expect(screen.getByRole('status')).toBeDefined();
      }
      unmount();
    }
  });
});
