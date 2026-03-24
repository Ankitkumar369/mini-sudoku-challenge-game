import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected runtime error",
    };
  }

  componentDidCatch(error) {
    // Keep stack trace in browser console for debugging while showing safe UI.
    // eslint-disable-next-line no-console
    console.error("App runtime error:", error);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,#15357f_0%,#101a48_42%,#091335_100%)] px-4 py-8 text-[#f2f6ff]">
          <section className="mx-auto max-w-2xl rounded-2xl border border-[rgba(125,160,255,0.3)] bg-[rgba(8,19,55,0.82)] p-5 shadow-2xl">
            <h1 className="text-2xl font-bold text-[#f4f8ff]">App loading error</h1>
            <p className="mt-2 text-sm text-[#d8e1ff]">
              Something went wrong while rendering the app.
            </p>
            <p className="mt-3 rounded-lg border border-[rgba(235,91,44,0.45)] bg-[rgba(235,91,44,0.14)] px-3 py-2 text-xs text-[#f8c9b4]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-4 rounded-lg bg-[#4a57dd] px-4 py-2 text-sm font-semibold text-[#f3f6ff] hover:bg-[#3f49bf]"
            >
              Reload App
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
