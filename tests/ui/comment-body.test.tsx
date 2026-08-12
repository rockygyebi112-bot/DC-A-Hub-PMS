import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentBody } from '@/components/internal/comment-body';

const KWAME = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const AMA = '7e8d9c0b-1a2b-4c3d-9e8f-0a1b2c3d4e5f';

describe('CommentBody', () => {
  it('renders a mention as a chip showing the name, without the markup', () => {
    render(
      <CommentBody
        body={`@[Kwame Gyebi](${KWAME}) can you check the budget?`}
        currentUserId={AMA}
      />,
    );
    expect(screen.getByText('@Kwame Gyebi')).toBeInTheDocument();
    expect(screen.queryByText(/\]\(/)).not.toBeInTheDocument();
  });

  it('keeps the surrounding text intact', () => {
    const { container } = render(
      <CommentBody
        body={`Hi @[Ama Serwaa](${AMA}), see the note.`}
        currentUserId={KWAME}
      />,
    );
    expect(container.textContent).toBe('Hi @Ama Serwaa, see the note.');
  });

  it('marks a mention of the reader so they can spot it in a thread', () => {
    render(
      <CommentBody body={`@[Ama Serwaa](${AMA}) over to you`} currentUserId={AMA} />,
    );
    expect(screen.getByText('@Ama Serwaa')).toHaveAttribute('data-self', 'true');
  });

  it('does not mark a mention of somebody else', () => {
    render(
      <CommentBody body={`@[Ama Serwaa](${AMA}) over to you`} currentUserId={KWAME} />,
    );
    expect(screen.getByText('@Ama Serwaa')).toHaveAttribute('data-self', 'false');
  });

  it('renders markup-shaped text with a bad id as literal text', () => {
    const body = '@[Kwame Gyebi](oops) is not a mention';
    const { container } = render(
      <CommentBody body={body} currentUserId={AMA} />,
    );
    expect(container.textContent).toBe(body);
  });

  it('preserves plain bodies unchanged', () => {
    const { container } = render(
      <CommentBody body="No mentions here." currentUserId={AMA} />,
    );
    expect(container.textContent).toBe('No mentions here.');
  });
});
