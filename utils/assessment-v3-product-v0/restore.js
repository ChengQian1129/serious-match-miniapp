function hasProgress(session) {
  return Boolean(session && (Array.isArray(session.answerEvents) && session.answerEvents.length || session.completedAt || session.status === 'synced' || session.status === 'completed'))
}

function isUnsynced(session) {
  return Boolean(session && hasProgress(session) && session.status === 'pending_cloud')
}

function updatedAt(session) {
  return Number(session && session.updatedAt) || Number(session && session.startedAt) || 0
}

function resolveProductRestoreDecision(localSession, remoteSession) {
  const localHasProgress = hasProgress(localSession)
  const remoteHasProgress = hasProgress(remoteSession)
  if (!localHasProgress && !remoteHasProgress) return 'new'
  if (localHasProgress && !remoteHasProgress) return 'local'
  if (!localHasProgress && remoteHasProgress) return 'cloud'

  const localUpdatedAt = updatedAt(localSession)
  const remoteUpdatedAt = updatedAt(remoteSession)
  if (remoteUpdatedAt > localUpdatedAt) return isUnsynced(localSession) ? 'conflict' : 'cloud'
  if (localUpdatedAt > remoteUpdatedAt) return isUnsynced(localSession) ? 'local-sync' : 'local'
  return isUnsynced(localSession) ? 'conflict' : 'local'
}

module.exports = { hasProgress, isUnsynced, updatedAt, resolveProductRestoreDecision }
