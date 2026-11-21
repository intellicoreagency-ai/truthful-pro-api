import { describe, expect, it } from 'vitest'
import { colOf, dropFor, errorKey } from '../src/kanban/model'

describe('board drag rules (what a drop means)', () => {
  it('New → In progress starts the review', () => expect(dropFor('submitted', 'progress')).toEqual({ kind: 'status', to: 'review' }))
  it('In review → Pending client opens the missing-documents form (never a silent status change)', () => expect(dropFor('review', 'pending')).toEqual({ kind: 'missing' }))
  it('dropping into the same column does nothing', () => expect(dropFor('review', 'progress')).toBeNull())
  it('a move the workflow does not allow is refused (e.g. New → Completed)', () => expect(dropFor('submitted', 'done')).toBeNull())
  it('every working status has a column; drafts are not on the board', () => {
    expect(colOf('needs_documents')).toBe('pending'); expect(colOf('authority')).toBe('progress'); expect(colOf('draft')).toBeNull()
  })
  it('server errors map to sentences the staff member can act on', () => {
    expect(errorKey('version_conflict')).toBe('e_conflict'); expect(errorKey('payment_required')).toBe('payBlocked'); expect(errorKey('something_new')).toBe('e_gen')
  })
})
