/**
 * Catches a crash while drawing the 2D screens (the 3D world has its own recovery in WorldHost) and shows a
 * friendly "try again" card instead of a blank page. The saved profile is untouched: retry just reloads.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ko } from '../../i18n/ko';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    // local only (P1): no reporting anywhere, just the console for whoever is debugging
    console.error('[ui] screen crashed', error, info.componentStack);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen-center" role="alertdialog" aria-label={ko.errors.title} data-testid="ui-crash">
        <div className="card text-center">
          <p className="title">{ko.errors.title}</p>
          <button
            type="button"
            className="toy-btn key-sun mt-4 min-h-16 px-8 text-[1.6rem]"
            onClick={() => location.reload()}
          >
            {ko.errors.retry}
          </button>
        </div>
      </div>
    );
  }
}
