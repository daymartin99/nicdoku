import { describe, expect, it } from 'vitest'
import { encodeFamilyCode, parseFamilyCode } from './backup'
import { nextPersonalLine } from './state/theme'
import type { FamilyData } from './themes/types'

const fam: FamilyData = {
  members: [
    { name: 'Alex', birthday: '2015-10-25', emoji: '🦖' },
    { name: 'Robin', birthday: '1990-01-05' },
  ],
  specials: [{ date: '12-31', title: 'Two reasons', message: 'NYE – and us ❤️', emoji: '❤️' }],
}

describe('family code', () => {
  it('round-trips, emoji included', () => {
    expect(parseFamilyCode(encodeFamilyCode(fam))).toEqual(fam)
  })
  it('survives line breaks, spaces and surrounding chat text', () => {
    const code = encodeFamilyCode(fam)
    const mangled = `Here you go!\n${code.slice(0, 30)}\n ${code.slice(30, 70)} \n${code.slice(70)}\nx`
    expect(parseFamilyCode(mangled.replace(/\nx$/, ''))).toEqual(fam)
  })
  it('accepts pasted raw JSON', () => {
    expect(parseFamilyCode(JSON.stringify(fam))).toEqual(fam)
  })
  it('rejects junk', () => {
    expect(parseFamilyCode('hello')).toBeNull()
    expect(parseFamilyCode('NICDOKU1:@@@@')).toBeNull()
  })
})

describe('next family date line', () => {
  it('names the next birthday and how far away it is', () => {
    expect(nextPersonalLine(new Date(2026, 8, 28, 12), fam)).toBe("🦖 Alex's birthday (11) in 27 days")
  })
  it('is empty when nothing is within six weeks or no family is loaded', () => {
    expect(nextPersonalLine(new Date(2026, 1, 1, 12), fam)).toBeNull()
    expect(nextPersonalLine(new Date(2026, 8, 28, 12), null)).toBeNull()
  })
})

describe('forgiving family-code paste', () => {
  it('ignores a copied line number before and after the code', () => {
    const code = encodeFamilyCode(fam)
    expect(parseFamilyCode(`1\t${code}\n2`)).toEqual(fam)
    expect(parseFamilyCode(`1  ${code}  2  `)).toEqual(fam)
  })
  it('copes with junk stuck to the end even without padding', () => {
    const tiny = { members: [{ name: 'Al', birthday: '2014-01-28' }], specials: [] }
    const code = encodeFamilyCode(tiny)
    expect(parseFamilyCode(code.replace(/=+$/, '') + 'x')).toEqual(tiny)
  })
  it('accepts a lower-case prefix and a code wrapped over many lines', () => {
    const code = encodeFamilyCode(fam)
    const wrapped = code.replace('NICDOKU1:', 'nicdoku1: ').replace(/(.{40})/g, '$1\n')
    expect(parseFamilyCode(wrapped)).toEqual(fam)
  })
})
