import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production, swap this for Sentry / your error reporter.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-[#2a2a2a] bg-[#232323] p-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <h2 className="mb-2 text-[18px] font-semibold text-[#e8e8e8]">Something broke</h2>
          <p className="mb-1 break-words font-mono text-[12.5px] text-[#9a9a9a]">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <p className="mb-6 text-[12.5px] text-[#7a7a7a]">Your data is safe — it's stored locally.</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md border border-[#3a3a3a] bg-transparent px-4 py-1.5 text-[13px] text-[#c4c4c4] transition-colors hover:bg-white/[0.05] hover:text-[#e8e8e8]"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-[#e8e8e8] px-4 py-1.5 text-[13px] font-medium text-[#1a1a1a] transition-colors hover:bg-white"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
