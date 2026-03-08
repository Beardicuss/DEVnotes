import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props  { children: ReactNode; fallback?: ReactNode; tabName?: string; }
interface State  { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          height:"100%", gap:"1.2em", padding:"2em", textAlign:"center",
        }}>
          <span style={{ fontSize:"2.5em" }}>⚠</span>
          <div style={{ fontFamily:"var(--font-display)", color:"var(--red)", fontSize:"var(--fs-sm)", letterSpacing:"0.15em" }}>
            {this.props.tabName ? `${this.props.tabName.toUpperCase()} CRASHED` : "SOMETHING WENT WRONG"}
          </div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:"var(--fs-xxs)", color:"var(--text-dim)", maxWidth:"32em", lineHeight:1.7 }}>
            {this.state.error.message}
          </div>
          <button className="btn btn-primary" onClick={this.reset}>↺ Try Again</button>
          <details style={{ maxWidth:"40em", textAlign:"left" }}>
            <summary style={{ fontFamily:"var(--font-mono)", fontSize:"var(--fs-xxs)", color:"var(--text-dim)", cursor:"pointer" }}>
              Stack trace
            </summary>
            <pre style={{ fontFamily:"var(--font-mono)", fontSize:"0.65em", color:"var(--text-dim)", marginTop:"0.5em", overflow:"auto", maxHeight:"10em" }}>
              {this.state.error.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
