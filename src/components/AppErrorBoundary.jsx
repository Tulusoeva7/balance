import { Component } from 'react';
import AppStatus from './AppStatus';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { console.error('Ошибка интерфейса Balance', error, info); }
  render() {
    if (this.state.failed) return <AppStatus title="Не удалось открыть экран">
      <p>Перезагрузите страницу. Если ошибка повторится, попробуйте вернуться на главный экран.</p>
      <button className="text-indigo-600 underline" onClick={() => window.location.reload()}>Повторить</button>
      <p><a className="text-indigo-600 underline" href="/">На главный экран</a></p>
    </AppStatus>;
    return this.props.children;
  }
}
