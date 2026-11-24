const controls = 'uni-button, uni-input, uni-textarea'
const fieldAttributes = ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid', 'aria-required']

// Uni H5 renders its controls inside custom elements.
export function installKeyboardSupport() {
  if (typeof document === 'undefined') return

  const buttonDisabled = new WeakSet()
  const fieldLabels = new WeakMap()
  const sync = (element) => {
    if (element.matches('uni-input, uni-textarea')) {
      const field = element.querySelector('input, textarea')
      if (!field) return
      const transferred = fieldLabels.get(field) ?? new Set()
      for (const attribute of fieldAttributes) {
        if (element.hasAttribute(attribute)) {
          const value = element.getAttribute(attribute)
          if (field.getAttribute(attribute) !== value) field.setAttribute(attribute, value)
          transferred.add(attribute)
        } else if (transferred.delete(attribute)) {
          field.removeAttribute(attribute)
        }
      }
      fieldLabels.set(field, transferred)
      return
    }
    if (!element.matches('uni-button')) return
    const disabled = element.hasAttribute('disabled')
    if (!element.hasAttribute('role')) element.setAttribute('role', 'button')
    if (!element.hasAttribute('tabindex') || element.dataset.courtTabStop === 'managed') {
      element.dataset.courtTabStop = 'managed'
      const tabIndex = disabled ? -1 : 0
      if (element.tabIndex !== tabIndex) element.tabIndex = tabIndex
    }
    if (disabled && !element.hasAttribute('aria-disabled')) {
      element.setAttribute('aria-disabled', 'true')
      buttonDisabled.add(element)
    } else if (!disabled && buttonDisabled.delete(element)) {
      if (element.getAttribute('aria-disabled') === 'true') element.removeAttribute('aria-disabled')
    }
  }

  document.querySelectorAll(controls).forEach(sync)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') sync(record.target)
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue
        sync(node)
        node.querySelectorAll(controls).forEach(sync)
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', ...fieldAttributes] })

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || !['Enter', ' '].includes(event.key)) return
    const button = event.target.closest?.('uni-button')
    if (!button || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return
    event.preventDefault()
    button.click()
  })
}
