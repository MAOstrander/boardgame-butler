import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UndoToast } from './undo-toast';
import { UndoService } from '../undo';
import { findByText, query, settle, text } from '../../testing/helpers';

describe('UndoToast', () => {
  let fixture: ComponentFixture<UndoToast>;
  let undo: UndoService;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [UndoToast] }).compileComponents();
    undo = TestBed.inject(UndoService);
    fixture = TestBed.createComponent(UndoToast);
    await settle(fixture);
  });

  afterEach(() => {
    undo.dismiss();
    vi.useRealTimers();
  });

  const toast = () => fixture.nativeElement.querySelector('[data-testid="undo-toast"]');

  it('shows nothing until something is deleted', () => {
    expect(toast()).toBeNull();
  });

  it('shows the message with an undo action', async () => {
    undo.propose('Deleted Catan.', vi.fn());
    await settle(fixture);

    expect(toast()).not.toBeNull();
    expect(text(fixture)).toContain('Deleted Catan.');
    expect(query(fixture, '[data-testid="undo-toast"]').getAttribute('role')).toBe('status');
  });

  it('reverses the deletion when Undo is pressed', async () => {
    const reverse = vi.fn();
    undo.propose('Deleted Catan.', reverse);
    await settle(fixture);

    findByText<HTMLButtonElement>(fixture, 'button', 'Undo').click();
    await settle(fixture);

    expect(reverse).toHaveBeenCalledTimes(1);
    expect(toast()).toBeNull();
  });

  it('can be dismissed without reversing', async () => {
    const reverse = vi.fn();
    undo.propose('Deleted Catan.', reverse);
    await settle(fixture);

    query<HTMLButtonElement>(fixture, 'button[aria-label="Dismiss"]').click();
    await settle(fixture);

    expect(reverse).not.toHaveBeenCalled();
    expect(toast()).toBeNull();
  });

  it('disappears when the offer expires', async () => {
    undo.propose('Deleted Catan.', vi.fn());
    await settle(fixture);
    expect(toast()).not.toBeNull();

    vi.advanceTimersByTime(8000);
    await settle(fixture);

    expect(toast()).toBeNull();
  });
});
