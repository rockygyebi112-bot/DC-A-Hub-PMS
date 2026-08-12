import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentComposer } from '@/components/internal/comments';

const KWAME = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const AMA = '7e8d9c0b-1a2b-4c3d-9e8f-0a1b2c3d4e5f';

const STAFF = [
  { user_id: KWAME, full_name: 'Kwame Gyebi' },
  { user_id: AMA, full_name: 'Ama Serwaa' },
];

const USER = { name: 'Kofi Mensah', email: 'kofi@example.com', avatarUrl: null };

/** Set the value and caret the way a keystroke would, then fire React's change. */
function type(el: HTMLTextAreaElement, value: string) {
  fireEvent.change(el, { target: { value, selectionStart: value.length } });
}

const okAction = () => vi.fn(async (_formData: FormData) => ({ ok: true }));

function setup(action = okAction()) {
  render(<CommentComposer action={action} user={USER} />);
  return {
    action,
    textarea: screen.getByRole('combobox') as HTMLTextAreaElement,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => STAFF })),
  );
  // insertMention defers the caret fix to the next frame.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CommentComposer mention picker', () => {
  it('opens a list of colleagues when you type @', async () => {
    const { textarea } = setup();
    type(textarea, '@');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Kwame Gyebi' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ama Serwaa' })).toBeInTheDocument();
  });

  it('filters the list as you type', async () => {
    const { textarea } = setup();
    type(textarea, '@kwa');
    await screen.findByRole('option', { name: 'Kwame Gyebi' });
    expect(screen.queryByRole('option', { name: 'Ama Serwaa' })).not.toBeInTheDocument();
  });

  it('does not open inside an email address', async () => {
    const { textarea } = setup();
    type(textarea, 'mail kgyebi112@gmail');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
  });

  it('shows the plain name in the box, never the raw markup', async () => {
    const { textarea } = setup();
    type(textarea, 'Hi @kwa');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('Hi @Kwame Gyebi ');
    expect(textarea.value).not.toContain(KWAME);
  });

  it('anchors the picked name to its id when the comment is posted', async () => {
    const action = okAction();
    const { textarea } = setup(action);
    type(textarea, 'Hi @kwa');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [formData] = action.mock.calls[0] ?? [];
    expect(String(formData?.get('body'))).toBe(`Hi @[Kwame Gyebi](${KWAME})`);
  });

  it('posts a hand-typed name as plain text, with no id behind it', async () => {
    const action = okAction();
    const { textarea } = setup(action);
    type(textarea, 'Ask @Kwame Gyebi about it');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [formData] = action.mock.calls[0] ?? [];
    expect(String(formData?.get('body'))).toBe('Ask @Kwame Gyebi about it');
  });

  it('picks the highlighted name after arrowing down', async () => {
    const { textarea } = setup();
    type(textarea, '@');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('@Ama Serwaa ');
  });

  it('closes the list on Escape without inserting anything', async () => {
    const { textarea } = setup();
    type(textarea, '@kwa');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    expect(textarea.value).toBe('@kwa');
  });

  it('closes the list once a mention has been inserted', async () => {
    const { textarea } = setup();
    type(textarea, '@kwa');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
  });

  it('still posts on Ctrl+Enter when the list is closed', async () => {
    const action = okAction();
    const { textarea } = setup(action);
    type(textarea, 'Plain comment');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [formData] = action.mock.calls[0] ?? [];
    expect(String(formData?.get('body'))).toBe('Plain comment');
  });

  it('does not post when Enter is picking a name from the list', async () => {
    const action = okAction();
    const { textarea } = setup(action);
    type(textarea, '@kwa');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(action).not.toHaveBeenCalled();
  });
});
