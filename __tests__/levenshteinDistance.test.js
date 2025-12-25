'use strict'

const { levenshteinDistance } = require('../lib/helpers/levenshteinDistance')

describe('levenshteinDistance', () => {
  describe('edge cases', () => {
    test('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0)
      expect(levenshteinDistance('', '')).toBe(0)
      expect(levenshteinDistance('a', 'a')).toBe(0)
    })

    test('returns length of other string when one is empty', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5)
      expect(levenshteinDistance('hello', '')).toBe(5)
      expect(levenshteinDistance('', 'a')).toBe(1)
      expect(levenshteinDistance('abc', '')).toBe(3)
    })

    test('handles single character strings', () => {
      expect(levenshteinDistance('a', 'b')).toBe(1)
      expect(levenshteinDistance('a', 'a')).toBe(0)
      expect(levenshteinDistance('a', 'ab')).toBe(1)
    })

    test('handles very short strings (2 chars)', () => {
      expect(levenshteinDistance('ab', 'ab')).toBe(0)
      expect(levenshteinDistance('ab', 'ac')).toBe(1)
      expect(levenshteinDistance('ab', 'ba')).toBe(2)
      expect(levenshteinDistance('ab', 'cd')).toBe(2)
    })
  })

  describe('single edit operations (distance = 1)', () => {
    test('detects single insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1)
      expect(levenshteinDistance('test', 'tests')).toBe(1)
      expect(levenshteinDistance('lodash', 'lodashi')).toBe(1)
    })

    test('detects single deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1)
      expect(levenshteinDistance('tests', 'test')).toBe(1)
      expect(levenshteinDistance('express', 'expres')).toBe(1)
    })

    test('detects single substitution', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1)
      expect(levenshteinDistance('cat', 'cot')).toBe(1)
      expect(levenshteinDistance('lodash', 'lodesh')).toBe(1)
    })
  })

  describe('double edit operations (distance = 2)', () => {
    test('detects two insertions', () => {
      expect(levenshteinDistance('cat', 'catch')).toBe(2)
      expect(levenshteinDistance('test', 'tested')).toBe(2)
    })

    test('detects two deletions', () => {
      expect(levenshteinDistance('catch', 'cat')).toBe(2)
      expect(levenshteinDistance('tested', 'test')).toBe(2)
    })

    test('detects two substitutions', () => {
      expect(levenshteinDistance('cat', 'dog')).toBe(3) // c->d, a->o, t->g = 3
      expect(levenshteinDistance('abc', 'adc')).toBe(1) // only b->d
      expect(levenshteinDistance('abc', 'dec')).toBe(2) // a->d, b->e
    })

    test('detects insertion + substitution', () => {
      expect(levenshteinDistance('cat', 'bats')).toBe(2) // c->b, +s
    })

    test('detects transposition-like changes', () => {
      // Note: standard Levenshtein treats transposition as 2 operations
      expect(levenshteinDistance('ab', 'ba')).toBe(2)
      expect(levenshteinDistance('abc', 'bac')).toBe(2)
    })
  })

  describe('boundary case (distance = 3)', () => {
    test('detects distance of exactly 3', () => {
      expect(levenshteinDistance('cat', 'dog')).toBe(3)
      expect(levenshteinDistance('abc', 'def')).toBe(3)
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    })
  })

  describe('npm package name scenarios', () => {
    test('detects typosquatting of popular packages', () => {
      // lodash typosquats
      expect(levenshteinDistance('lodash', 'lodesh')).toBe(1)
      expect(levenshteinDistance('lodash', 'lodasj')).toBe(1)
      expect(levenshteinDistance('lodash', 'lodas')).toBe(1)
      expect(levenshteinDistance('lodash', 'lodashs')).toBe(1)

      // express typosquats
      expect(levenshteinDistance('express', 'expres')).toBe(1)
      expect(levenshteinDistance('express', 'expresss')).toBe(1)
      expect(levenshteinDistance('express', 'expreas')).toBe(1)

      // react typosquats
      expect(levenshteinDistance('react', 'reacr')).toBe(1)
      expect(levenshteinDistance('react', 'reactt')).toBe(1)
    })

    test('handles scoped package names', () => {
      expect(levenshteinDistance('@angular/core', '@angular/cors')).toBe(1)
      expect(levenshteinDistance('@types/node', '@types/nodes')).toBe(1)
      expect(levenshteinDistance('@babel/core', '@babel/cors')).toBe(1)
    })

    test('handles hyphenated package names', () => {
      expect(levenshteinDistance('is-array', 'is-arrey')).toBe(1)
      expect(levenshteinDistance('lodash-es', 'lodash-ess')).toBe(1)
      expect(levenshteinDistance('cross-env', 'cross-emv')).toBe(1)
    })

    test('correctly identifies legitimate different packages', () => {
      // These should have distance >= 3 (not typosquats of each other)
      expect(levenshteinDistance('react', 'redux')).toBeGreaterThanOrEqual(3)
      expect(levenshteinDistance('lodash', 'moment')).toBeGreaterThanOrEqual(3)
      expect(levenshteinDistance('express', 'fastify')).toBeGreaterThanOrEqual(3)
    })
  })

  describe('maxDistance parameter (early termination)', () => {
    test('returns correct distance when below maxDistance', () => {
      expect(levenshteinDistance('cat', 'bat', 3)).toBe(1)
      expect(levenshteinDistance('cat', 'car', 3)).toBe(1)
      expect(levenshteinDistance('hello', 'hallo', 3)).toBe(1)
    })

    test('returns distance >= maxDistance when threshold exceeded', () => {
      // When maxDistance is provided and exceeded, returns a value >= maxDistance
      const result = levenshteinDistance('cat', 'dog', 2)
      expect(result).toBeGreaterThanOrEqual(2)
    })

    test('handles maxDistance of 3 (npq use case)', () => {
      // Distance 1 - should detect
      expect(levenshteinDistance('lodash', 'lodesh', 3)).toBe(1)

      // Distance 2 - should detect
      expect(levenshteinDistance('lodash', 'lodesa', 3)).toBe(2)

      // Distance 3 - at threshold
      const dist3 = levenshteinDistance('abc', 'def', 3)
      expect(dist3).toBeGreaterThanOrEqual(3)
    })

    test('early termination with length difference exceeding maxDistance', () => {
      // Length difference is 5, maxDistance is 2
      const result = levenshteinDistance('ab', 'abcdefg', 2)
      expect(result).toBeGreaterThanOrEqual(2)
    })
  })

  describe('symmetry property', () => {
    test('distance(a, b) equals distance(b, a)', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(levenshteinDistance('hallo', 'hello'))
      expect(levenshteinDistance('kitten', 'sitting')).toBe(
        levenshteinDistance('sitting', 'kitten')
      )
      expect(levenshteinDistance('abc', 'def')).toBe(levenshteinDistance('def', 'abc'))
      expect(levenshteinDistance('lodash', 'express')).toBe(
        levenshteinDistance('express', 'lodash')
      )
    })
  })

  describe('classic Levenshtein examples', () => {
    test('kitten -> sitting = 3', () => {
      // kitten -> sitten (k->s) -> sittin (e->i) -> sitting (+g)
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    })

    test('saturday -> sunday = 3', () => {
      // saturday -> sturday (a->) -> surday (t->) -> sunday (r->n)
      // Actually: saturday(8) -> sunday(6)
      // s-a-t-u-r-d-a-y -> s-u-n-d-a-y
      // delete 'at', r->n = 3
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3)
    })

    test('flaw -> lawn = 2', () => {
      expect(levenshteinDistance('flaw', 'lawn')).toBe(2)
    })
  })
})
