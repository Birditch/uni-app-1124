'use strict'

const { createHash, randomBytes } = require('node:crypto')

const collections = {
  sessions: 'bon-sessions',
  cases: 'bon-cases',
  groups: 'bon-groups',
  ledger: 'bon-ledger',
  reports: 'bon-reports',
}

class CourtError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function newId() {
  return randomBytes(16).toString('hex')
}

// Beijing calendar day used for daily check-ins.
function localDay(now) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

module.exports = { collections, CourtError, hash, newId, localDay }
