import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('[AppErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-3 text-center">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-slate-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium"
            >
              Reload the app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
