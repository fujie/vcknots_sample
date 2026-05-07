// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CredentialList } from '../components/CredentialList';
import { OfferConfirmDialog } from '../components/OfferConfirmDialog';
import { PresentConfirmDialog } from '../components/PresentConfirmDialog';
import type { StoredCredential, ParsedCredentialOffer, ParsedAuthzRequest } from '../types/wallet';

function makeCredential(overrides: Partial<StoredCredential> = {}): StoredCredential {
  return {
    id: 'cred-1',
    rawJwt: 'eyJ.eyJ.sig',
    decoded: {
      issuer: 'did:key:z6MkTestIssuer1234567890abcdef',
      type: ['VerifiableCredential', 'UniversityDegree'],
      credentialSubject: { degree: 'Computer Science' },
      issuanceDate: '2024-01-15T00:00:00Z',
    },
    issuerUrl: 'http://localhost:4001',
    receivedAt: '2024-01-15T12:00:00Z',
    ...overrides,
  };
}

/**
 * CredentialList unit tests
 * Validates: Requirements 10.1, 10.4
 */
describe('CredentialList', () => {
  it('shows empty state message when no credentials', () => {
    render(<CredentialList credentials={[]} />);
    expect(screen.getByText('No credentials stored yet.')).toBeDefined();
    expect(screen.getByText(/Go to the/)).toBeDefined();
  });

  it('renders credential cards when credentials exist', () => {
    const credentials = [
      makeCredential({ id: 'cred-1' }),
      makeCredential({
        id: 'cred-2',
        decoded: {
          issuer: 'did:key:z6MkOtherIssuer',
          type: ['VerifiableCredential', 'DriverLicense'],
          credentialSubject: { licenseNumber: 'DL-123' },
          issuanceDate: '2024-02-01T00:00:00Z',
        },
      }),
    ];

    render(<CredentialList credentials={credentials} />);
    expect(screen.getByText('UniversityDegree')).toBeDefined();
    expect(screen.getByText('DriverLicense')).toBeDefined();
  });

  it('calls onSelect when a credential card is clicked', () => {
    const onSelect = vi.fn();
    const credentials = [makeCredential()];

    render(<CredentialList credentials={credentials} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(credentials[0]);
  });
});

/**
 * OfferConfirmDialog unit tests
 * Validates: Requirements 7.3
 */
describe('OfferConfirmDialog', () => {
  const mockOffer: ParsedCredentialOffer = {
    issuerUrl: 'http://localhost:4001',
    credentialType: 'UniversityDegree',
    preAuthorizedCode: 'test-code-123',
    issuerMetadata: {},
  };

  it('displays offer details', () => {
    render(
      <OfferConfirmDialog
        offer={mockOffer}
        onAccept={() => {}}
        onReject={() => {}}
      />
    );
    expect(screen.getByText('http://localhost:4001')).toBeDefined();
    expect(screen.getByText('UniversityDegree')).toBeDefined();
  });

  it('calls onAccept when Accept button is clicked', () => {
    const onAccept = vi.fn();
    render(
      <OfferConfirmDialog
        offer={mockOffer}
        onAccept={onAccept}
        onReject={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onReject when Reject button is clicked', () => {
    const onReject = vi.fn();
    render(
      <OfferConfirmDialog
        offer={mockOffer}
        onAccept={() => {}}
        onReject={onReject}
      />
    );
    fireEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading', () => {
    render(
      <OfferConfirmDialog
        offer={mockOffer}
        onAccept={() => {}}
        onReject={() => {}}
        loading={true}
      />
    );
    expect((screen.getByText('Accepting...') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Reject') as HTMLButtonElement).disabled).toBe(true);
  });
});

/**
 * PresentConfirmDialog unit tests
 * Validates: Requirements 9.3
 */
describe('PresentConfirmDialog', () => {
  const matchingCredentials: StoredCredential[] = [
    makeCredential({ id: 'cred-1' }),
    makeCredential({
      id: 'cred-2',
      decoded: {
        issuer: 'did:key:z6MkOtherIssuer1234567890abcdef',
        type: ['VerifiableCredential', 'DriverLicense'],
        credentialSubject: { licenseNumber: 'DL-456' },
        issuanceDate: '2024-03-01T00:00:00Z',
      },
    }),
  ];

  const mockRequest: ParsedAuthzRequest = {
    verifierUrl: 'http://localhost:4002',
    responseUri: 'http://localhost:4002/authz-response',
    nonce: 'test-nonce',
    presentationDefinition: {
      id: 'pd-1',
      input_descriptors: [
        {
          id: 'desc-1',
          constraints: {
            fields: [{ path: ['$.type'] }],
          },
        },
      ],
    },
    matchingCredentials,
  };

  it('displays verifier URL and matching credentials', () => {
    render(
      <PresentConfirmDialog
        request={mockRequest}
        onApprove={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('http://localhost:4002')).toBeDefined();
    expect(screen.getByText(/UniversityDegree/)).toBeDefined();
    expect(screen.getByText(/DriverLicense/)).toBeDefined();
  });

  it('shows no matching credentials message when empty', () => {
    const emptyRequest: ParsedAuthzRequest = {
      ...mockRequest,
      matchingCredentials: [],
    };
    render(
      <PresentConfirmDialog
        request={emptyRequest}
        onApprove={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('No matching credentials found for this request.')).toBeDefined();
  });

  it('calls onApprove with selected credentials', () => {
    const onApprove = vi.fn();
    render(
      <PresentConfirmDialog
        request={mockRequest}
        onApprove={onApprove}
        onCancel={() => {}}
      />
    );

    // All credentials are selected by default
    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledWith(matchingCredentials);
  });

  it('allows deselecting credentials', () => {
    const onApprove = vi.fn();
    render(
      <PresentConfirmDialog
        request={mockRequest}
        onApprove={onApprove}
        onCancel={() => {}}
      />
    );

    // Deselect the first credential
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledWith([matchingCredentials[1]]);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <PresentConfirmDialog
        request={mockRequest}
        onApprove={() => {}}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Approve when no credentials are selected', () => {
    render(
      <PresentConfirmDialog
        request={mockRequest}
        onApprove={() => {}}
        onCancel={() => {}}
      />
    );

    // Deselect all credentials
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    expect((screen.getByText('Approve') as HTMLButtonElement).disabled).toBe(true);
  });
});
