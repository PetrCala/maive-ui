import Head from "next/head";
import Link from "next/link";
import CONST from "@src/CONST";
import CitationBox from "@components/CitationBox";
import SectionHeading from "@components/SectionHeading";
import { GoBackButton } from "@components/Buttons";
import {
  ASYNC_EXAMPLES,
  CodeBlock,
  CodeExampleTabs,
  DATA_FIELDS,
  ENDPOINTS,
  ERROR_CODES,
  ERROR_ENVELOPE_EXAMPLE,
  MINIMAL_REQUEST_EXAMPLE,
  MODEL_PARAMETERS,
  RTMA_PARAMETERS,
  SYNC_EXAMPLES,
} from "@components/ApiDocs";
import type { ParameterRow } from "@components/ApiDocs";

const API = CONST.LINKS.PUBLIC_API;

const TABLE_CELL_CLASSES = "px-3 py-2 align-top text-sm text-secondary";
const TABLE_HEAD_CELL_CLASSES =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const CODE_CLASSES =
  "font-mono text-[0.85em] rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-primary";

const ExternalLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <Link
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-600 dark:text-blue-400 hover:underline"
  >
    {children}
  </Link>
);

const ParameterTable = ({
  caption,
  rows,
}: {
  caption: string;
  rows: ParameterRow[];
}) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table className="w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-gray-50 dark:bg-gray-800/60">
        <tr>
          <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
            Parameter
          </th>
          <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
            Values
          </th>
          <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
            Default
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.name}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <td className={TABLE_CELL_CLASSES}>
              <code className={CODE_CLASSES}>{row.name}</code>
            </td>
            <td className={TABLE_CELL_CLASSES}>{row.values}</td>
            <td className={TABLE_CELL_CLASSES}>
              <code className={CODE_CLASSES}>{row.defaultValue}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function ApiDocsPage() {
  return (
    <>
      <Head>
        <title>{`${CONST.APP_DISPLAY_NAME} - Public API`}</title>
        <meta
          name="description"
          content="Run MAIVE, WAIVE, WLS, and RTMA meta-analysis models programmatically over a free, anonymous HTTP API."
        />
      </Head>
      <main className="content-page-container">
        <div className="max-w-5xl w-full px-2 sm:px-0">
          <GoBackButton href="/" text="Back to Home" />

          <div className="card p-6 sm:p-8 space-y-10">
            <header className="space-y-4">
              <SectionHeading
                level="h1"
                text="Public API"
                description="Run MAIVE, WAIVE, WLS, and RTMA models from your own scripts and pipelines."
              />
              <p className="text-secondary text-sm leading-relaxed">
                The API is free and anonymous: no accounts, no API keys, no
                sign-up. It is the same compute this web app uses, given a
                documented JSON contract. Abuse is bounded by server-side
                concurrency caps and edge rate limits rather than by identity.
              </p>
              <div className="space-y-2">
                <p className="text-sm text-secondary">Base URL</p>
                <CodeBlock code={API.BASE_URL} label="the base URL" />
                <p className="text-sm text-secondary">
                  Content type is{" "}
                  <code className={CODE_CLASSES}>application/json</code> in both
                  directions. The machine-readable contract is the{" "}
                  <ExternalLink href={API.SPEC}>OpenAPI 3 spec</ExternalLink>,
                  which is the source of truth; the{" "}
                  <ExternalLink href={API.GUIDE}>usage guide</ExternalLink> has
                  the same examples in narrative form.
                </p>
              </div>
            </header>

            <section className="space-y-4">
              <SectionHeading level="h2" text="Endpoints" />
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Public API endpoints</caption>
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Endpoint
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Kind
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENDPOINTS.map((endpoint) => (
                      <tr
                        key={`${endpoint.method} ${endpoint.path}`}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <td className={TABLE_CELL_CLASSES}>
                          <code className={CODE_CLASSES}>
                            {`${endpoint.method} ${endpoint.path}`}
                          </code>
                        </td>
                        <td className={TABLE_CELL_CLASSES}>{endpoint.kind}</td>
                        <td className={TABLE_CELL_CLASSES}>
                          {endpoint.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeading
                level="h2"
                text="Synchronous or asynchronous"
                description="Async is the recommended default."
              />
              <p className="text-secondary text-sm leading-relaxed">
                Synchronous endpoints return the result in the same response,
                which is the simplest thing to call, but they are subject to the
                edge&apos;s roughly 100 second proxy cap. That is comfortable
                for typical runs (about 15 to 60 seconds including a cold start)
                and unsuitable for anything larger.
              </p>
              <p className="text-secondary text-sm leading-relaxed">
                The asynchronous path (
                <code className={CODE_CLASSES}>POST /v1/runs</code> then poll{" "}
                <code className={CODE_CLASSES}>GET /v1/runs/{"{jobId}"}</code>{" "}
                every 2 to 5 seconds) holds no long-lived connection, so it has
                no failure mode tied to run duration. Use it by default,
                especially for batch or CI usage. Batch status for several runs
                at once:{" "}
                <code className={CODE_CLASSES}>GET /v1/runs?ids=a,b,c</code> (up
                to 100 ids, statuses only).
              </p>
            </section>

            <section className="space-y-4">
              <SectionHeading level="h2" text="Data" />
              <p className="text-secondary text-sm leading-relaxed">
                Send <code className={CODE_CLASSES}>data</code> as an array of
                row objects. Columns are resolved by canonical key name when
                present (matched case-insensitively); otherwise the first 3 or 4
                keys are read positionally in the order effect, se, n_obs,
                study_id.
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Data row fields</caption>
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Field
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Type
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Required for
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DATA_FIELDS.map((row) => (
                      <tr
                        key={row.field}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <td className={TABLE_CELL_CLASSES}>
                          <code className={CODE_CLASSES}>{row.field}</code>
                        </td>
                        <td className={TABLE_CELL_CLASSES}>{row.type}</td>
                        <td className={TABLE_CELL_CLASSES}>
                          {row.requiredFor}
                        </td>
                        <td className={TABLE_CELL_CLASSES}>{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                The MAIVE family (
                <code className={CODE_CLASSES}>/v1/run-model</code>) needs 3 or
                4 columns and at least 4 rows. RTMA (
                <code className={CODE_CLASSES}>/v1/run-rtma</code>) needs 2
                columns (<code className={CODE_CLASSES}>effect</code>,{" "}
                <code className={CODE_CLASSES}>se</code>); rows with a missing
                or non-positive <code className={CODE_CLASSES}>se</code> are
                silently dropped. These rules mirror the app&apos;s own
                validation page and run server-side, so you get a structured{" "}
                <code className={CODE_CLASSES}>400</code> instead of a raw R
                error.
              </p>
            </section>

            <section className="space-y-4">
              <SectionHeading
                level="h2"
                text="Parameters"
                description="Every parameter is optional; unset ones fall back to the defaults below."
              />
              <p className="text-secondary text-sm leading-relaxed">
                A minimal valid request is just{" "}
                <code className={CODE_CLASSES}>{'{"data": [...]}'}</code>:
              </p>
              <CodeBlock
                code={MINIMAL_REQUEST_EXAMPLE}
                label="the minimal request body"
              />
              <h3 className="text-base font-semibold text-primary">
                MAIVE, WAIVE, and WLS
              </h3>
              <ParameterTable
                caption="MAIVE-family model parameters and defaults"
                rows={MODEL_PARAMETERS}
              />
              <h3 className="text-base font-semibold text-primary">RTMA</h3>
              <ParameterTable
                caption="RTMA parameters and defaults"
                rows={RTMA_PARAMETERS}
              />
              <p className="text-secondary text-sm leading-relaxed">
                Plots (<code className={CODE_CLASSES}>funnelPlot</code>,{" "}
                <code className={CODE_CLASSES}>zScorePlot</code>, and their
                width and height companions) are excluded by default: each is a
                base64 PNG of roughly 50KB that most callers do not need. Add{" "}
                <code className={CODE_CLASSES}>?include=plot</code> to any run
                or poll request to embed them.
              </p>
            </section>

            <section className="space-y-4">
              <SectionHeading level="h2" text="Example: synchronous run" />
              <CodeExampleTabs
                samples={SYNC_EXAMPLES}
                label="Synchronous run example"
              />
            </section>

            <section className="space-y-4">
              <SectionHeading
                level="h2"
                text="Example: asynchronous run"
                description="Submit, poll until terminal, then read the result."
              />
              <CodeExampleTabs
                samples={ASYNC_EXAMPLES}
                label="Asynchronous run example"
              />
            </section>

            <section className="space-y-4">
              <SectionHeading level="h2" text="Errors and rate limits" />
              <p className="text-secondary text-sm leading-relaxed">
                Every error shares one envelope:
              </p>
              <CodeBlock
                code={ERROR_ENVELOPE_EXAMPLE}
                label="the error envelope"
              />
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Error codes</caption>
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Code
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Status
                      </th>
                      <th scope="col" className={TABLE_HEAD_CELL_CLASSES}>
                        Meaning
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ERROR_CODES.map((row) => (
                      <tr
                        key={row.code}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <td className={TABLE_CELL_CLASSES}>
                          <code className={CODE_CLASSES}>{row.code}</code>
                        </td>
                        <td className={TABLE_CELL_CLASSES}>{row.status}</td>
                        <td className={TABLE_CELL_CLASSES}>{row.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-secondary text-sm leading-relaxed">
                Two guardrails apply: a hard concurrency cap on the compute
                backend, and per-IP rate limiting at the edge. Both are tuned
                from observed load, so treat any{" "}
                <code className={CODE_CLASSES}>429</code> as &quot;retry with
                backoff&quot; rather than a hard quota.
              </p>
            </section>

            <section className="space-y-4">
              <SectionHeading level="h2" text="jobId and privacy" />
              <ul className="list-disc pl-5 space-y-2 text-secondary text-sm leading-relaxed">
                <li>
                  A <code className={CODE_CLASSES}>jobId</code> is an opaque
                  bearer token, not an account-scoped identifier. Anyone holding
                  it can read that run&apos;s status and result, so treat it
                  like a share link.
                </li>
                <li>
                  Runs and their results expire after 48 hours; polling after
                  that returns{" "}
                  <code className={CODE_CLASSES}>404 not_found</code>.
                </li>
                <li>
                  Synchronous runs are stateless. Asynchronous runs persist the
                  parameters and the result for up to 48 hours; the input
                  dataset itself is not persisted beyond the transient queue
                  message.
                </li>
                <li>
                  Do not submit confidential or personally identifiable data.
                  There is no data-classification or redaction layer; treat
                  every request the way you would treat a request to any other
                  unauthenticated public web service.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <SectionHeading level="h2" text="Citation" />
              <p className="text-secondary text-sm leading-relaxed">
                If you use MAIVE in published or reported work, please cite the
                paper:
              </p>
              <CitationBox variant="full" useBlueStyling />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
