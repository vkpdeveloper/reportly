import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import "./landing.css";

export const metadata: Metadata = {
  title: "Reportly | See the work as it happens",
  description:
    "Live reports for AI agents. Follow findings, videos, and progress as they arrive, leave feedback, and keep everything in one shareable document.",
};

const steps = [
  {
    title: "Make it yours",
    text: "Deploy Reportly to your Cloudflare account. Your documents and media stay in your own infrastructure.",
  },
  {
    title: "Connect your agent",
    text: "Create an account, generate a token, and install the Reportly skill on the machines where your agents work.",
  },
  {
    title: "Follow along",
    text: "Get a link at the start. Findings, recordings, and updates appear in the same document as the work happens.",
  },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/docs");

  return (
    <div className="rp-landing">
      <a href="#main" className="rp-skip">
        Skip to content
      </a>
      <header className="rp-header">
        <Link href="/" aria-label="Reportly home" className="rp-brand">
          <Logo />
        </Link>
        <nav aria-label="Main navigation" className="rp-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#inside">What’s inside</a>
          <a href="https://github.com/vkpdeveloper/reportly">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="rp-account">
          <Link href="/login" className="rp-login">
            Log in
          </Link>
          <Link href="/register" className="rp-smallButton">
            Get started <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="rp-hero" aria-labelledby="hero-title">
          <div className="rp-eyebrow">
            <span className="rp-dot" /> LIVE REPORTS FOR AI AGENTS
          </div>
          <h1 id="hero-title">
            Good work deserves
            <br />
            more than a <span>final message.</span>
          </h1>
          <p className="rp-intro">
            Give your agent a place to show its work.
            <br className="rp-desktopBreak" /> Watch findings, videos, and
            progress arrive in one living report.
          </p>
          <div className="rp-heroActions">
            <Link href="/register" className="rp-primary">
              Start your first report <span aria-hidden="true">↗</span>
            </Link>
            <a href="#sample-report" className="rp-secondary">
              <span aria-hidden="true">↓</span> Take a look inside
            </a>
          </div>
          <p className="rp-heroNote">
            Open source. Self-hosted. Built for the way agents work.
          </p>

          <div id="sample-report" className="rp-preview">
            <div className="rp-windowBar">
              <div className="rp-windowDots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <span>reportly / checkout-review</span>
              <span className="rp-exampleLabel">SAMPLE REPORT</span>
            </div>
            <div className="rp-reportBody">
              <aside
                className="rp-reportSidebar"
                aria-label="Sample report contents"
              >
                <Logo />
                <p className="rp-sideLabel">CHECKOUT REVIEW</p>
                <a href="#sample-overview" className="rp-selected">
                  <span>01</span> Overview <b>✓</b>
                </a>
                <a href="#sample-findings">
                  <span>02</span> Findings <b>✓</b>
                </a>
                <a href="#sample-next">
                  <span>03</span> Next steps <span className="rp-dot" />
                </a>
                <div className="rp-sidebarFoot">
                  <span className="rp-dot" /> Agent is working
                </div>
              </aside>
              <div className="rp-reportContent">
                <div className="rp-reportMeta">
                  <span>ACME STORE / UX REVIEW</span>
                  <span className="pill pill-live rp-livePill">
                    Live
                  </span>
                </div>
                <h2 id="sample-overview">A smoother path to checkout</h2>
                <p className="rp-reportLead">
                  Reviewing the mobile checkout flow, one interaction at a time.
                </p>
                <div className="rp-metrics">
                  <div>
                    <span>Flows reviewed</span>
                    <strong>
                      04<span>/ 06</span>
                    </strong>
                  </div>
                  <div>
                    <span>Findings so far</span>
                    <strong>03</strong>
                  </div>
                  <div>
                    <span>Agent status</span>
                    <strong className="rp-status">
                      In progress
                      <span className="rp-dot" />
                    </strong>
                  </div>
                </div>
                <div className="rp-finding" id="sample-findings">
                  <div className="rp-findingHeading">
                    <span className="rp-priority">NEEDS ATTENTION</span>
                    <span>Finding 01</span>
                  </div>
                  <h3>The pay button slips out of view</h3>
                  <p>
                    Opening the coupon field pushes the primary action below the
                    fold on smaller screens.
                  </p>
                  <div className="rp-recommendation">
                    <span aria-hidden="true">↳</span> Keep the order total and
                    pay button in a sticky footer.
                  </div>
                </div>
                <div className="rp-progressLine" id="sample-next">
                  <span className="rp-dot" /> Checking the payment
                  confirmation flow
                  <span className="rp-cursor" aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="rp-previewFooter">
              <span>
                <span className="rp-dot" /> One link. Every update.
              </span>
              <span>
                No refresh needed <span aria-hidden="true">↻</span>
              </span>
            </div>
          </div>
        </section>

        <div className="rp-builtFor">
          <span>MADE FOR THE WORK IN BETWEEN</span>
          <p>
            Code reviews <i>+</i> Research <i>+</i> UI walkthroughs <i>+</i>{" "}
            Test results
          </p>
        </div>

        <section
          id="inside"
          className="rp-inside"
          aria-labelledby="inside-title"
        >
          <div className="rp-sectionHeading">
            <div>
              <span className="rp-kicker">LESS WAITING. MORE CONTEXT.</span>
              <h2 id="inside-title">
                The work unfolds.
                <br />
                You stay in the loop.
              </h2>
            </div>
            <p>
              A final answer is only part of the story. See the evidence, follow
              the progress, and give feedback while it still matters.
            </p>
          </div>
          <div className="rp-features">
            <article>
              <span className="rp-featureIcon" aria-hidden="true">
                ↗
              </span>
              <h3>A link before the work is done</h3>
              <p>
                Your agent creates the report first. New sections and findings
                appear as they’re ready, so you can follow from the start.
              </p>
              <span className="rp-featureTag">
                Updates as the agent writes
              </span>
            </article>
            <article>
              <span className="rp-featureIcon" aria-hidden="true">
                ▤
              </span>
              <h3>The evidence, all together</h3>
              <p>
                Recordings, charts, code diffs, and checklists belong beside the
                findings. One quiet document keeps the full picture readable.
              </p>
              <span className="rp-featureTag">
                Built for more than text
              </span>
            </article>
            <article>
              <span className="rp-featureIcon" aria-hidden="true">
                ↳
              </span>
              <h3>A conversation in context</h3>
              <p>
                Leave a comment on a heading or checklist item. Your agent can
                read and answer it, right where the feedback belongs.
              </p>
              <span className="rp-featureTag">
                Feedback that finds its place
              </span>
            </article>
          </div>
        </section>

        <section
          id="how-it-works"
          className="rp-setup"
          aria-labelledby="setup-title"
        >
          <div>
            <span className="rp-kicker">
              YOUR AGENT. YOUR INFRASTRUCTURE.
            </span>
            <h2 id="setup-title">
              A little setup.
              <br />A much better handoff.
            </h2>
            <a
              href="https://github.com/vkpdeveloper/reportly#get-started"
              className="rp-textLink"
            >
              Read the setup guide <span aria-hidden="true">↗</span>
            </a>
          </div>
          <ol className="rp-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="rp-stepNumber">0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rp-finalCta" aria-labelledby="cta-title">
          <span className="rp-kicker">
            FOLLOW THE THINKING. SEE THE PROGRESS.
          </span>
          <h2 id="cta-title">
            Your next report can start
            <br />
            before the work is finished.
          </h2>
          <Link href="/register" className="rp-primary">
            Get started with Reportly <span aria-hidden="true">↗</span>
          </Link>
          <p>
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </section>
      </main>
      <footer className="rp-footer">
        <Link href="/" aria-label="Reportly home" className="rp-brand">
          <Logo />
        </Link>
        <span>Good work, in good company.</span>
        <a href="https://github.com/vkpdeveloper/reportly">
          View source <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  );
}
