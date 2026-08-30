import { useEffect } from 'react'

function setMetaContent(selector: string, content: string) {
  let element = document.querySelector(selector)
  if (!element) {
    const [, attribute, name] = selector.match(/\[(.+?)="(.+?)"\]/) ?? []
    if (!attribute || !name) return

    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title
    setMetaContent('meta[name="description"]', description)
    setMetaContent('meta[property="og:title"]', title)
    setMetaContent('meta[property="og:description"]', description)
    setMetaContent('meta[name="twitter:title"]', title)
    setMetaContent('meta[name="twitter:description"]', description)
  }, [title, description])
}
