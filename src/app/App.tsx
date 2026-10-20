import { ko } from '../i18n/ko';

export function App() {
  return (
    <main className="grid h-full place-items-center">
      <h1 className="text-5xl font-extrabold">{ko.app.title}</h1>
    </main>
  );
}
