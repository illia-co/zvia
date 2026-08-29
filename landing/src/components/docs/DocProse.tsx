import type { DocBlock } from '../../docs/content'

interface DocProseProps {
  blocks: DocBlock[]
}

export function DocProse({ blocks }: DocProseProps) {
  return (
    <div className="doc-prose">
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={index} className="doc-paragraph">
              {block.content as string}
            </p>
          )
        }

        if (block.type === 'subheading') {
          return (
            <h3 key={index} className="doc-subheading">
              {block.content as string}
            </h3>
          )
        }

        return (
          <ul key={index} className="doc-list">
            {(block.content as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
