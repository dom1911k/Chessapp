import { Component, type ReactNode } from 'react';

/** Last line of defence: a friendly screen with a reload button instead of a blank one. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('App crashed', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-stone-100 p-8 text-center dark:bg-stone-950">
        <div className="font-display text-2xl font-semibold">Oops — something went wrong</div>
        <p className="max-w-sm text-sm text-stone-500">Your progress is saved. Reloading usually fixes this.</p>
        <button className="btn-primary" onClick={() => location.reload()}>
          Reload the app
        </button>
        <p className="max-w-sm text-xs break-words text-stone-400">{this.state.error.message}</p>
      </div>
    );
  }
}
