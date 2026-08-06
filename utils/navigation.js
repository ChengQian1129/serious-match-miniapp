function navigateOnce(page, method, options = {}) {
  if (page._isRouting) return false
  const navigate = wx[method]
  if (typeof navigate !== 'function') return false

  page._isRouting = true
  const onFail = options.fail
  const onSuccess = options.success
  navigate(Object.assign({}, options, {
    success(result) {
      if (onSuccess) onSuccess(result)
    },
    fail(error) {
      page._isRouting = false
      if (onFail) onFail(error)
    }
  }))
  return true
}

function resetNavigation(page) {
  page._isRouting = false
}

module.exports = { navigateOnce, resetNavigation }
