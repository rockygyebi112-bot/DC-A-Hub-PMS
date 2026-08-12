import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { InternalProof } from '@/lib/internal/queries';

const deleteInternalTaskProof = vi.fn(async () => ({ ok: true }));

vi.mock('@/lib/internal/proofs', () => ({
  deleteInternalTaskProof: (...args: unknown[]) =>
    deleteInternalTaskProof(...(args as [])),
  uploadInternalTaskProofs: vi.fn(async () => ({ ok: true })),
  requestInternalProofAccess: vi.fn(async () => ({ ok: true, data: null })),
  addInternalProofComment: vi.fn(async () => ({ ok: true })),
  deleteInternalProofComment: vi.fn(async () => ({ ok: true })),
}));

const { TaskDocumentsCard } = await import(
  '@/components/internal/task-documents-card'
);

const UPLOADER = '0844b210-8171-419e-9539-e5f12d208ece';
const SOMEONE_ELSE = '7e8d9c0b-1a2b-4c3d-9e8f-0a1b2c3d4e5f';

const PROOF: InternalProof = {
  id: 'proof-1',
  task_id: 'task-1',
  file_path: 'internal/tasks/task-1/report.pdf',
  file_name: 'baseline-report.pdf',
  mime_type: 'application/pdf',
  size_bytes: 2048,
  caption: null,
  uploaded_by: UPLOADER,
  created_at: '2026-08-12T09:00:00Z',
  uploaderName: 'Selom Apanya',
};

const USER = { name: 'Selom Apanya', email: 'selom@example.com', avatarUrl: null };

function renderCard(currentUserId: string, isAdmin = false) {
  return render(
    <TaskDocumentsCard
      taskId="task-1"
      proofs={[PROOF]}
      commentsByProof={{}}
      user={USER}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
    />,
  );
}

beforeEach(() => {
  deleteInternalTaskProof.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => [] })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('deleting a task attachment', () => {
  it('offers delete on the document row, named after the file', () => {
    renderCard(UPLOADER);
    expect(
      screen.getByRole('button', { name: 'Delete baseline-report.pdf' }),
    ).toBeInTheDocument();
  });

  it('asks before deleting rather than acting on the first click', () => {
    renderCard(UPLOADER);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete baseline-report.pdf' }),
    );
    expect(screen.getByText('Delete document')).toBeInTheDocument();
    expect(deleteInternalTaskProof).not.toHaveBeenCalled();
  });

  it('deletes once confirmed', async () => {
    renderCard(UPLOADER);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete baseline-report.pdf' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteInternalTaskProof).toHaveBeenCalledTimes(1));
    expect(deleteInternalTaskProof).toHaveBeenCalledWith('task-1', 'proof-1');
  });

  it('does not delete when the confirmation is cancelled', async () => {
    renderCard(UPLOADER);
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete baseline-report.pdf' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByText('Delete document')).not.toBeInTheDocument(),
    );
    expect(deleteInternalTaskProof).not.toHaveBeenCalled();
  });

  it('hides delete from someone who neither uploaded it nor is admin', () => {
    renderCard(SOMEONE_ELSE);
    expect(
      screen.queryByRole('button', { name: 'Delete baseline-report.pdf' }),
    ).not.toBeInTheDocument();
  });

  it('offers delete to an admin who did not upload it', () => {
    renderCard(SOMEONE_ELSE, true);
    expect(
      screen.getByRole('button', { name: 'Delete baseline-report.pdf' }),
    ).toBeInTheDocument();
  });
});
