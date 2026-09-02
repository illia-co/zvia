import { COMPARISON_HEADINGS, COMPARISON_ROWS } from '../config'
import { Reveal } from './Reveal'

export function Comparison() {
  return (
    <section id="compare" className="border-b border-divider bg-bg-secondary py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            How it compares
          </p>
          <h2 className="m-0 text-2xl font-medium text-text md:text-3xl">
            Built for a different job.
          </h2>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Zvia isn&apos;t another SSH tab or a panel you self-host. It&apos;s the only one
            that reconstructs how your apps are wired — and proves it.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="comparison-th-att"> </th>
                  <th scope="col" className="comparison-th comparison-th--zvia">
                    {COMPARISON_HEADINGS.zvia}
                  </th>
                  <th scope="col" className="comparison-th">
                    {COMPARISON_HEADINGS.sshGuis}
                  </th>
                  <th scope="col" className="comparison-th">
                    {COMPARISON_HEADINGS.dashboards}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.attribute}>
                    <th scope="row" className="comparison-row-att">
                      {row.attribute}
                    </th>
                    <td className="comparison-cell comparison-cell--zvia">{row.zvia}</td>
                    <td className="comparison-cell">{row.sshGuis}</td>
                    <td className="comparison-cell">{row.dashboards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
