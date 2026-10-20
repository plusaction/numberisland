import { ko } from '../i18n/ko';
import { EngineDemo } from './EngineDemo';

const params = new URLSearchParams(location.search);

export function App() {
  if (params.get('demo') === 'engine') return <EngineDemo />;
  return (
    <main className="grid h-full place-items-center">
      <h1 className="text-5xl font-extrabold">{ko.app.title}</h1>
    </main>
  );
}
